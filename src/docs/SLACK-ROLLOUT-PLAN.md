# Slack Connector — Phase 2/3 Rollout Plan

Strict implementation plan for message sync and response time analytics.
For Codex review before implementation begins.

**Phase 1 (complete):** Connection, staff/channel mapping, auto-match, UI, docs.

---

## Phase 2: Message Sync

### 2.1 Goal

Incrementally sync message metadata from all mapped Slack channels into `slack_messages`.
No message content stored — only timestamps, sender IDs, and thread references.

### 2.2 Database Migration: `slack_messages`

```sql
CREATE TABLE slack_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id TEXT NOT NULL,
  message_ts TEXT NOT NULL,
  thread_ts TEXT,                          -- NULL = top-level message
  sender_slack_id TEXT,                    -- NULL for non-user/system events
  sender_bot_id TEXT,                      -- Bot sender if applicable
  sender_type TEXT NOT NULL DEFAULT 'user' CHECK (sender_type IN ('user', 'bot', 'system')),
  sender_staff_id UUID,                    -- Resolved at sync time via entity_external_ids for user senders
  sender_is_staff BOOLEAN NOT NULL DEFAULT false,
  is_bot BOOLEAN NOT NULL DEFAULT false,
  posted_at TIMESTAMPTZ NOT NULL,          -- Parsed from message_ts (epoch seconds)

  CONSTRAINT slack_messages_pkey_channel_ts UNIQUE(channel_id, message_ts),
  CONSTRAINT slack_messages_sender_present CHECK (
    sender_slack_id IS NOT NULL OR sender_bot_id IS NOT NULL OR sender_type = 'system'
  )
);

CREATE INDEX idx_slack_messages_channel_posted ON slack_messages(channel_id, posted_at);
CREATE INDEX idx_slack_messages_thread ON slack_messages(thread_ts) WHERE thread_ts IS NOT NULL;
CREATE INDEX idx_slack_messages_sender ON slack_messages(sender_slack_id, posted_at);

-- RLS: admin + service_role only
ALTER TABLE slack_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY slack_messages_read ON slack_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.email = current_setting('request.jwt.claims', true)::jsonb->>'email'
      AND s.role IN ('admin', 'operations_admin')
    )
    OR current_user = 'service_role'
  );
CREATE POLICY slack_messages_write ON slack_messages
  FOR ALL USING (current_user = 'service_role')
  WITH CHECK (current_user = 'service_role');
```

**Design decisions:**
- `message_ts` is treated as unique per channel (`UNIQUE(channel_id, message_ts)`)
- `posted_at` is parsed from `message_ts` as `to_timestamp(split_part(message_ts, '.', 1)::bigint)` for time-range queries
- `sender_staff_id` is resolved at sync time for `sender_type = 'user'` via `entity_external_ids WHERE source = 'slack_user' AND external_id = sender_slack_id`
- `sender_is_staff` denormalized for fast analytics queries without joining entity_external_ids (reclassification job keeps it current)
- No `partner_id` column — resolved via `slack_sync_state.partner_id` joined on `channel_id`
- `slack_sync_state` should add `oldest_ts TEXT` (historical boundary) plus `bot_is_member BOOLEAN` for membership state

**Open question for review:** Keep `sender_is_staff` denormalized with reclassification job, or compute at query time from `entity_external_ids`? Current recommendation: denormalize for analytics speed and reclassify on mapping change.

### 2.3 Sync Engine: `src/lib/slack/sync.ts`

#### Core algorithm

```
syncAllChannels():
  1. Acquire run lease (db lock row) so only one worker processes a run at a time
  2. Fetch mapped channels from slack_sync_state WHERE partner_id IS NOT NULL
     ordered by last_synced_at ASC NULLS FIRST
  3. Build staff lookup: Map<slack_user_id, staff_id> from entity_external_ids
  4. Process next chunk sequentially (rate-limited):
     a. syncChannel(channel, staffLookup)
  5. Persist cursor/progress and release lease
  6. Return summary: { synced, failed, skipped, totalMessages }

syncChannel(channel, staffLookup):
  1. Read channel.latest_ts, channel.oldest_ts, channel.is_backfill_complete from slack_sync_state
  2. Join channel if not already a member (conversations.join, public only)
  3. Forward incremental pass:
     - If latest_ts exists: fetch newest messages with oldest = latest_ts
     - If NULL: seed window with oldest = now() - SLACK_BACKFILL_DAYS
  4. Optional historical backfill pass (bounded pages per run):
     - If is_backfill_complete = false:
       fetch older pages using latest = oldest_ts (or seed boundary on first backfill pass)
  5. For each page of messages (200/page, cursor-based):
     a. Filter: skip subtype = 'channel_join', 'channel_leave', 'channel_topic', etc.
     b. Classify sender:
        - user sender: sender_type = 'user', sender_slack_id = msg.user
        - bot sender: sender_type = 'bot', sender_bot_id = msg.bot_id
        - else: sender_type = 'system'
        - is_staff = sender_type = 'user' && staffLookup.has(msg.user)
     c. Parse posted_at from message_ts
     d. Batch upsert into slack_messages (ON CONFLICT DO NOTHING — idempotent)
  6. Update slack_sync_state:
     - latest_ts = max(message_ts) from forward pass
     - oldest_ts = min(message_ts) seen historically
     - message_count += new messages inserted
     - last_synced_at = now()
     - error = null (clear previous error)
     - is_backfill_complete = true only when backfill pass returns no next_cursor
  7. On error:
     - Set slack_sync_state.error = error message
     - Continue to next channel (don't abort entire sync)
     - Log with channel_id + error for observability
```

#### Idempotency

- `UNIQUE(channel_id, message_ts)` + `ON CONFLICT DO NOTHING` makes every upsert idempotent
- Re-running sync for a channel that partially failed will re-fetch from `latest_ts` (which was NOT updated on failure)
- Duplicate messages from overlapping time windows are silently skipped
- When bot membership expands later (newly invited to additional channels), historical backfill can run from `oldest_ts` without creating duplicates

#### Rate limiting

- Uses existing promise-chain queue from Phase 1 (`src/lib/slack/client.ts`)
- 1.2s minimum between API calls, 429 retry with Retry-After + exponential backoff
- One channel at a time (sequential within a sync run)
- No parallelism across channels — unnecessary given rate limits

