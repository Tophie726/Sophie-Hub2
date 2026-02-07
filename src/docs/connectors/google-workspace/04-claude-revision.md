# Google Workspace Connector — Claude Revision (Round 04)

Revision target:
- `src/docs/connectors/google-workspace/03-codex-review.md`

Updated plan source:
- `src/docs/connectors/google-workspace/02-claude-agent-plan.md`

---

## Finding Response Table

| Finding ID | Severity | Status | What changed | Why this resolves it | Remaining risk |
|---|---|---|---|---|---|
| 1 — Secret boundary | P1 | **fixed** | Connector config now contains only `domain` and `mode` flags. All credentials are env-only. Config type, setup handoff, and API routes updated. | Secrets never enter config objects, DB, or client payloads. No serialization path exists. | None — env-only is the same pattern used by Slack (`SLACK_BOT_TOKEN`). |
| 2 — Alias remap risk | P1 | **fixed** | Alias upsert no longer auto-transfers `entity_id`. Aliases are insert-or-skip; reassignment requires matching the immutable `google_workspace_user` anchor first. Alias matching downgraded to "suggested" status until confirmed. | Prevents silent staff identity transfer via reused alias. Immutable user ID is the only auto-transfer authority. | Edge case: if a Google user is deleted and their alias reassigned to a new user, the old alias row becomes orphaned. Handled by alias refresh diff (delete stale, insert new). |
| 3 — UI routing seam | P2 | **fixed** | Plan now correctly targets `data-enrichment/page.tsx` (the page controller) for category routing, not `SourceBrowser`. Adds `'google_workspace'` to `DataBrowserView` union and `handleSelectCategory`. | Matches actual codebase routing pattern (confirmed: `page.tsx:103` handles category → view mapping). | None. |
| 4 — Deleted-user retention | P2 | **fixed** | Added local directory snapshot table (`google_workspace_directory_snapshot`) that persists user state from each sync. Deleted users retained as local tombstones even when the API stops returning them. | Historical integrity guaranteed independent of Google's deleted-user retention window (typically 20 days). | Snapshot table grows linearly with user count per sync. Mitigated by keeping only latest snapshot per user (upsert on Google user ID). |
| 5 — Migration reversibility | P2 | **fixed** | Migration now includes preflight duplicate check, explicit down migration, and transactional wrapper. | Rollback is one command. Preflight prevents migration failure surprises from existing data. | None. |
| 6 — Missing non-goals | P3 | **fixed** | Added explicit non-goals section. | Prevents phase creep. | None. |
| 7 — Docs location inconsistency | P3 | **fixed** | Rollout plan and round docs stay under `src/docs/connectors/google-workspace/`. Root-level `GOOGLE-WORKSPACE-CONNECTOR.md` reserved for stable post-implementation reference only. | Consistent with review loop convention. | None. |

---

## Plan Deltas

### Delta 1: Connector Config — Secrets Removed (P1 fix)

**Old (02-claude-agent-plan.md Section E, deliverable 1):**
> Define `GoogleWorkspaceConnectorConfig` (service account email, private key reference, impersonated admin email, domain)

**New:**

```typescript
// src/lib/connectors/types.ts

interface GoogleWorkspaceConnectorConfig {
  domain: string                    // Primary Workspace domain (e.g., "sophiesociety.com")
  include_suspended: boolean        // Whether to include suspended users in listings (default: true)
  include_deleted: boolean          // Whether to query deleted users (default: false for Phase 1)
}

// Credentials are NEVER in config. Resolved at runtime from env:
//   GOOGLE_WORKSPACE_CLIENT_EMAIL
//   GOOGLE_WORKSPACE_PRIVATE_KEY (or _BASE64)
//   GOOGLE_WORKSPACE_ADMIN_EMAIL
```

**Client constructor updated:**

```typescript
// src/lib/google-workspace/client.ts

function getCredentials() {
  const clientEmail = process.env.GOOGLE_WORKSPACE_CLIENT_EMAIL
  const privateKey = process.env.GOOGLE_WORKSPACE_PRIVATE_KEY
    || Buffer.from(process.env.GOOGLE_WORKSPACE_PRIVATE_KEY_BASE64 || '', 'base64').toString('utf-8')
  const adminEmail = process.env.GOOGLE_WORKSPACE_ADMIN_EMAIL

  if (!clientEmail || !privateKey || !adminEmail) {
    throw new Error('Google Workspace credentials not configured. Set GOOGLE_WORKSPACE_CLIENT_EMAIL, GOOGLE_WORKSPACE_PRIVATE_KEY, and GOOGLE_WORKSPACE_ADMIN_EMAIL.')
  }

  return { clientEmail, privateKey, adminEmail }
}
```

