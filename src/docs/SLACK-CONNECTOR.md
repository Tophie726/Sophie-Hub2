# Slack Connector

Implementation docs for the Slack data enrichment connector in Sophie Hub v2.

---

## 1. Overview

The Slack connector enriches Sophie Hub with three capabilities:

1. **Staff mapping** -- Link Slack user IDs to staff records (auto-match by email)
2. **Channel-partner mapping** -- Link Slack channels to partner records (pattern-based auto-match)
3. **Response time analytics** -- Measure how quickly staff respond to partner messages in mapped channels

Slack is a **non-tabular** connector. It extends `BaseConnector`, stubs the tabular interface (getTabs, getRawRows, getData), and exposes custom methods for users, channels, and message history.

---

## 2. Architecture

### Connector class

```
src/lib/connectors/slack.ts          -- SlackConnector (extends BaseConnector, stubs tabular, custom methods)
src/lib/connectors/slack-cache.ts    -- Module-level cache for users + channels
```

### Slack API client

```
src/lib/slack/client.ts              -- Rate-limited API wrapper (listUsers, listChannels, getChannelHistory, etc.)
src/lib/slack/types.ts               -- SlackUser, SlackChannel, SlackMessageMeta, mapping types
```

### Type registration

```
src/lib/connectors/types.ts          -- SlackConnectorConfig, 'slack' in ConnectorTypeId, isSlackConfig()
```

### Data flow

```
Slack Web API
  -> src/lib/slack/client.ts       (rate-limited fetch, pagination)
  -> src/lib/connectors/slack.ts   (connector methods)
  -> src/app/api/slack/*/route.ts  (API routes with auth + validation)
  -> UI components                 (mapping UIs, analytics dashboards)
```

---

## 3. Authentication

**Method:** Bot User OAuth Token (`xoxb-...`)

**Env var:** `SLACK_BOT_TOKEN`

The bot token is read from the environment in `src/lib/slack/client.ts`:

```typescript
function getBotToken(): string {
  const token = process.env.SLACK_BOT_TOKEN
  if (!token) {
    throw new Error('SLACK_BOT_TOKEN environment variable is not set')
  }
  return token
}
```

**Required OAuth scopes:**

| Scope | Purpose |
|-------|---------|
| `channels:read` | List public channels |
| `groups:read` | List private channels the bot is in |
| `users:read` | List workspace members |
| `users:read.email` | Access user email addresses (critical for staff auto-match) |
| `users.profile:read` | Access display names and avatars |
| `channels:history` | Read message history in public channels |
| `groups:history` | Read message history in private channels |
| `channels:join` | Join public channels to read history |

---

## 4. Database Tables

### Phase 1: `entity_external_ids` (existing)

No new tables needed for basic mapping. Uses two `source` values:

- `'slack_user'` -- maps `staff` entity to Slack user ID
- `'slack_channel'` -- maps `partners` entity to Slack channel ID

### Phase 1: `slack_sync_state`

Tracks per-channel sync progress for incremental message fetching.

```sql
CREATE TABLE slack_sync_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id TEXT NOT NULL UNIQUE,
  channel_name TEXT NOT NULL,
  partner_id UUID REFERENCES partners(id),
  latest_ts TEXT,                    -- Slack timestamp of most recent synced message
  is_backfill_complete BOOLEAN DEFAULT false,
  message_count INTEGER DEFAULT 0,
  last_synced_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Phase 2: `slack_messages`

Stores message metadata (NOT content) for response time calculation.

```sql
CREATE TABLE slack_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id TEXT NOT NULL,
  message_ts TEXT NOT NULL,           -- Slack's unique message timestamp
  thread_ts TEXT,                     -- Parent thread timestamp (NULL if top-level)
  sender_slack_id TEXT NOT NULL,
  sender_staff_id UUID,              -- Resolved via entity_external_ids
  sender_is_staff BOOLEAN NOT NULL,  -- true = Sophie staff, false = partner/external
  created_at TIMESTAMPTZ NOT NULL,   -- Parsed from message_ts

  CONSTRAINT slack_messages_unique UNIQUE(channel_id, message_ts)
);