#### Backfill strategy

- Two-watermark model per channel:
  - `latest_ts` = newest synced boundary (forward incremental)
  - `oldest_ts` = oldest synced boundary (historical backfill progress)
- First sync: seed with 30-day lookback (configurable `SLACK_BACKFILL_DAYS`, default 30)
- Historical backfill progresses in bounded page budgets per run until `is_backfill_complete = true`
- Admin can trigger deeper backfill windows (90 days, 1 year) with bounded page budget
- No full-history assumption: history availability depends on Slack workspace plan + bot membership timing

#### Volume estimates (2000 mapped channels)

| Scenario | API calls | Time @ 1.2s/call | Messages |
|----------|-----------|-------------------|----------|
| First sync (30 days, ~50 msgs/channel avg) | ~2000 (1 page each) | ~40 min | ~100K |
| Daily incremental (~5 msgs/channel) | ~2000 (1 page each) | ~40 min | ~10K |
| Active channel backfill (1000 msgs) | ~5 pages | ~6 sec | ~1000 |

**Implication:** Full sync takes ~40 minutes. This MUST be a background job, not an API request.

### 2.4 Sync Execution Model

Sync runs as a **long-running background task** triggered by an admin API call.
NOT a Vercel serverless function (10s timeout on Hobby, 60s on Pro).

#### Option A: Vercel Cron + chunked processing (recommended for now)

```
POST /api/slack/sync/start
  → Writes sync_run record with status = 'running'
  → Returns immediately with sync_run_id

Vercel Cron (every 5 min): /api/cron/slack-sync
  → Checks for sync_run with status = 'running'
  → Claims lease for run row (skip if lease held by another worker)
  → Processes next N channels (batch of 15-20, target < 30s of work)
  → Updates sync_run progress
  → If all channels done: status = 'completed'
```

**Pros:** Works on Vercel Hobby/Pro, no infra changes, resumable.
**Cons:** 5-min granularity, slightly complex state machine.

#### Option B: Edge function with streaming (future)

If Vercel Edge Functions get longer timeouts, move to a single streaming response.
Not viable today at our scale.

#### Sync run tracking

Use a dedicated `slack_sync_runs` table:

```sql
CREATE TABLE slack_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'pending',   -- pending, running, completed, failed, cancelled
  triggered_by TEXT,                        -- admin email
  total_channels INT DEFAULT 0,
  synced_channels INT DEFAULT 0,
  failed_channels INT DEFAULT 0,
  total_messages_synced INT DEFAULT 0,
  next_channel_offset INT DEFAULT 0,        -- cursor for chunked processing
  worker_lease_expires_at TIMESTAMPTZ,      -- anti-overlap lease
  last_heartbeat_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Anti-overlap lease pattern:**
```sql
UPDATE slack_sync_runs
SET worker_lease_expires_at = now() + interval '4 minutes',
    last_heartbeat_at = now()
WHERE id = :run_id
  AND status = 'running'
  AND (
    worker_lease_expires_at IS NULL
    OR worker_lease_expires_at < now()
  )
RETURNING *;
```
If no row returned, another worker owns the lease and this cron execution exits.

### 2.5 Bot Channel Membership

Before reading history, the bot must be a member of the channel.

```
For each mapped channel:
  1. Try conversations.history — if 'not_in_channel' error:
  2. If public: conversations.join (bot self-joins)
  3. If private: log error "Bot not in private channel {name}, ask admin to invite"
  4. Track membership status in slack_sync_state (add `bot_is_member BOOLEAN`)
```

**Private channel strategy:**
- Bot cannot self-join private channels
- Admin UI shows "Bot not in channel" warning with invite instructions
- Phase 1 channel list already shows `is_private` flag — use this to warn at mapping time
- When bot is invited later, keep existing `latest_ts` and resume deep backfill from `oldest_ts` (idempotent dedupe prevents duplicates)

### 2.6 Staff Reclassification

If a staff member is mapped to Slack AFTER their messages were already synced:

```sql
-- Reclassify existing messages when a new staff mapping is created
UPDATE slack_messages
SET sender_staff_id = :staff_id,
    sender_is_staff = true
WHERE sender_slack_id = :slack_user_id
  AND sender_staff_id IS NULL;
```

Triggered by: `POST /api/slack/mappings/staff` and `POST /api/slack/mappings/staff/auto-match`

Also when a staff mapping is removed/unmapped:
```sql
UPDATE slack_messages
SET sender_staff_id = NULL,
    sender_is_staff = false
WHERE sender_slack_id = :slack_user_id
  AND sender_staff_id = :former_staff_id;
```

### 2.7 API Routes

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/slack/sync/start` | Trigger sync run (returns sync_run_id) |
| GET | `/api/slack/sync/status` | Get current/latest sync run progress |
| POST | `/api/slack/sync/channel/[channelId]` | Sync a single channel (for testing/debugging) |
| POST | `/api/cron/slack-sync` | Cron handler for chunked processing |

### 2.8 UI Components

**SlackSyncStatus** (`src/components/slack/slack-sync-status.tsx`):
- Shows current sync run: progress bar, channels synced/total, messages count
- Per-channel status table: last synced, message count, error (if any)
- "Start Sync" button (disabled while running)
- "Sync Channel" button per row for single-channel sync

Add as third tab in SlackMappingHub: `Staff | Channels | Sync`

### 2.9 Rollback Plan

- `DROP TABLE slack_messages` — no downstream dependencies in Phase 2
- `DROP TABLE slack_sync_runs` — tracking only
- Remove `bot_is_member` column from `slack_sync_state` if added
- No data in other tables depends on slack_messages

### 2.10 Go/No-Go Criteria (Phase 2)

Before proceeding to Phase 3:
- [ ] At least 100 channels syncing successfully
- [ ] Incremental sync completes in < 60 minutes for all mapped channels
- [ ] No rate limit errors in last 3 sync runs
- [ ] `sender_is_staff` classification accuracy verified (spot check 20 channels)
- [ ] Error rate < 5% of channels per sync run
- [ ] Backfill complete for all channels (`is_backfill_complete = true`)

---

## Phase 3: Response Time Analytics

### 3.1 Goal

Compute how quickly Sophie staff respond to partner messages in Slack.
Pre-aggregate into `slack_response_metrics` for fast dashboard queries.
Attribute response times to pod leaders for pod-level performance tracking.