**Setup handoff Section H updated:** Env vars section unchanged (already env-only). Added explicit note: "Credentials must NEVER be stored in database, connector config, or sent to the client."

---

### Delta 2: Alias Upsert — No Auto-Transfer (P1 fix)

**Old (02-claude-agent-plan.md Section D, onConflict strategy):**
> Auto-match upsert: `ON CONFLICT (source, external_id) DO UPDATE SET entity_id = $new`

**New:**

```
Alias matching strategy (revised):

1. For `google_workspace_user` (immutable ID, 1:1):
   - ON CONFLICT (source, external_id) DO UPDATE SET entity_id = $new
   - This is safe because Google user IDs are immutable and globally unique.
   - Remap = explicit admin action reassigning a Google user to a different staff member.

2. For `google_workspace_alias` (email, 1:N):
   - ON CONFLICT (source, external_id) DO NOTHING
   - If an alias already maps to a different staff member, do NOT auto-transfer.
   - Instead, flag as a conflict in the auto-match summary:
     { alias: "jane@...", current_staff: "Jane Doe", proposed_staff: "Janet Doe", action: "review_required" }
   - Admin resolves via manual mapping UI.

3. Alias refresh on sync:
   - For each Google user, fetch their current aliases from directory.
   - Compare to existing `google_workspace_alias` rows for the SAME staff member
     (confirmed via their `google_workspace_user` anchor).
   - Delete aliases no longer in directory for that user.
   - Insert new aliases for that user.
   - NEVER touch alias rows belonging to a different staff member.
```

**Auto-match algorithm updated (Section E, deliverable 8):**

```
Auto-match flow (revised):

Step 1: Exact primary email match (case-insensitive)
  → Creates google_workspace_user mapping (1:1, auto-transfer OK)
  → Creates google_workspace_alias mappings for all aliases (insert-only, no transfer)

Step 2: Alias match for remaining unmatched staff
  → Alias match is "suggested" status only
  → Returned in summary as: { suggested_alias_matches: [...] }
  → Admin confirms each suggested match before mapping is created
  → On confirm: creates google_workspace_user mapping, then alias mappings

Step 3: Unmatched list for manual review
  → No mappings created
```

---

### Delta 3: UI Routing Seam (P2 fix)

**Old (02-claude-agent-plan.md Section F, Wave 3 ui-ops):**
> Handle `'google_workspace'` category in `SourceBrowser`

**New:**

```
UI integration point (revised):

1. In `src/app/(dashboard)/admin/data-enrichment/page.tsx`:
   - Add 'google_workspace' to DataBrowserView type union
   - Add case in handleSelectCategory:
     } else if (category === 'google_workspace') {
       setBrowserView('google_workspace')
     }
   - Add render block:
     {browserView === 'google_workspace' && (
       <GoogleWorkspaceMappingHub onBack={() => setBrowserView('hub')} />
     )}

2. In `src/components/data-enrichment/browser/category-hub.tsx`:
   - Add 'google_workspace' to onSelectCategory type
   - Add CategoryCard for Google Workspace

3. SourceBrowser is NOT modified (it handles sheet-specific flows only).
```

---

### Delta 4: Deleted-User Retention (P2 fix)

**New table added to Phase 1 migration:**

```sql
-- Local directory snapshot for historical integrity
-- Retains user state even after Google deletes the account
CREATE TABLE google_workspace_directory_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_user_id TEXT NOT NULL UNIQUE,     -- Immutable Google user ID
  primary_email TEXT NOT NULL,
  full_name TEXT,
  org_unit_path TEXT,
  is_suspended BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,        -- Marked true when Google stops returning user
  is_admin BOOLEAN DEFAULT false,
  title TEXT,
  phone TEXT,
  thumbnail_photo_url TEXT,
  aliases TEXT[] DEFAULT '{}',
  last_seen_at TIMESTAMPTZ NOT NULL,       -- Last time this user appeared in a directory pull
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_gws_snapshot_email ON google_workspace_directory_snapshot(primary_email);

-- RLS: admin + service_role
ALTER TABLE google_workspace_directory_snapshot ENABLE ROW LEVEL SECURITY;
CREATE POLICY gws_snapshot_read ON google_workspace_directory_snapshot
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.email = current_setting('request.jwt.claims', true)::jsonb->>'email'
      AND s.role IN ('admin', 'operations_admin')
    )
    OR current_user = 'service_role'
  );
CREATE POLICY gws_snapshot_write ON google_workspace_directory_snapshot
  FOR ALL USING (current_user = 'service_role')
  WITH CHECK (current_user = 'service_role');
```