CREATE INDEX idx_slack_messages_channel_ts ON slack_messages(channel_id, created_at);
CREATE INDEX idx_slack_messages_thread ON slack_messages(thread_ts) WHERE thread_ts IS NOT NULL;
```

### Phase 3: `slack_response_metrics`

Pre-computed response time metrics per channel per period.

```sql
CREATE TABLE slack_response_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id TEXT NOT NULL,
  partner_id UUID NOT NULL,
  pod_leader_id UUID,                -- Staff member responsible
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  avg_response_minutes REAL,
  median_response_minutes REAL,
  p95_response_minutes REAL,
  total_partner_messages INTEGER,
  total_staff_replies INTEGER,
  messages_without_reply INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT slack_response_metrics_unique
    UNIQUE(channel_id, period_start, period_end)
);
```

---

## 5. entity_external_ids Usage

The Slack connector uses **two source values** to map different entity relationships:

### `source: 'slack_user'` -- Staff mapping

```typescript
// Save: staff member -> Slack user
await supabase.from('entity_external_ids').upsert({
  entity_type: 'staff',
  entity_id: staffId,           // UUID from staff table
  source: 'slack_user',
  external_id: slackUserId,     // e.g., 'U06K3ABCDEF'
  metadata: {
    slack_name: user.real_name,
    slack_email: user.profile.email,
    match_type: 'auto',         // or 'manual'
  },
}, { onConflict: 'entity_type,entity_id,source' })

// Query: "Which staff member is Slack user U06K3ABCDEF?"
const { data } = await supabase
  .from('entity_external_ids')
  .select('entity_id')
  .eq('source', 'slack_user')
  .eq('external_id', 'U06K3ABCDEF')
  .single()
```

### `source: 'slack_channel'` -- Channel-partner mapping

```typescript
// Save: partner -> Slack channel
await supabase.from('entity_external_ids').upsert({
  entity_type: 'partners',
  entity_id: partnerId,         // UUID from partners table
  source: 'slack_channel',
  external_id: channelId,       // e.g., 'C06MABCDEF'
  metadata: {
    channel_name: channel.name,
    match_type: 'auto',
    match_confidence: 0.95,
  },
}, { onConflict: 'entity_type,entity_id,source' })

// Query: "Which partner owns channel C06MABCDEF?"
const { data } = await supabase
  .from('entity_external_ids')
  .select('entity_id')
  .eq('source', 'slack_channel')
  .eq('external_id', 'C06MABCDEF')
  .single()
```

---

## 6. Mapping Flows

### Staff auto-match (email)

1. Fetch all Slack users via `listUsers()` (excludes bots and deleted)
2. Fetch all staff from Supabase
3. Match by email (case-insensitive exact match)
4. Save matches to `entity_external_ids` with `source: 'slack_user'`
5. Return summary: total matched, unmatched staff, unmatched Slack users

```typescript
// In auto-match endpoint
const slackUsers = await listUsers()
const { data: staff } = await supabase.from('staff').select('id, full_name, email')

const staffByEmail = new Map(
  staff.map(s => [s.email.toLowerCase(), s])
)