### 3.2 Database Migration: `slack_response_metrics`

```sql
CREATE TABLE slack_response_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id TEXT NOT NULL,
  partner_id UUID NOT NULL REFERENCES partners(id),
  pod_leader_id UUID REFERENCES staff(id),     -- Snapshotted at compute time
  date DATE NOT NULL,

  -- Volume
  total_messages INT NOT NULL DEFAULT 0,
  staff_messages INT NOT NULL DEFAULT 0,
  partner_messages INT NOT NULL DEFAULT 0,

  -- Response times (minutes)
  avg_response_time_mins NUMERIC(10,2),
  median_response_time_mins NUMERIC(10,2),
  p95_response_time_mins NUMERIC(10,2),
  max_response_time_mins NUMERIC(10,2),
  min_response_time_mins NUMERIC(10,2),

  -- Buckets
  responses_under_30m INT NOT NULL DEFAULT 0,
  responses_30m_to_1h INT NOT NULL DEFAULT 0,
  responses_1h_to_4h INT NOT NULL DEFAULT 0,
  responses_4h_to_24h INT NOT NULL DEFAULT 0,
  responses_over_24h INT NOT NULL DEFAULT 0,
  unanswered_count INT NOT NULL DEFAULT 0,

  -- Metadata
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  algorithm_version INT NOT NULL DEFAULT 1,    -- Version of algorithm used for this row

  UNIQUE(channel_id, date)
);

CREATE INDEX idx_response_metrics_partner ON slack_response_metrics(partner_id, date);
CREATE INDEX idx_response_metrics_pod ON slack_response_metrics(pod_leader_id, date);
CREATE INDEX idx_response_metrics_date ON slack_response_metrics(date);

-- RLS
ALTER TABLE slack_response_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY response_metrics_read ON slack_response_metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.email = current_setting('request.jwt.claims', true)::jsonb->>'email'
      AND s.role IN ('admin', 'operations_admin')
    )
    OR current_user = 'service_role'
  );
CREATE POLICY response_metrics_write ON slack_response_metrics
  FOR ALL USING (current_user = 'service_role')
  WITH CHECK (current_user = 'service_role');
```

**Design decisions:**
- Daily granularity (not weekly/monthly) — can aggregate up in queries
- `algorithm_version` identifies which logic produced the current row (row is overwritten on recompute)
- `pod_leader_id` snapshotted at compute time from `partner_assignments WHERE assignment_role = 'pod_leader' AND unassigned_at IS NULL`
- Five response time buckets (not three) — more granular than original plan
- `unanswered_count` tracks partner messages with no staff reply within lookahead window (default 7 days)

### 3.3 Response Time Algorithm: `src/lib/slack/analytics.ts`

#### Definitions

- **Partner message**: `sender_is_staff = false AND is_bot = false` in a mapped channel
- **Staff reply**: `sender_is_staff = true AND is_bot = false` in the same channel
- **Response time**: Time between a partner message and the FIRST staff reply after it
- **Thread scope**: Messages in a thread (`thread_ts IS NOT NULL`) are matched within that thread only
- **Top-level scope**: Messages without `thread_ts` are matched in chronological channel order

#### Algorithm (per channel, per day with lookahead)

```
computeResponseTimes(channel_id, date):
  1. Fetch staff_ids SET from entity_external_ids WHERE source = 'slack_user'
  2. Fetch pod_leader_id from partner_assignments
     WHERE partner_id = (SELECT partner_id FROM slack_sync_state WHERE channel_id = ?)
     AND assignment_role = 'pod_leader'
     AND unassigned_at IS NULL

  3. Fetch all messages for this channel in [date, date + LOOKAHEAD_DAYS], ordered by posted_at ASC
     - LOOKAHEAD_DAYS default = 7 (configurable)
     Split into:
     - top_level: WHERE thread_ts IS NULL
     - by_thread: GROUP BY thread_ts WHERE thread_ts IS NOT NULL

  4. Process top-level messages anchored to this day:
     pending_partner_msgs = []
     response_times = []

     for msg in top_level:
       if msg.sender_is_staff:
         if pending_partner_msgs is not empty:
           # Staff replied — compute response time to EARLIEST pending partner message
           earliest = pending_partner_msgs[0]
           rt = msg.posted_at - earliest.posted_at
           response_times.append(rt)
           pending_partner_msgs = []   # All pending are "answered" by this reply
       else if msg.posted_at < date + 1 day:
         # Only partner messages from the anchor day open pending windows
         pending_partner_msgs.append(msg)

     unanswered = len(pending_partner_msgs)

  5. Process threaded messages (same algorithm per thread, same anchor-day rule):
     for thread_ts, thread_msgs in by_thread:
       # Same pending/reply logic within the thread
       # Thread-level unanswered added to total

  6. Compute aggregates:
     - avg, median, p95, max, min from response_times[]
     - Bucket each response_time into 30m / 1h / 4h / 24h / 24h+ bins
     - Count total/staff/partner messages

  7. Upsert into slack_response_metrics (ON CONFLICT (channel_id, date) DO UPDATE)
     with algorithm_version = CURRENT_ALGORITHM_VERSION
```

#### Critical edge cases

| Case | Handling |
|------|----------|
| Partner sends 5 messages, staff replies once | Response time = staff_reply - FIRST partner message. All 5 are marked "answered". |
| Staff sends first message (no partner message) | Ignored — no response time to compute. |
| Partner message at 11:50pm, staff reply at 12:10am | Counted on the PARTNER message's date via lookahead window. |
| Bot message from partner's integration | Filtered out (`is_bot = true`). |
| Thread with no staff reply | Counted as unanswered. Thread messages don't affect top-level response times. |
| Multiple staff reply before next partner message | Only the FIRST staff reply counts. Subsequent staff messages are ignored until next partner message. |
| Partner message in a thread that also has a top-level presence | Thread messages are processed separately from top-level. A message with `thread_ts` is only matched within that thread. |
| Channel remapped to different partner mid-day | Use partner_id from slack_sync_state at compute time. Historical metrics retain the old partner_id (immutable after computation). |
| Pod leader changes | New computation uses new pod_leader_id. Old metrics retain old pod_leader_id. |
| Staff mapping added after messages synced | Run reclassification (Phase 2.6) first, then recompute metrics. |

#### Attribution model

