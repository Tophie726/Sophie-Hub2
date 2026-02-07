# Google Workspace Connector — Claude Agent Plan

Round 02 of the Codex <-> Claude review loop.
Produced by applying `connector-rollout-playbook` to `00-context.md` + `01-codex-proposal.md`.

---

## A) Business Goal

- **Why this connector exists:** Google Workspace is the authoritative source for staff email addresses, account status, and basic profile data. Building this connector makes the directory the canonical identity anchor for all downstream connectors (Slack, BigQuery, Close, Zoho) and reduces manual staff onboarding/offboarding effort.
- **Decisions/metrics this unlocks:**
  - Automatic staff identity matching for every future connector (email is the universal join key).
  - Detect onboarding gaps (Google account exists, no staff record) and offboarding drift (staff active, Google suspended).
  - Enrich staff records with org unit, job title, phone, and manager from directory.
- **Success in the next 2-4 weeks:**
  - Admin connects Google Workspace via service account.
  - Auto-match maps 90%+ of directory users to existing staff by email.
  - Offboarded/suspended users visible and flagged, never dropped.
  - Staff profile enrichment (title, phone, org unit) working via one-click action.

---

## B) Source Model

- **External system:** Google Workspace Admin SDK — Directory API (`admin.googleapis.com`)
- **Authentication model:** Service account with domain-wide delegation. The service account impersonates a super-admin user to call the Directory API. No end-user OAuth flow required.
- **Plan/tier constraints:**
  - Rate limit: 2400 queries/min for the Directory API (effectively unlimited for directory-only use).
  - Domain-wide delegation requires Google Workspace admin consent (one-time setup).
  - Service account JSON key stored as env var (base64-encoded or multi-line).
- **Data pull mode:** Snapshot (full user list per sync). Directory is small enough (~120-200 users) that full pulls are cheaper and simpler than incremental token tracking. Future phases may add `syncToken` for delta detection.

---

## C) Linking Points (Identity Graph)

- **Link 1:** Google user primary email -> `staff.email` (exact match, case-insensitive)
- **Link 2:** Google user ID (immutable) -> `entity_external_ids` with `source: 'google_workspace_user'` (permanent anchor)
- **Link 3:** Google email aliases -> `entity_external_ids` with `source: 'google_workspace_alias'` (multi-value, secondary lookup)