**Sync behavior:**

```
On each directory pull:
  1. Fetch all users from Google (including suspended, optionally deleted)
  2. For each user returned:
     - Upsert into google_workspace_directory_snapshot
     - Set last_seen_at = now(), is_deleted = false
  3. For snapshot rows NOT in the current pull:
     - If last_seen_at < (now - 24h): mark is_deleted = true
     - Do NOT delete the row — it's a tombstone
  4. Mapping UI and enrichment read from snapshot table
     (not directly from Google API) for consistency
```

**Impact on API routes:**
- `GET /api/google-workspace/users` reads from snapshot table (fast, no API call) with cache on top
- `POST /api/google-workspace/sync` triggers a fresh pull → updates snapshot → returns drift report
- Enrichment reads profile data from snapshot (already local)

---

### Delta 5: Migration Reversibility (P2 fix)

**Revised migration file:**

```sql
-- Migration: YYYYMMDD_google_workspace_connector.sql
-- Up migration for Google Workspace connector

BEGIN;

-- Preflight: check for duplicates that would violate the new index
DO $$
DECLARE
  dup_count INT;
BEGIN
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT entity_type, entity_id, source
    FROM entity_external_ids
    WHERE source IN ('bigquery', 'slack_user', 'google_workspace_user')
    GROUP BY entity_type, entity_id, source
    HAVING COUNT(*) > 1
  ) dupes;

  IF dup_count > 0 THEN
    RAISE EXCEPTION 'Preflight failed: % duplicate entity+source rows found for 1:1 sources. Resolve before migrating.', dup_count;
  END IF;
END $$;

-- 1. Update partial unique index to include google_workspace_user
DROP INDEX IF EXISTS idx_entity_external_ids_one_to_one_sources;
CREATE UNIQUE INDEX idx_entity_external_ids_one_to_one_sources
  ON entity_external_ids(entity_type, entity_id, source)
  WHERE source IN ('bigquery', 'slack_user', 'google_workspace_user');

-- 2. Create directory snapshot table
CREATE TABLE IF NOT EXISTS google_workspace_directory_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_user_id TEXT NOT NULL UNIQUE,
  primary_email TEXT NOT NULL,
  full_name TEXT,
  org_unit_path TEXT,
  is_suspended BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,
  is_admin BOOLEAN DEFAULT false,
  title TEXT,
  phone TEXT,
  thumbnail_photo_url TEXT,
  aliases TEXT[] DEFAULT '{}',
  last_seen_at TIMESTAMPTZ NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gws_snapshot_email
  ON google_workspace_directory_snapshot(primary_email);

ALTER TABLE google_workspace_directory_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY gws_snapshot_read ON google_workspace_directory_snapshot
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.email = current_setting('request.jwt.claims', true)::jsonb->>'email'
      AND s.role IN ('admin', 'operations_admin')
    )
    OR current_user = 'service_role'
  );

CREATE POLICY gws_snapshot_write ON google_workspace_directory_snapshot
  FOR ALL USING (current_user = 'service_role')
  WITH CHECK (current_user = 'service_role');

COMMIT;
```

**Down migration (rollback):**

```sql
-- Down migration: YYYYMMDD_google_workspace_connector_down.sql

BEGIN;

-- 1. Remove snapshot table
DROP TABLE IF EXISTS google_workspace_directory_snapshot CASCADE;

-- 2. Restore original partial unique index (without google_workspace_user)
DROP INDEX IF EXISTS idx_entity_external_ids_one_to_one_sources;
CREATE UNIQUE INDEX idx_entity_external_ids_one_to_one_sources
  ON entity_external_ids(entity_type, entity_id, source)
  WHERE source IN ('bigquery', 'slack_user');

-- 3. Clean up any google_workspace mappings (optional, manual)
-- DELETE FROM entity_external_ids WHERE source LIKE 'google_workspace_%';

COMMIT;
```

---

### Delta 6: Non-Goals Section (P3 fix)

**Added to plan (after Section A):**