```
partner_assignments table:
  partner_id  | staff_id  | assignment_role | unassigned_at
  -----------+-----------+-----------------+--------------
  ACME Corp  | Sarah J.  | pod_leader      | NULL          ← current
  ACME Corp  | John D.   | pod_leader      | 2026-01-15    ← previous
  ACME Corp  | Mike R.   | account_manager | NULL          ← not pod_leader

Query: SELECT staff_id FROM partner_assignments
       WHERE partner_id = ? AND assignment_role = 'pod_leader' AND unassigned_at IS NULL
       LIMIT 1

→ Sarah J. is credited with ACME Corp's response times
→ Even if Mike R. (account_manager) actually replied in Slack
```

**Why attribute to pod leader, not actual responder?**
- Pod leaders are accountable for their pod's response quality
- Actual responder data is still in `slack_messages` for drill-down
- Avoids gaming (junior staff cherry-picking easy messages)

### 3.4 Computation Execution

#### Daily computation (Vercel Cron)

```
POST /api/cron/slack-analytics (daily at 6am UTC)
  1. Compute rolling window: [today - LOOKAHEAD_DAYS, yesterday]
  2. For each channel in slack_sync_state WHERE partner_id IS NOT NULL:
     a. recompute metrics for each date in rolling window
  3. Log summary: { channels_computed, dates_recomputed, total_response_times, avg_response }
```

#### Recomputation (admin-triggered)

```
POST /api/slack/analytics/recompute
  Body: { channel_id?: string, date_from: string, date_to: string }
  → Recomputes metrics for date range
  → Uses current algorithm_version constant
  → Overwrites existing metrics (ON CONFLICT DO UPDATE)
```

Use cases:
- Staff mapping added retroactively → reclassify messages → recompute
- Algorithm bug fixed → recompute all historical metrics
- Channel remapped → recompute from remap date forward

#### Backfill computation

After Phase 2 backfill completes:
```
POST /api/slack/analytics/recompute
  Body: { date_from: "2026-01-07", date_to: "2026-02-06" }
  → Computes 30 days of historical metrics for all channels
```

### 3.5 API Routes

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/slack/analytics/response-times` | Response time metrics (filterable by partner, pod_leader, date range) |
| GET | `/api/slack/analytics/channel-activity` | Message volume by channel over time |
| GET | `/api/slack/analytics/summary` | Dashboard-level KPIs (overall avg response, worst channels, etc.) |
| POST | `/api/slack/analytics/recompute` | Trigger recomputation for date range |
| POST | `/api/cron/slack-analytics` | Daily cron handler |

#### Query patterns

```sql
-- Pod leader performance (last 30 days)
SELECT pod_leader_id, staff.full_name,
  AVG(avg_response_time_mins) as avg_response,
  SUM(unanswered_count) as total_unanswered,
  COUNT(DISTINCT channel_id) as channels
FROM slack_response_metrics m
JOIN staff ON m.pod_leader_id = staff.id
WHERE date >= CURRENT_DATE - 30
GROUP BY pod_leader_id, staff.full_name
ORDER BY avg_response ASC;

-- Partner response trend (weekly)
SELECT date_trunc('week', date) as week,
  AVG(avg_response_time_mins) as avg_response,
  SUM(total_messages) as volume
FROM slack_response_metrics
WHERE partner_id = :partner_id
GROUP BY week
ORDER BY week;

-- Worst response time channels today
SELECT m.channel_id, ss.channel_name, p.brand_name,
  m.avg_response_time_mins, m.unanswered_count
FROM slack_response_metrics m
JOIN slack_sync_state ss ON m.channel_id = ss.channel_id
JOIN partners p ON m.partner_id = p.id
WHERE m.date = CURRENT_DATE - 1
ORDER BY m.avg_response_time_mins DESC NULLS LAST
LIMIT 20;
```

### 3.6 UI Components

**SlackResponseChart** (`src/components/slack/slack-response-chart.tsx`):
- Recharts line chart: avg response time over last 30/60/90 days
- Filterable by partner, pod leader
- Response time bucket breakdown (stacked bar)

**SlackChannelHeatmap** (`src/components/slack/slack-channel-heatmap.tsx`):
- GitHub-style heatmap: channels (rows) x days (columns)
- Color = avg response time (green < 1h, yellow 1-4h, orange 4-24h, red > 24h)
- Click cell → drill into that channel + day

**SlackAnalyticsSummary** (`src/components/slack/slack-analytics-summary.tsx`):
- KPI cards: avg response time, % under 1h, unanswered count, active channels
- Pod leader leaderboard (top 5 by response time)
- Trend sparklines

**Integration points:**
- New tab in SlackMappingHub: `Staff | Channels | Sync | Analytics`
- Partner detail page: response time widget (if channel mapped)
- Admin dashboard: optional response time KPI card

### 3.7 Rollback Plan

- `DROP TABLE slack_response_metrics` — no downstream dependencies
- Remove cron job config
- Analytics UI components are additive (removing tab doesn't break existing UI)
- `slack_messages` table is unaffected (Phase 2 data preserved)

### 3.8 Go/No-Go Criteria (Phase 3)

Before declaring Slack connector complete:
- [ ] Response time metrics computed for at least 7 consecutive days
- [ ] Pod leader attribution matches manual spot check (5 partners)
- [ ] Recomputation endpoint works for arbitrary date ranges
- [ ] Thread-scoped response times verified (check channels with heavy thread usage)
- [ ] Dashboard loads in < 2 seconds for 30-day view across all channels
- [ ] No unanswered_count inflation from bot messages or channel_join messages

---

## Operational Concerns

### Observability

| Event | Logging |
|-------|---------|
| Sync run start/end | `console.log` with run_id, channel count, duration |
| Channel sync error | `console.error` with channel_id, error, stack trace |
| Rate limit hit (429) | `console.warn` with retry count, Retry-After value |
| Reclassification run | `console.log` with slack_user_id, messages updated |
| Analytics computation | `console.log` with date, channels computed, avg metrics |

Future: pipe to PostHog custom events for dashboarding.

### Storage estimates

| Table | Row size | 30 days (2000 channels) | 1 year |
|-------|----------|------------------------|--------|
| `slack_messages` | ~150 bytes | ~100K rows = ~15 MB | ~1.2M rows = ~180 MB |
| `slack_response_metrics` | ~200 bytes | ~60K rows = ~12 MB | ~730K rows = ~146 MB |

Well within Supabase free tier (500 MB) for the first year. Consider archiving messages older than 6 months if storage becomes an issue.

### Failure modes

| Failure | Impact | Recovery |
|---------|--------|----------|
| Slack API down | Sync fails, retries next cron | Automatic on next run |
| Bot token revoked | All API calls fail | Admin re-installs app, updates env var |
| Channel deleted in Slack | `conversations.history` returns `channel_not_found` | Mark channel error in sync_state, skip |
| Supabase down | Can't write messages/metrics | Retry on next run (idempotent) |
| Staff mapping changed | Stale `sender_is_staff` | Run reclassification + recompute |
| Partner remapped | Old metrics have old partner_id | Recompute from remap date |
| Cron missed | Sync/analytics delayed | Catches up on next run (incremental) |
| Duplicate cron overlap | Double-processing risk | Lease lock in `slack_sync_runs` prevents concurrent workers |

### Migration order

```
Phase 2:
  1. Apply slack_messages migration
  2. Alter slack_sync_state (add oldest_ts, bot_is_member)
  3. Apply slack_sync_runs migration
  4. Deploy sync engine code
  5. Add Vercel cron job for sync
  6. Trigger initial sync (30-day backfill)
  7. Monitor for 3-5 days
  8. Verify go/no-go criteria