**Matching precedence:**
1. Exact primary email match (highest confidence)
2. Exact alias email match (if primary didn't hit)
3. Manual review queue (no email match found)

---

## D) Mapping Rules + Cardinality

| Mapping Purpose | `source` | External ID | Internal Entity | Cardinality | Enforced In |
|---|---|---|---|---|---|
| Primary staff identity | `google_workspace_user` | Google user ID (e.g., `117...`) | `staff` | **1:1** | DB partial unique index |
| Email aliases | `google_workspace_alias` | Alias email address | `staff` | **1:N** (staff -> many aliases) | App logic (no DB unique on entity+source for this source) |

### Constraint implementation

**For `google_workspace_user` (1:1):**

Add to the existing partial unique index in `entity_external_ids`:

```sql
-- Update the existing partial unique index to include google_workspace_user
DROP INDEX IF EXISTS idx_entity_external_ids_one_to_one_sources;
CREATE UNIQUE INDEX idx_entity_external_ids_one_to_one_sources
  ON entity_external_ids(entity_type, entity_id, source)
  WHERE source IN ('bigquery', 'slack_user', 'google_workspace_user');
```

This ensures: one staff member can have at most one `google_workspace_user` mapping, and one Google user ID maps to at most one staff member (the existing `UNIQUE(source, external_id)` constraint handles the reverse direction).

**For `google_workspace_alias` (1:N):**

No additional DB constraint needed. The existing `UNIQUE(entity_type, entity_id, source, external_id)` already prevents duplicate alias rows. Multiple aliases per staff member are allowed because `external_id` differs per alias.

### onConflict strategy

- **Auto-match upsert:** `ON CONFLICT (source, external_id) DO UPDATE SET entity_id = $new, updated_at = now()`
- **Remap safety:** When a Google user is remapped to a different staff member, the old mapping row is updated (not deleted+inserted), preserving `created_at` for audit. The `metadata` JSONB should store `{ previous_entity_id, remapped_at }` on remap.
- **Alias refresh:** On each sync, aliases for a staff member are diffed against the directory response. Removed aliases are deleted from `entity_external_ids`. Added aliases are inserted. This prevents stale alias lookups.

### Required metadata per mapping

```typescript
// google_workspace_user metadata
{
  primary_email: string       // For display/debugging
  org_unit_path?: string      // e.g., "/Staff/Engineering"
  is_suspended: boolean       // Account status at map time
  is_admin: boolean           // Super-admin flag
  matched_by: 'auto_email' | 'auto_alias' | 'manual'
}

// google_workspace_alias metadata
{
  alias_type: 'primary' | 'alias'  // Whether this is the primary email or an alias
}
```

---

## E) Delivery Phases

### Phase 1: Connection + Mapping

**Scope:** Establish the Google Workspace connector, fetch directory users, auto-match to staff by email, support manual mapping for mismatches, and enrich staff profiles.

**Deliverables:**

1. **Connector type + config**
   - Add `'google_workspace'` to `ConnectorTypeId` in `src/lib/connectors/types.ts`
   - Define `GoogleWorkspaceConnectorConfig` (service account email, private key reference, impersonated admin email, domain)
   - Add type guard `isGoogleWorkspaceConfig()`

2. **Google Directory client**
   - Create `src/lib/google-workspace/client.ts` — wraps `googleapis` Admin SDK
   - `listUsers(domain, options?)` — paginated user list with `maxResults`, `query`, `showDeleted`
   - `getUser(userKey)` — single user by ID or email
   - Rate limiting: 2400 req/min ceiling, use 1 request/sec conservative default
   - Handle suspended/deleted users: include them with status flags

3. **Connector class**
   - Create `src/lib/connectors/google-workspace.ts`
   - Extend `BaseConnector<GoogleWorkspaceConnectorConfig>`
   - Stub tabular methods (directory is not tabular)
   - Custom methods: `listDirectoryUsers()`, `getUserByEmail(email)`
   - Register in `src/lib/connectors/index.ts`

4. **Cache layer**
   - Create `src/lib/connectors/google-workspace-cache.ts`
   - Cache directory user list (TTL: 10 min, same as BigQuery)
   - Functions: `getCachedDirectoryUsers`, `setCachedDirectoryUsers`, `invalidateDirectoryUsersCache`
   - Add `GOOGLE_WORKSPACE_TTL` to `src/lib/constants.ts`

5. **API routes**

   | Route | Method | Purpose |
   |-------|--------|---------|
   | `/api/google-workspace/test-connection` | POST | Verify service account + delegation |
   | `/api/google-workspace/users` | GET | List directory users (cached) |
   | `/api/google-workspace/mappings/staff` | GET | Current staff-user mappings |
   | `/api/google-workspace/mappings/staff` | POST | Save manual mapping |
   | `/api/google-workspace/mappings/staff` | DELETE | Remove mapping |
   | `/api/google-workspace/mappings/staff/auto-match` | POST | Bulk auto-match by email |
   | `/api/google-workspace/enrich-staff` | POST | Pull profile data into staff table |

6. **DB migration**
   - `supabase/migrations/YYYYMMDD_google_workspace_connector.sql`
   - Update partial unique index to include `google_workspace_user`
   - No new tables needed for Phase 1 (uses `entity_external_ids` only)

7. **UI components**
   - `src/components/google-workspace/gws-connection-card.tsx` — connection test + status
   - `src/components/google-workspace/gws-staff-mapping.tsx` — mapping table (same pattern as `slack-staff-mapping.tsx`)
   - Add Google Workspace card to `category-hub.tsx`
   - Mapping table columns: Staff Name | Email | Google User | Status | Match Type | Actions
   - Suspended/deleted Google users shown with warning badge

8. **Auto-match algorithm**
   - Phase 1: Exact primary email match (case-insensitive)
   - Phase 2: Exact alias match for remaining unmatched
   - Phase 3: Unmatched list for manual review
   - Return `StaffAutoMatchSummary` (reuse shape from Slack)

**Validation tests:**
- [ ] `POST /test-connection` returns workspace domain name + user count
- [ ] `GET /users` returns all directory users including suspended
- [ ] Auto-match correctly pairs users by primary email
- [ ] Auto-match falls through to alias matching for users with non-primary emails in staff table
- [ ] Suspended users are visible and flagged, not filtered out
- [ ] Deleted users (showDeleted=true) appear with deletion status
- [ ] Enrichment updates `title`, `phone`, `timezone` (from org unit/address) without overwriting manually-set values
- [ ] Remapping a Google user to a different staff member does not leave a stale mapping
- [ ] Build compiles clean (`npm run build`)

**UI/design checks:**
- No layout shift when mapping table loads
- Touch-first interactions for mobile
- Accessible focus states on mapping action buttons
- No `transition: all` on animated elements

---

### Phase 2: Incremental Sync + Reconciliation

**Scope:** Add periodic sync that detects new users, removed users, email changes, and status transitions. Surface drift as a reconciliation report.

**Deliverables:**

1. **Sync state table**
   ```sql
   CREATE TABLE google_workspace_sync_state (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     domain TEXT NOT NULL UNIQUE,
     last_sync_at TIMESTAMPTZ,
     total_users INT DEFAULT 0,
     active_users INT DEFAULT 0,
     suspended_users INT DEFAULT 0,
     deleted_users INT DEFAULT 0,
     sync_token TEXT,                   -- For future incremental pulls
     error TEXT,
     created_at TIMESTAMPTZ DEFAULT now(),
     updated_at TIMESTAMPTZ DEFAULT now()
   );
   ```

2. **Drift detection algorithm**
   - On each sync, compare current directory snapshot to existing `entity_external_ids` mappings:
     - **New users:** Google user exists, no mapping row -> flag for auto-match or manual review
     - **Removed users:** Mapping row exists, Google user deleted -> flag (do NOT auto-delete mapping)
     - **Email changes:** Google user's primary email changed -> update `metadata.primary_email`, re-check staff email match
     - **Status changes:** User suspended/reinstated -> update `metadata.is_suspended`, surface in UI
   - Store drift report in `google_workspace_sync_state` metadata or separate `sync_events` JSONB

3. **Reconciliation UI**
   - Dashboard showing: last sync time, user counts, drift events since last sync
   - Drift event list: "3 new users found", "1 user suspended", "2 email changes"
   - Action buttons per event: "Auto-match", "Create staff record" (future), "Acknowledge"

4. **Sync API routes**

   | Route | Method | Purpose |
   |-------|--------|---------|
   | `/api/google-workspace/sync` | POST | Trigger full directory sync |
   | `/api/google-workspace/sync/status` | GET | Current sync state + drift report |

**Validation tests:**
- [ ] Re-running sync is idempotent (no duplicate mappings, no lost data)
- [ ] Email change on a Google user updates the mapping metadata, does not create a duplicate
- [ ] Suspended user retains mapping and staff record (historical integrity)
- [ ] Deleted user retains mapping with deletion flag
- [ ] New users without email match appear in unmatched queue
- [ ] Sync handles pagination correctly for domains with 200+ users

---

### Phase 3: Workflow Hooks (Optional)

**Scope:** Surface onboarding/offboarding suggestions based on directory state transitions. No automatic destructive changes.

**Deliverables:**

1. **Onboarding suggestions**
   - When sync detects a new Google user with no staff match: surface "New team member?" card in admin dashboard
   - Optional: pre-fill a draft staff record from directory data (name, email, title, department from org unit)

2. **Offboarding suggestions**
   - When sync detects a suspended user whose mapped staff record is still `active`: surface "Staff member may have left?" card
   - Suggestion only — admin confirms before any status change

3. **Webhook endpoint (stretch)**
   - `POST /api/google-workspace/webhook` — receives push notifications from Admin SDK
   - Requires domain verification and subscription setup
   - Not required for Phase 3 MVP; polling is sufficient

**Validation tests:**
- [ ] Suggestions fire only on explicit state transitions (not on every sync)
- [ ] No automatic status changes on staff records
- [ ] Suggestions are dismissible and don't re-surface after dismissal

---

### Phase 4: Operational Readiness

**Scope:** Document setup, verify monitoring, establish go/no-go criteria.

**Deliverables:**

1. **Documentation**
   - `src/docs/GOOGLE-WORKSPACE-CONNECTOR.md` — full implementation reference
   - `src/docs/GOOGLE-WORKSPACE-ROLLOUT-PLAN.md` — this plan, finalized
   - Update `src/docs/CONNECTOR-GUIDE.md` entity_external_ids source table

2. **Smoke test runbook**
   - Step-by-step first-run verification (see Section H)

3. **Monitoring**
   - Log sync errors to PostHog
   - Alert on 3 consecutive sync failures
   - Surface sync health in admin connector status UI

4. **Go/no-go checklist** (see Section I)

**Validation tests:**
- [ ] Non-author can execute setup using docs only
- [ ] Setup docs match actual env var names, scopes, and migration files
- [ ] Error states (bad credentials, missing delegation, revoked scopes) produce clear error messages

---

## F) Agent-Team Plan

### Wave 1 (Parallel — no dependencies)

**Agent: `schema-sync`**
- Tasks:
  - Add `google_workspace` to `ConnectorTypeId` and config types
  - Create `GoogleWorkspaceConnector` class with stubbed tabular methods + `listDirectoryUsers()`
  - Register connector in `index.ts`
  - Create cache module (`google-workspace-cache.ts`)
  - Write DB migration (update partial unique index for `google_workspace_user`)
  - Add `GOOGLE_WORKSPACE_TTL` to constants
- Blocks: `api-integration` (needs types + connector class)
- Blocks: `ui-ops` (needs types)

**Agent: `docs-dev`**
- Tasks:
  - Create `src/docs/GOOGLE-WORKSPACE-CONNECTOR.md` (architecture, API reference, mapping model)
  - Update `src/docs/CONNECTOR-GUIDE.md` source naming table with `google_workspace_user` and `google_workspace_alias`
  - Update `src/docs/CONNECTOR-PLAYBOOK.md` if any new patterns emerge
- Blocks: nothing (can run fully in parallel)

### Wave 2 (After Wave 1 `schema-sync` completes)

**Agent: `api-integration`**
- Tasks:
  - Create `src/lib/google-workspace/client.ts` (Admin SDK wrapper, pagination, rate limiting)
  - Create `src/lib/google-workspace/types.ts` (Google user types, sync types)
  - Build all Phase 1 API routes:
    - `POST /api/google-workspace/test-connection`
    - `GET /api/google-workspace/users`
    - `GET/POST/DELETE /api/google-workspace/mappings/staff`
    - `POST /api/google-workspace/mappings/staff/auto-match`
    - `POST /api/google-workspace/enrich-staff`
  - Implement auto-match algorithm (primary email -> alias -> manual queue)
  - Implement enrichment endpoint (title, phone, org unit -> staff table)
- Blocks: `ui-ops` (needs API routes for data fetching)

### Wave 3 (After Wave 2 `api-integration` completes)

**Agent: `ui-ops`**
- Tasks:
  - Create `src/components/google-workspace/gws-connection-card.tsx`
  - Create `src/components/google-workspace/gws-staff-mapping.tsx`
  - Add Google Workspace `CategoryCard` to `category-hub.tsx`
  - Handle `'google_workspace'` category in `SourceBrowser`
  - Wire auto-match + enrichment buttons
  - Show suspended/deleted users with warning badges
  - Apply `emil-design-engineering` quality checks
- Blocks: nothing (final wave for Phase 1)

### Dependency graph

```
Wave 1:  schema-sync ──┐     docs-dev (parallel, independent)
                        │
Wave 2:  api-integration ◄──┘
                        │
Wave 3:  ui-ops ◄───────┘
```

---

## G) Risks + Mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| 1 | Domain-wide delegation setup is confusing for admin | Medium | High (blocks all work) | Step-by-step setup guide with screenshots in Section H. Test connection endpoint gives specific error for missing delegation. |
| 2 | Service account private key too large for single env var | Medium | Medium | Support base64-encoded key in `GOOGLE_WORKSPACE_PRIVATE_KEY_BASE64` and decode at runtime. Document both options. |
| 3 | Email mismatch between Google primary email and staff table email | Low | Medium | Auto-match includes alias fallback. Unmatched queue surfaces mismatches for manual resolution. |
| 4 | Suspended users auto-matched create confusion | Low | Low | Show clear "Suspended" badge in mapping UI. Do not auto-enrich suspended users by default — require explicit opt-in. |
| 5 | Rate limit exceeded during large domain sync | Very Low | Low | 2400 req/min is very generous for directory. Conservative 1 req/sec pacing + page size of 100 keeps well under limit. |

---

## H) Manual Setup Handoff (Owner Actions)

### 1. Create Google Cloud project (if not already exists)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select the existing `sophie-society-reporting` project
3. Enable the **Admin SDK API**:
   - Navigate to APIs & Services > Library
   - Search for "Admin SDK API"
   - Click Enable

### 2. Create service account

1. Go to IAM & Admin > Service Accounts
2. Click "Create Service Account"
3. Name: `sophie-hub-directory` (or similar)
4. Skip optional role grants (no GCP roles needed, only Workspace delegation)
5. Click "Done"
6. Click the new service account > Keys > Add Key > Create New Key > JSON
7. Download the JSON key file

### 3. Configure domain-wide delegation

1. Copy the service account's **Client ID** (numeric, from service account details page)
2. Go to [Google Workspace Admin Console](https://admin.google.com)
3. Navigate to Security > Access and data control > API controls > Domain-wide delegation
4. Click "Add new" and enter:
   - **Client ID:** (paste from step 1)
   - **OAuth scopes:**
     ```
     https://www.googleapis.com/auth/admin.directory.user.readonly,
     https://www.googleapis.com/auth/admin.directory.group.readonly
     ```
5. Click "Authorize"

### 4. Required OAuth scopes

| Scope | Purpose | Required? |
|-------|---------|-----------|
| `admin.directory.user.readonly` | List and read user profiles | Yes |
| `admin.directory.group.readonly` | List groups (future use) | Optional (include now for forward compat) |

### 5. Environment variables

Add to `.env.local` and Vercel deployment:

```bash
# Google Workspace Directory Connector
GOOGLE_WORKSPACE_CLIENT_EMAIL=sophie-hub-directory@project-id.iam.gserviceaccount.com
GOOGLE_WORKSPACE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n"
GOOGLE_WORKSPACE_ADMIN_EMAIL=admin@sophiesociety.com   # Super-admin to impersonate
GOOGLE_WORKSPACE_DOMAIN=sophiesociety.com              # Primary domain to query
```

**Alternative for private key (if newlines cause issues):**
```bash
GOOGLE_WORKSPACE_PRIVATE_KEY_BASE64=<base64-encoded key>
```

Decode at runtime:
```typescript
const privateKey = process.env.GOOGLE_WORKSPACE_PRIVATE_KEY
  || Buffer.from(process.env.GOOGLE_WORKSPACE_PRIVATE_KEY_BASE64 || '', 'base64').toString('utf-8')
```

### 6. Migration files to apply

```bash
psql $DATABASE_URL -f supabase/migrations/YYYYMMDD_google_workspace_connector.sql
```

Contents:
- Update partial unique index to include `google_workspace_user` in the 1:1 source list

### 7. First smoke-test sequence

Run these in order after deployment:

| Step | Action | Expected result |
|------|--------|----------------|
| 1 | `POST /api/google-workspace/test-connection` | Returns `{ domain: "sophiesociety.com", userCount: N }` |
| 2 | `GET /api/google-workspace/users` | Returns array of directory users with email, status, org unit |
| 3 | `POST /api/google-workspace/mappings/staff/auto-match` | Returns match summary: `{ matched: ~N, unmatched_staff: [...], unmatched_google_users: [...] }` |
| 4 | `POST /api/google-workspace/enrich-staff` | Returns `{ enriched: N, fields_updated: { title: X, phone: Y } }` |
| 5 | Verify in DB: `SELECT * FROM entity_external_ids WHERE source = 'google_workspace_user'` | Rows exist matching staff to Google user IDs |
| 6 | Open CategoryHub > Google Workspace card | Shows connection status + mapping stats |

---

## I) Operational Go/No-Go

- [ ] Service account auth and connection test pass
- [ ] Auto-match completes with expected match rate (>90% for known domain)
- [ ] Suspended/deleted users visible in mapping UI with correct status badges
- [ ] Enrichment updates staff records without overwriting manually-set values
- [ ] Remapping a Google user to a different staff member leaves no stale mapping
- [ ] Alias mappings correctly support 1:N (one staff -> many aliases)
- [ ] `entity_external_ids` partial unique index updated and verified
- [ ] Build compiles clean
- [ ] Docs reflect actual routes, scopes, env vars (no drift)
- [ ] Non-author can execute setup using Section H only

---

## J) Open Questions and Assumptions

### Open questions (from Codex proposal)

1. **Should unmatched Google users auto-create draft staff records?**
   - Current recommendation: No for Phase 1. Surface as "unmatched" in reconciliation UI. Phase 3 may add "Create staff record" suggestion.

2. **Should non-`@sophiesociety.com` accounts be included by default?**
   - Current recommendation: No. Filter to `GOOGLE_WORKSPACE_DOMAIN` by default. Add an admin toggle to include other domains if needed later.

3. **Should suspended accounts auto-set staff status, or suggest-only?**
   - Current recommendation: Suggest-only. Surface a reconciliation card. No automatic status changes until explicitly approved by admin.

### Additional open questions

4. **Should we reuse the existing `staff.slack_id` pattern and add `staff.google_workspace_id`?**
   - Recommendation: No. The `entity_external_ids` table is the canonical external ID store. Adding columns per connector was the old pattern. Use `entity_external_ids` consistently.

5. **Can we reuse the same Google Cloud project as BigQuery (`sophie-society-reporting`)?**
   - Likely yes. The service account just needs the Admin SDK API enabled and domain-wide delegation. Confirm with admin.

6. **What org unit structure does Sophie Society use?**
   - Unknown. The connector should handle flat (all users in `/`) and nested org units. Org unit path stored in mapping metadata for future filtering.

### Assumptions made

- Parent connector ID is `google_workspace` with future sub-modules (Calendar, Gmail) sharing the same service account.
- Phase 1 covers directory users only. No message or calendar data ingestion.
- Offboarded/suspended users remain visible in all UIs for historical identity integrity.
- Non-Sophie domains are excluded from auto-match unless the admin explicitly enables them.
- The Admin SDK rate limit (2400 req/min) is more than sufficient for a ~120-200 user directory. No batching/chunking needed.
- The `googleapis` npm package is used for the Admin SDK client (standard Google-maintained library).
- Staff enrichment follows the same pattern as Slack: always update `avatar_url`; only set `title` and `phone` if currently empty in the staff record.
- Google profile photo URL from directory can be used for `staff.avatar_url` if no Slack avatar exists.

---

## Delivery Log

| Date | Action | Files | Decision |
|------|--------|-------|----------|
| 2026-02-06 | Round 02: Claude agent plan produced | `02-claude-agent-plan.md` | Plan follows rollout template sections A-J. Phase 1 scoped to directory mapping + enrichment only. |

---

*Next step: Submit to Codex for review as `03-codex-review.md`.*