for (const user of slackUsers) {
  const email = user.profile.email?.toLowerCase()
  if (!email) continue
  const staffMember = staffByEmail.get(email)
  if (staffMember) {
    // Save mapping
  }
}
```

### Channel auto-match (naming pattern)

1. Fetch all channels via `listChannels()`
2. Fetch all partners from Supabase
3. Apply naming convention pattern (e.g., `client-{brand_name}`)
4. Skip internal channels by prefix (e.g., `team-`, `ops-`, `general`)
5. Extract brand name from channel name, fuzzy-match against partner names
6. Save high-confidence matches, flag ambiguous matches for manual review

```typescript
// Pattern: "client-coat-defense" -> "coat defense" -> fuzzy match to "Coat Defense"
const prefix = 'client-'
for (const channel of channels) {
  if (!channel.name.startsWith(prefix)) continue
  const extracted = channel.name.slice(prefix.length).replace(/-/g, ' ')
  const match = fuzzyMatch(extracted, partners)
  if (match && match.confidence > 0.8) {
    // Save mapping
  }
}
```

### Manual mapping UI

For items that don't auto-match, the admin UI provides:

- List of unmatched Slack users / channels
- Searchable dropdown of Sophie Hub staff / partners
- One-click save per mapping
- Bulk operations for efficiency

---

## 7. Message Sync Strategy

### Incremental fetch

Messages are fetched incrementally using Slack's `conversations.history` endpoint with the `oldest` parameter.

```
First sync:  oldest = undefined  -> fetches all available history
Next syncs:  oldest = latest_ts  -> fetches only new messages since last sync
```

The `slack_sync_state` table tracks `latest_ts` per channel to enable incremental sync.

### Rate limiting

The Slack client (`src/lib/slack/client.ts`) enforces a minimum 1.2-second delay between API calls:

```typescript
const MIN_DELAY_MS = 1200

async function rateLimit(): Promise<void> {
  const now = Date.now()
  const elapsed = now - lastCallTime
  if (elapsed < MIN_DELAY_MS) {
    await new Promise(resolve => setTimeout(resolve, MIN_DELAY_MS - elapsed))
  }
  lastCallTime = Date.now()
}
```

This stays safely under Slack's Tier 3 limit (~50 req/min for `conversations.history`).

### Pagination

All list endpoints use cursor-based pagination with 200 items per page:

```typescript
const PAGE_SIZE = 200

let cursor: string | undefined
do {
  const params = { limit: PAGE_SIZE }
  if (cursor) params.cursor = cursor

  const data = await slackApi('conversations.history', params)
  // ... process messages

  cursor = data.response_metadata?.next_cursor || undefined
} while (cursor)
```

### What we store

Only message **metadata** -- never message content:

```typescript
interface SlackMessageMeta {
  ts: string           // Unique message timestamp
  thread_ts?: string   // Parent thread (null if top-level)
  user?: string        // Sender's Slack user ID
  bot_id?: string      // Bot ID if sent by a bot
  type: string         // Message type
  subtype?: string     // Message subtype
}
```

This is sufficient for response time calculation while avoiding storing sensitive conversation content.

---

## 8. Response Time Algorithm

### Goal

Measure how quickly Sophie staff respond to partner messages in mapped Slack channels.

### Steps

1. **Classify senders**: For each message in a mapped channel, determine if the sender is staff (via `entity_external_ids` with `source: 'slack_user'`) or partner/external

2. **Identify response pairs**: A staff message is a "reply" to a partner message if:
   - It appears in the same channel after the partner message
   - It's the first staff message after the partner message (no double-counting)
   - Threaded replies: staff reply in the same thread as the partner message

3. **Calculate response time**: `staff_message.ts - partner_message.ts` converted to minutes

4. **Attribute to pod leader**: The pod leader assigned to the partner (via `partner_assignments`) is credited with the response time, even if another staff member replied

5. **Aggregate per period**: Compute avg, median, p95 response times per channel per week/month and store in `slack_response_metrics`

### Edge cases

- **Bot messages**: Excluded from response time calculation (filtered by `bot_id`)
- **After-hours messages**: Partner message at 11pm, staff reply at 8am = counted as-is (future: business-hours filtering)
- **Multiple partner messages before reply**: Each partner message starts a new response window; the staff reply closes the most recent one
- **No reply**: Tracked as `messages_without_reply` in metrics

---

## 9. API Routes

All routes live under `src/app/api/slack/`.

### Phase 1: Connection + Mappings

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/slack/test-connection` | Test bot token, return workspace info |
| GET | `/api/slack/users` | List all Slack users (cached) |
| GET | `/api/slack/channels` | List all channels (cached) |
| POST | `/api/slack/mappings/staff/auto-match` | Run email-based auto-match for staff |
| GET | `/api/slack/mappings/staff` | Get all staff-Slack user mappings |
| POST | `/api/slack/mappings/staff` | Save/update a single staff mapping |
| DELETE | `/api/slack/mappings/staff?id={id}` | Remove a staff mapping |
| POST | `/api/slack/mappings/channels/auto-match` | Run pattern-based auto-match for channels |
| GET | `/api/slack/mappings/channels` | Get all channel-partner mappings |
| POST | `/api/slack/mappings/channels` | Save/update a single channel mapping |
| DELETE | `/api/slack/mappings/channels?id={id}` | Remove a channel mapping |