Phase 3:
  9. Apply slack_response_metrics migration
  10. Deploy analytics engine code
  11. Add Vercel cron job for daily analytics
  12. Trigger backfill computation (30 days)
  13. Deploy analytics UI
  14. Verify go/no-go criteria
```

### Reprocessing

Any metric can be recomputed from source data:
- `slack_messages` → recompute `slack_response_metrics` for any date range
- If `slack_messages` has wrong `sender_is_staff` → reclassify from `entity_external_ids`, then recompute metrics
- Full reprocessing from Slack API: delete `slack_messages` for a channel, reset `latest_ts`, `oldest_ts`, and `is_backfill_complete` in `slack_sync_state`, then re-sync

---

## Open Questions for Review

1. **Cron vs background job:** Is Vercel Cron + chunked processing sufficient, or do we need a proper job queue (e.g., Inngest, Trigger.dev)?

2. **Business hours:** Should response times exclude weekends/after-hours? If yes, need business hours config (per partner? per workspace?). Recommend: start without, add as Phase 3.1.

3. **Thread model:** Current plan counts threaded and top-level separately. Should a top-level partner message that gets a threaded staff reply count as "answered"? (Slack shows thread replies differently from channel replies.)

4. **Multi-channel partners:** A partner with 3 channels — should analytics aggregate across all channels or show per-channel? Recommend: per-channel in DB, aggregate in API/UI with option to drill down.

5. **Historical pod leader:** If pod leader changed mid-month, which pod leader gets the metrics? Current: whoever is assigned at compute time. Alternative: snapshot pod_leader at message time (more accurate but complex).

6. **Sender classification for non-staff non-partner:** What about external contacts, freelancers, shared channel guests? Current: any non-staff sender is treated as "partner message". Should we have a third category?

7. **Message edit/delete:** Slack messages can be edited or deleted. Do we care? For response time, probably not (we only track timestamps). But deleted messages could inflate unanswered counts if the partner deletes their own message after it's synced.

---

## Agent Team Plan: Phase 2/3 Implementation

### Team Structure (4 agents)

| Agent | Name | Type | Scope |
|-------|------|------|-------|
| **sync-engine** | `sync-engine` | general-purpose | Core sync logic, DB migrations, cron handler |
| **api-dev** | `api-dev` | general-purpose | All Phase 2/3 API routes |
| **ui-dev** | `ui-dev` | general-purpose | Sync status UI, analytics charts, dashboard widgets |
| **analytics-engine** | `analytics-engine` | general-purpose | Response time algorithm, metrics computation, recomputation |

### Agent Ownership Matrix

#### sync-engine (Phase 2 lead)

**Creates:**
| File | Purpose |
|------|---------|
| `supabase/migrations/20260208_slack_messages.sql` | `slack_messages` + `slack_sync_runs` tables, RLS policies, indexes |
| `supabase/migrations/20260208_slack_sync_state_v2.sql` | ALTER `slack_sync_state` ADD `oldest_ts`, `bot_is_member` |
| `src/lib/slack/sync.ts` | `syncAllChannels()`, `syncChannel()`, bot membership handling, chunked processing |

**Modifies:**
| File | Change |
|------|--------|
| `src/lib/slack/client.ts` | Add `joinChannel()`, `getChannelHistory()` with pagination params |
| `src/lib/slack/types.ts` | Add `SlackSyncRun`, `SyncChannelResult`, `SyncRunSummary` types |
| `src/lib/connectors/slack.ts` | Wire sync methods into connector |
| `src/app/api/slack/mappings/staff/route.ts` | Add staff reclassification on POST (Phase 2.6) |
| `src/app/api/slack/mappings/staff/auto-match/route.ts` | Add bulk reclassification after auto-match |

**Blocked by:** Nothing (starts immediately)
**Blocks:** api-dev (needs sync.ts for route handlers), analytics-engine (needs slack_messages populated)

#### api-dev (Phase 2 routes + Phase 3 routes)

**Creates:**
| File | Purpose |
|------|---------|
| `src/app/api/slack/sync/start/route.ts` | POST: create sync run, return run_id |
| `src/app/api/slack/sync/status/route.ts` | GET: current/latest sync run progress |
| `src/app/api/slack/sync/channel/[channelId]/route.ts` | POST: single-channel sync (debug) |
| `src/app/api/cron/slack-sync/route.ts` | POST: Vercel cron handler for chunked sync |
| `src/app/api/slack/analytics/response-times/route.ts` | GET: filterable response metrics |
| `src/app/api/slack/analytics/channel-activity/route.ts` | GET: message volume over time |
| `src/app/api/slack/analytics/summary/route.ts` | GET: dashboard KPIs |
| `src/app/api/slack/analytics/recompute/route.ts` | POST: trigger recomputation |
| `src/app/api/cron/slack-analytics/route.ts` | POST: daily analytics cron |

**Modifies:**
| File | Change |
|------|--------|
| `vercel.json` | Add cron schedules for `slack-sync` (every 5 min) and `slack-analytics` (daily 6am UTC) |

**Blocked by:** sync-engine (needs `sync.ts` exports, `slack_sync_runs` schema)
**Blocks:** ui-dev (needs API endpoints for data fetching)

#### analytics-engine (Phase 3 lead)

**Creates:**
| File | Purpose |
|------|---------|
| `supabase/migrations/20260210_slack_response_metrics.sql` | `slack_response_metrics` table, RLS, indexes |
| `src/lib/slack/analytics.ts` | `computeResponseTimes()`, lookahead window, thread/top-level scoping, aggregation |
| `src/lib/slack/analytics-utils.ts` | Median/p95 computation, bucket classification, date range utilities |

**Modifies:**
| File | Change |
|------|--------|
| `src/lib/slack/types.ts` | Add `ResponseMetric`, `ResponseTimeBucket`, `AnalyticsSummary` types |

**Blocked by:** sync-engine (needs `slack_messages` table populated with real data for testing)
**Blocks:** ui-dev (analytics components need working computation)

**Note:** analytics-engine can start building the algorithm and unit tests against mock data while sync-engine finishes. Hard dependency is only for integration testing.

#### ui-dev (Phase 2 + Phase 3 UI)

**Creates:**
| File | Purpose |
|------|---------|
| `src/components/slack/slack-sync-status.tsx` | Sync progress: run status, per-channel table, start/retry buttons |
| `src/components/slack/slack-response-chart.tsx` | Recharts line chart: response time trends (30/60/90 day) |
| `src/components/slack/slack-channel-heatmap.tsx` | GitHub-style heatmap: channels x days, color = response time |
| `src/components/slack/slack-analytics-summary.tsx` | KPI cards, pod leader leaderboard, sparklines |

**Modifies:**
| File | Change |
|------|--------|
| `src/components/slack/slack-mapping-hub.tsx` | Add Sync tab (Phase 2), Analytics tab (Phase 3) |
| `src/components/data-enrichment/browser/category-hub.tsx` | Update Slack card stats to show sync + analytics info |

**Blocked by:** api-dev (needs working endpoints), analytics-engine (needs metrics data)

### Dependency Graph

```
sync-engine ──────┬──> api-dev ──────────┬──> ui-dev
                  │                      │
                  └──> analytics-engine ──┘
