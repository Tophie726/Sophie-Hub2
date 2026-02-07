# Google Workspace Connector Context

## Request Summary

- Pull staff emails into data enrichment as a new connector.
- Keep offboarded/deactivated accounts visible (do not lose historical identity).
- Use this as a core source for staff identity reconciliation.
- Consider future sub-modules for Gmail and Calendar signals.

## Current Intent

- Start with Directory data only (email + account status + basic profile).
- Delay Gmail and Calendar ingestion until the identity foundation is stable.

## Constraints and Notes

- Not every staff member will have a Sophie email at all times.
- Some onboarders/offboarders will need manual workflow handling.
- Existing staff table already supports enrichment fields (`email`, `title`, `timezone`, `status`, etc.).
- Connector planning should follow Codex <-> Claude review loop in:
  - `src/docs/connectors/CONNECTOR-REVIEW-LOOP.md`

## Live Setup Checkpoint (2026-02-07)

### Completed in Google Cloud / Workspace

- Admin SDK API enabled in Google Cloud project `Sophie-HubV2`.
- Service account created: `sophie-google-workspace-connec@sophie-hubv2.iam.gserviceaccount.com`.
- JSON key generated and downloaded locally.
- Domain-wide delegation added in Google Admin Console with:
  - `https://www.googleapis.com/auth/admin.directory.user.readonly`
  - `https://www.googleapis.com/auth/admin.directory.group.readonly`

### Completed in Sophie Hub Local Env

- Added to `.env.local`:
  - `GOOGLE_WORKSPACE_CLIENT_EMAIL`
  - `GOOGLE_WORKSPACE_PRIVATE_KEY`
  - `GOOGLE_WORKSPACE_ADMIN_EMAIL=tomas@sophiesociety.com`
  - `GOOGLE_WORKSPACE_DOMAIN=sophiesociety.com`
- Existing Google OAuth / GSheets vars were intentionally left unchanged.
- `ADMIN_EMAILS` already contains `tomas@sophiesociety.com`.

### Current Validation State

- `npm run dev` restarted after env updates.
- Unauthenticated API curl returned `{"error":"Unauthorized"}` (expected when not using a real app session cookie).
- Remaining validation is authenticated UI/API smoke testing from a logged-in admin session.

### Lifecycle + Approval Rules (Implemented)

- Shared inbox accounts (for example `support@`, `admin@`, `customerservice@`) are excluded from staff auto-match.
- Auto-match excludes lifecycle-inactive staff records (for example statuses containing `departed`, `legacy_hidden`, `archived`).
- Unmatched person Google accounts are persisted to `staff_approval_queue` for admin review.
- Pending approvals are surfaced by:
  - `GET /api/google-workspace/staff-approvals`
  - `GET /api/google-workspace/sync/status` via `pending_staff_approvals`
- Creating a staff mapping resolves the corresponding pending approval candidate.
- Google Workspace “People” counts exclude shared inboxes and accounts mapped to inactive staff records.
- First-run bootstrap route exists for empty `/staff` datasets:
  - `POST /api/google-workspace/staff/bootstrap`

### Next Actions (Claude Handoff)

1. Open `http://localhost:3000` and sign in with an admin account.
2. Go to `/admin/data-enrichment` -> Google Workspace -> click **Test Connection**.
3. If Google returns `Not Authorized`, switch `GOOGLE_WORKSPACE_ADMIN_EMAIL` to a confirmed Google Workspace Super Admin and retest after propagation.
4. Run remaining smoke flow: `sync` -> `sync/status` -> `users` -> `staff/bootstrap` (if staff is empty) -> `auto-match` -> `enrich-staff`.