### Phase 2: Message Sync

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/slack/sync/start` | Start message sync for all mapped channels |
| GET | `/api/slack/sync/status` | Get sync progress per channel |
| POST | `/api/slack/sync/channel/[channelId]` | Sync a single channel |

### Phase 3: Analytics

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/slack/analytics/response-times` | Response time metrics by partner/period |
| GET | `/api/slack/analytics/summary` | Overall response time dashboard stats |

### Route pattern

All routes follow the standard Sophie Hub API conventions:

```typescript
import { requireRole } from '@/lib/auth/api-auth'
import { apiSuccess, ApiErrors } from '@/lib/api/response'
import { getCachedUsers, setCachedUsers } from '@/lib/connectors/slack-cache'
import { listUsers } from '@/lib/slack/client'

export async function GET() {
  const auth = await requireRole('admin')
  if (!auth.authenticated) return auth.response

  const cached = getCachedUsers()
  if (cached) {
    return apiSuccess({ users: cached, count: cached.length, cached: true })
  }

  const users = await listUsers()
  setCachedUsers(users)
  return apiSuccess({ users, count: users.length, cached: false })
}
```

---

## 10. Phasing

### Phase 1: Connection + Mappings

**Goal:** Connect to Slack, map users to staff, map channels to partners.

**Deliverables:**
- `SLACK_BOT_TOKEN` env var configuration
- Test connection endpoint
- Users list with caching
- Channels list with caching
- Staff auto-match by email
- Channel auto-match by naming pattern
- Manual mapping UI for unmatched items
- CategoryHub card for Slack
- `slack_sync_state` table migration

**No message reading in this phase** -- only user/channel metadata.

### Phase 2: Message Sync

**Goal:** Incrementally sync message metadata from mapped channels.

**Deliverables:**
- `slack_messages` table migration
- Incremental sync engine (per-channel, cursor-based)
- Sync status tracking in `slack_sync_state`
- Admin UI: trigger sync, view progress, view errors
- Sender classification (staff vs. partner/external)

### Phase 3: Analytics

**Goal:** Calculate and display response time metrics.

**Deliverables:**
- `slack_response_metrics` table migration
- Response time calculation engine
- Metrics aggregation (weekly/monthly)
- Pod leader attribution
- Dashboard widgets showing response times per partner
- Partner detail page: response time history

---

## 11. Slack App Setup

### Create the app

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click **Create New App** > **From scratch**
3. Name: `Sophie Hub` (or your workspace's preference)
4. Pick the workspace
5. Click **Create App**

### Configure bot scopes

1. Go to **OAuth & Permissions** in the sidebar
2. Under **Bot Token Scopes**, add:
   - `channels:read`
   - `groups:read`
   - `users:read`
   - `users:read.email`
   - `users.profile:read`
   - `channels:history`
   - `groups:history`
   - `channels:join`

### Install to workspace

1. Go to **Install App** in the sidebar
2. Click **Install to Workspace**
3. Authorize the requested permissions
4. Copy the **Bot User OAuth Token** (starts with `xoxb-`)

### Set the env var

Add to `.env.local`:

```bash
SLACK_BOT_TOKEN=xoxb-your-token-here
```

### Invite bot to private channels (optional)

The bot can see all public channels automatically. For private channels, a workspace member must invite the bot:

```
/invite @Sophie Hub
```

### Verify connection

After setting the token, call the test endpoint:

```bash
curl -H "Cookie: ..." http://localhost:3000/api/slack/test-connection
```

Expected response:

```json
{
  "success": true,
  "data": {
    "connected": true,
    "workspace_name": "Sophie Society",
    "bot_user_id": "U06XXXXXXXX"
  }
}
```