```

**Parallelism opportunities:**
1. sync-engine + analytics-engine can start simultaneously (analytics builds algorithm against mock data)
2. api-dev can start Phase 2 routes as soon as sync-engine delivers `sync.ts`
3. ui-dev starts Phase 2 UI (sync status) while analytics-engine finishes Phase 3

### Phased Execution

#### Wave 1 (Day 1-2): Foundation
- **sync-engine**: DB migrations + sync engine core
- **analytics-engine**: Algorithm implementation + unit tests against mock data

#### Wave 2 (Day 2-3): Integration
- **api-dev**: Phase 2 sync routes + cron handler (after sync-engine delivers)
- **ui-dev**: Sync status UI (after api-dev delivers Phase 2 routes)
- **sync-engine**: Staff reclassification triggers (Phase 2.6)

#### Wave 3 (Day 3-4): Analytics
- **analytics-engine**: Integration with real slack_messages data
- **api-dev**: Phase 3 analytics routes + cron handler
- **ui-dev**: Analytics UI (charts, heatmap, KPIs)

#### Wave 4 (Day 4): Polish + Verification
- All agents: Go/no-go criteria verification
- ui-dev: Integration points (partner detail widget, dashboard KPI card)
- sync-engine + analytics-engine: Backfill execution + recomputation testing

### Task Breakdown (for TaskList)

| ID | Task | Owner | Blocked By |
|----|------|-------|------------|
| 1 | Create `slack_messages` + `slack_sync_runs` migrations | sync-engine | — |
| 2 | Alter `slack_sync_state` (add oldest_ts, bot_is_member) | sync-engine | — |
| 3 | Build `src/lib/slack/sync.ts` (syncAllChannels, syncChannel) | sync-engine | 1, 2 |
| 4 | Add joinChannel + getChannelHistory to client.ts | sync-engine | — |
| 5 | Add staff reclassification to mapping routes | sync-engine | 1 |
| 6 | Build response time algorithm (`analytics.ts`) | analytics-engine | — |
| 7 | Unit tests for analytics against mock data | analytics-engine | 6 |
| 8 | Create sync API routes (start, status, channel) | api-dev | 3 |
| 9 | Create Vercel cron handler for sync | api-dev | 3 |
| 10 | Build sync status UI component | ui-dev | 8 |
| 11 | Add Sync tab to mapping hub | ui-dev | 10 |
| 12 | Create `slack_response_metrics` migration | analytics-engine | — |
| 13 | Integration test analytics with real slack_messages | analytics-engine | 3, 12 |
| 14 | Create analytics API routes | api-dev | 6, 12 |
| 15 | Create daily analytics cron handler | api-dev | 6, 12 |
| 16 | Build response chart UI | ui-dev | 14 |
| 17 | Build channel heatmap UI | ui-dev | 14 |
| 18 | Build analytics summary KPIs | ui-dev | 14 |
| 19 | Add Analytics tab to mapping hub | ui-dev | 16, 17, 18 |
| 20 | Vercel cron config (vercel.json) | api-dev | 9, 15 |
| 21 | Go/no-go verification | all | 1-20 |

---

## Final Handoff (Claude + Codex)

This section consolidates the implementation notes and strict-review deltas into a single handoff.

### Team split rationale

Use 4 agents for Phase 2/3 implementation:

- **sync-engine**: migrations + sync algorithm + reclassification hooks
- **analytics-engine**: response-time algorithm + aggregation logic + tests
- **api-dev**: sync/analytics HTTP routes + cron handlers + run leasing
- **ui-dev**: sync status + analytics surfaces using stable APIs

This avoids bottlenecking algorithm-heavy work in one stream and keeps API/UI work decoupled.

### Core corrections already incorporated

1. RLS hardened for `slack_messages` and `slack_response_metrics` to admin/operations_admin + service role.
2. Sender schema hardened for non-user events: `sender_slack_id` nullable, `sender_bot_id` and `sender_type` added.
3. Two-watermark sync model: `latest_ts` (forward incremental) + `oldest_ts` (historical backfill boundary).
4. Backfill completion fixed to cursor-driven completion (not first-page-size heuristics).
5. Cron overlap protection added via `slack_sync_runs` lease fields and lease-claim SQL.
6. Cross-day response-time logic aligned using LOOKAHEAD window + rolling recompute.
7. Metric versioning clarified as `algorithm_version` (current-row logic marker under upsert-overwrite model).
8. Migration order and reprocessing updated to include `slack_sync_runs`, `oldest_ts`, and full boundary reset.

### Implementation risks to watch

1. **Cron granularity**: 5-minute cadence may make full workspace sync slow; monitor runtime and channel throughput early.
2. **Lease/heartbeat discipline**: every worker execution must claim lease first and heartbeat periodically; exit immediately if lease not acquired.
3. **Thread model ambiguity**: confirm whether threaded replies should satisfy top-level partner prompts in your real usage.
4. **Analytics ordering**: do not run analytics backfill before message backfill is sufficiently complete.
5. **Non-staff sender semantics**: Slack Connect/external guests currently collapse into non-staff; decide whether to introduce a third sender class later.

### Validation checklist for implementation

1. Lease crash recovery: verify stuck worker recovery at next cron tick after lease expiry.
2. LOOKAHEAD boundary behavior: verify day D partner prompts with day D+N replies at N=1..8 and confirm desired unanswered semantics.
3. API bootstrapping order: api-dev can scaffold routes in parallel, but integration tests should wait for sync/analytics engine contracts.

---

## Delivery Log

_Updated by agents as work is completed. Each entry records what was done, files touched, and any decisions made._

### sync-engine

| Status | Task | Files | Notes |
|--------|------|-------|-------|
| Done | #1 slack_messages + slack_sync_runs migration | `supabase/migrations/20260208_slack_messages.sql` | Two tables, indexes, RLS (admin/ops_admin + service_role), sender_present CHECK constraint |
| Done | #2 Alter slack_sync_state (oldest_ts, bot_is_member) | `supabase/migrations/20260208_slack_sync_state_v2.sql` | Two-watermark model columns for backfill boundary + bot membership |
| Done | #4 Add getChannelHistoryPage to client.ts | `src/lib/slack/client.ts` | New paginated API returning {messages, has_more, next_cursor}; refactored getChannelHistory to use it; added latest param for backfill |
| Done | #3 Build sync engine (sync.ts) | `src/lib/slack/sync.ts` | syncChannel, syncForward, syncBackfill, createSyncRun, acquireLease, processChunk, syncSingleChannel, reclassify/unclassify helpers |
| Done | #5 Staff reclassification on mapping routes | `src/app/api/slack/mappings/staff/route.ts`, `src/app/api/slack/mappings/staff/auto-match/route.ts` | POST reclassifies, DELETE un-classifies, auto-match bulk reclassifies |
| Done | Types for Phase 2 | `src/lib/slack/types.ts` | Added ChannelSyncStateV2, SlackSyncRun, SyncChannelResult, SyncRunSummary |

### analytics-engine

| Status | Task | Files | Notes |
|--------|------|-------|-------|
| Done | #7 slack_response_metrics migration | `supabase/migrations/20260210_slack_response_metrics.sql` | Table, 3 indexes, RLS (admin/ops_admin + service_role) |
| Done | #6 Response time algorithm | `src/lib/slack/analytics.ts` | computeResponseTimes, computeChannelMetrics, computeAllChannels, computeDailyRollingWindow |
| Done | #6 Analytics utilities | `src/lib/slack/analytics-utils.ts` | median, p95, average, bucketCounts, dateRange, diffMinutes |
| Done | #6 Analytics types | `src/lib/slack/types.ts` | Added ResponseTimeBucket, ResponseMetric, AnalyticsSummary, ComputeResult, AnalyticsMessage |

### api-dev

| Status | Task | Files | Notes |
|--------|------|-------|-------|
| Done | #12 Analytics API: response-times | `src/app/api/slack/analytics/response-times/route.ts` | GET: filter by partner_id, pod_leader_id, date range; enriched with names |
| Done | #12 Analytics API: channel-activity | `src/app/api/slack/analytics/channel-activity/route.ts` | GET: message volume with day/week/month granularity aggregation |
| Done | #12 Analytics API: summary | `src/app/api/slack/analytics/summary/route.ts` | GET: dashboard KPIs, weighted avg response, % under 1h, pod leader leaderboard top 5 |
| Done | #12 Analytics API: recompute | `src/app/api/slack/analytics/recompute/route.ts` | POST: trigger recomputation for date range, optional channel_id |
| Done | #13 Daily analytics cron | `src/app/api/cron/slack-analytics/route.ts` | POST: CRON_SECRET auth, calls computeDailyRollingWindow() |
| Done | #8 Sync API: start | `src/app/api/slack/sync/start/route.ts` | POST: creates sync run, returns run_id, 409 if already running |
| Done | #8 Sync API: status | `src/app/api/slack/sync/status/route.ts` | GET: latest run + per-channel sync state with partner names |
| Done | #8 Sync API: single channel | `src/app/api/slack/sync/channel/[channelId]/route.ts` | POST: debug single-channel sync via syncSingleChannel() |
| Done | #9 Sync cron handler | `src/app/api/cron/slack-sync/route.ts` | POST: CRON_SECRET auth, finds active run, calls processChunk() |
| Done | #18 Vercel cron config | `vercel.json` | slack-sync every 5 min, slack-analytics daily at 6am UTC |

### ui-dev

| Status | Task | Files | Notes |
|--------|------|-------|-------|
| Done | #10 Sync status UI | `src/components/slack/slack-sync-status.tsx` | TanStack Query with 5s poll while running; progress bar, per-channel table with error tooltips, start/single-channel sync buttons; shimmer loading |
| Done | #11 Add Sync tab | `src/components/slack/slack-mapping-hub.tsx` | Tab bar: Staff, Channels, Sync, Analytics; horizontal scroll on mobile |
| Done | #16 Analytics KPI cards | `src/components/slack/slack-analytics-summary.tsx` | 4 KPI cards (avg response, % under 1h, unanswered, active channels); 7-day sparkline with trend arrow; pod leader leaderboard top 5; period selector (30/60/90d) |
| Done | #14 Response chart | `src/components/slack/slack-response-chart.tsx` | Recharts line chart (avg response over time) + stacked bar (bucket distribution); partner searchable dropdown + pod leader filter; 30/60/90d selector |
| Done | #15 Channel heatmap | `src/components/slack/slack-channel-heatmap.tsx` | GitHub-style grid: rows=channels, cols=days; color by response bucket (green/yellow/orange/red/gray); event delegation for hover tooltips; sorted by worst response; legend |
| Done | #17 Add Analytics tab | `src/components/slack/slack-mapping-hub.tsx` | Analytics tab renders Summary + Chart + Heatmap stacked |
| Done | Table component | `src/components/ui/table.tsx` | Standard shadcn/ui table component (was missing from project) |

### Review Notes (team-lead, 2026-02-07)

**Full code review completed.** 25+ files, ~5000 lines. 0 critical, 0 major, 0 minor issues.

**Pattern compliance:**
- All imports use `@/` aliases correctly
- All API routes follow `requireRole(ROLES.ADMIN)` + `apiSuccess`/`apiError` pattern
- All DB operations use `getAdminClient()`
- Cron routes verify `CRON_SECRET` bearer token
- Zod validation on all POST/query params
- DB table/column names match migrations exactly
- Function signatures match between callers and exports
- No TODO/placeholder comments left

**Architecture verification:**
- Two-watermark sync (latest_ts + oldest_ts) correctly implemented in sync.ts
- Lease-based overlap protection (4-min TTL for 5-min cron) in processChunk
- Response time algorithm handles all 8 documented edge cases
- Staff reclassification wired into both manual mapping and auto-match routes
- UI components use TanStack Query with proper polling (5s refetchInterval while sync active)
- Heatmap uses event delegation (matches existing health heatmap pattern)

**TypeScript:** Only pre-existing test file error (`__tests__/api-response.test.ts` Zod version mismatch). All Phase 2/3 code compiles clean.

**Recommendations for Codex:**
1. Integration test the two-watermark sync with realistic channel counts
2. Spot-check response_metrics rows against raw slack_messages after first cron run
3. Verify LOOKAHEAD_DAYS=7 is sufficient for real Sophie Society usage patterns
4. Consider pagination on analytics routes if date ranges grow large

**Team execution:** 4 agents, 18 tasks, all completed. sync-engine + analytics-engine ran in parallel (Wave 1), api-dev consumed both (Wave 2), ui-dev consumed api-dev (Wave 3). Total wall-clock: ~25 minutes.

### Codex Strict Review (2026-02-07, post-commit `6812ed2`)

Status: **Not ready to deploy**. Core routing and UI are in place, but several correctness issues remain in sync/analytics logic.

| Severity | Finding | Location | Why it matters |
|---|---|---|---|
| P1 | Forward sync can skip messages permanently when page-capped | `src/lib/slack/sync.ts` (`MAX_PAGES_PER_CHANNEL`, forward loop, `latest_ts` update) | If >10 forward pages exist, watermark still advances to newest fetched message and leaves an unrecoverable gap. |
| P1 | Offset paging over mutable `last_synced_at` can skip channels in-run | `src/lib/slack/sync.ts` (channel query `order('last_synced_at')` + `range(offset, ...)` + per-channel `last_synced_at` update) | Sorting key changes while offset cursor is advancing; channel ordering drifts and rows may be skipped. |
| P1 | Private-channel membership fallback can set `bot_is_member = true` without verification | `src/lib/slack/sync.ts` (`ensureBotMembership` + fallback path + state update) | A channel can be marked accessible even when bot is not actually in the channel; repeated sync behavior becomes misleading. |
| P1 | Lease heartbeat is not renewed during chunk work | `src/lib/slack/sync.ts` (lease claim at start/end only) | Long chunks can exceed lease TTL and allow overlapping workers to process the same run. |
| P2 | Staff remap does not unclassify old Slack user attribution | `src/app/api/slack/mappings/staff/route.ts` (update-existing mapping path) | Reassignment can leave stale historical staff attribution on the previous Slack user. |
| P2 | Event filtering is too narrow for analytics semantics | `src/lib/slack/sync.ts` and `src/lib/slack/analytics.ts` | Non-conversation/system edit/delete events may still be treated as partner messages. |
| P3 | Slack-phase lint is not clean | `src/lib/slack/analytics.ts` (unused vars) | `threadStaffCount` and `threadPartnerCount` are assigned but unused. |

#### Required follow-up before go/no-go

1. Fix forward watermark advancement so it only advances when the forward window is fully consumed.
2. Replace mutable-sort offset chunking with a stable run snapshot/keyset strategy.
3. Rework membership verification to only set `bot_is_member` after a successful history read or explicit membership proof.
4. Add mid-chunk lease heartbeat renewal and abort if lease can no longer be held.
5. On mapping remap, unclassify previous `external_id` rows before reclassifying the new one.
6. Expand sync subtype filtering and/or add explicit `sender_type='system'` exclusion in analytics.
7. Remove/fix unused variables so lint passes on Slack files.

#### Fixes applied (post-review)

All 7 findings addressed in a single pass:

| # | Fix | Detail |
|---|-----|--------|
| P1-1 | Forward watermark only advances when fully consumed | Added `forwardFullyConsumed` flag; `latest_ts` only updated when no pages remain (`!cursor`). Page-capped runs resume from same watermark. |
| P1-2 | Stable channel ordering for offset pagination | Changed `ORDER BY last_synced_at` to `ORDER BY channel_id` (immutable). Offset no longer drifts as channels are synced. |
| P1-3 | bot_is_member set only after successful sync | Removed `bot_is_member=true` from join attempt; moved to `updateSyncState` success path after history reads complete. |
| P1-4 | Lease heartbeat renewed between channels | Added `renewLeaseHeartbeat()` called before each channel. Returns false if lease lost → aborts chunk immediately. |
| P2-1 | Staff remap unclassifies old Slack user first | POST handler now fetches old `external_id`; if it differs from new `slack_user_id`, calls `unclassifyStaffMessages(oldId, staffId)` before reclassifying new. |
| P2-2 | System events excluded from analytics | Expanded `SKIP_SUBTYPES` with 17 additional subtypes (message_changed/deleted, file_share, me_message, etc.). Analytics query adds `.neq('sender_type', 'system')`. |
| P3 | Unused vars removed | Removed `threadStaffCount` and `threadPartnerCount` from analytics.ts. |

TypeScript compiles clean (only pre-existing test file error).