```markdown
## Non-Goals (This Round)

- No Gmail message ingestion or email content analysis.
- No Google Calendar event syncing or availability data.
- No automatic staff record creation from unmatched directory users.
- No automatic staff status changes based on Google account status.
- No Google Groups membership syncing (Phase 2+ consideration).
- No multi-domain support (single GOOGLE_WORKSPACE_DOMAIN only).
- No OAuth user-level flows — service account only.
```

---

### Delta 7: Docs Location Convention (P3 fix)

**Revised Phase 4 documentation deliverables:**

```
Phase 4 documentation (revised):

- src/docs/connectors/google-workspace/GOOGLE-WORKSPACE-CONNECTOR.md
  → Full implementation reference (stable, post-implementation)
- src/docs/connectors/google-workspace/ROLLOUT-PLAN.md
  → Finalized rollout plan (evolved from FINAL-APPROVED-PLAN.md)
- src/docs/CONNECTOR-GUIDE.md
  → Update entity_external_ids source naming table only (minimal cross-reference)

All round documents (00 through FINAL) stay in
  src/docs/connectors/google-workspace/

No root-level GOOGLE-WORKSPACE-*.md files.
```

---

## Answers to Codex Open Questions

**Q1: Should unmatched alias candidates be "suggested only" unless confirmed against immutable user ID?**

Yes. Alias matches are now "suggested" status in the auto-match summary. They do not create mappings until the admin confirms them. Only `google_workspace_user` (immutable ID) mappings are auto-created from email match. See Delta 2.

**Q2: Should we store a compact snapshot table for directory state to guarantee historical visibility?**

Yes. Added `google_workspace_directory_snapshot` table. Each sync upserts current state; users missing from the pull are tombstoned (`is_deleted = true`) after 24h. The snapshot is the local source of truth for the mapping UI and enrichment. See Delta 4.

**Q3: Should `google_workspace_user` mappings be auto-created only for staff-confirmed matches, or support draft/unlinked records?**

Phase 1: auto-create only for staff-confirmed matches (primary email hit). Unmatched Google users appear in the UI as "unmatched" but do not get `entity_external_ids` rows. Phase 3 may add draft staff record creation as a suggestion workflow. No separate table needed — the snapshot table serves as the "known but unlinked" directory.

---

## Updated Open Questions and Assumptions

### Open questions (carried forward)

1. ~~Should unmatched Google users auto-create draft staff records?~~ Deferred to Phase 3. (Q3 answered)
2. ~~Should non-`@sophiesociety.com` accounts be included?~~ No for Phase 1. Config has `domain` field.
3. ~~Should suspended accounts auto-set staff status?~~ No. Suggest-only. (Q1 from 01 answered)
4. Can we reuse the `sophie-society-reporting` GCP project? Confirm with admin.
5. What org unit structure does Sophie Society use? Handle flat and nested.

### New questions from this round

6. Should the snapshot table store full directory history (append-only) or just latest state per user (upsert)? **Current decision: upsert (latest state only).** Append-only deferred unless audit requirements emerge.
7. Should alias conflict resolution happen inline in the auto-match summary page, or in a separate reconciliation view? **Current recommendation: inline in auto-match results page.** Simpler UX, fewer views.

### Assumptions (unchanged + additions)

All original assumptions from Round 02 carry forward, plus:
- Directory snapshot is upsert-per-user, not append-only.
- Aliases are "suggested" from auto-match; only immutable user ID mappings are auto-created.
- Credentials are strictly env-only. Connector config contains non-secret selectors only.
- Down migration is always provided alongside up migration.

---

## Gate Check

**Status: Ready for Codex re-review.**

- All P1 findings: **fixed** (2/2)
- All P2 findings: **fixed** (3/3)
- All P3 findings: **fixed** (2/2)
- All open questions from Round 03: **answered** (3/3)

No remaining blockers. If Codex confirms no new findings, the next step is to merge into `FINAL-APPROVED-PLAN.md`.

---

## Delivery Log

| Date | Action | Files | Decision |
|------|--------|-------|----------|
| 2026-02-06 | Round 02: Claude agent plan | `02-claude-agent-plan.md` | Initial plan sections A-J |
| 2026-02-06 | Round 03: Codex review | `03-codex-review.md` | 2 P1, 3 P2, 2 P3 findings |
| 2026-02-06 | Round 04: Claude revision | `04-claude-revision.md` | All 7 findings addressed. Added snapshot table, alias safety, migration rollback, non-goals, docs convention. |
