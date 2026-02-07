# Google Workspace Connector Seed (Email-First)

## Recommendation

Start with one parent connector: `google_workspace`.

Within that connector, implement sub-modules over time:

- Directory module (Phase 1): user identity/email lifecycle
- Calendar module (later): availability/workload signals
- Gmail module (later): metadata-only communication metrics (if needed)

This keeps auth/setup simple and avoids fragmented Google connectors.

## Why Email-First Works

- Immediately improves staff enrichment with a trusted identity source.
- Gives a canonical employee directory for mapping and onboarding workflows.
- Supports offboarding visibility by preserving disabled/archived accounts.

## Proposed Linking Points

1. `google_workspace_user` -> `staff` by primary email (1:1 target)
2. `google_workspace_alias` -> optional secondary emails/aliases (1:N)
3. `google_workspace_org_unit` -> optional org mapping metadata (app-level)

## Minimum Phase 1 Scope

- Fetch users from Google Workspace directory API.
- Upsert staff profile basics by email.
- Track account state: active/suspended/deleted.
- Preserve records for offboarded users (do not hard-delete).
- Add reconciliation report: new users, matched users, unmatched users, stale staff emails.

## Open Design Choices

- Should unmatched Google users auto-create draft staff records or stay in a review queue?
- Should non-`@sophiesociety.com` accounts be excluded by default?
- Should suspended users set staff `status = inactive` automatically or only suggest it?

## Setup Handoff Preview

- Create Google Cloud project and enable Admin SDK.
- Configure domain-wide delegation and service account.
- Required scopes: directory users read-only, group read-only (if needed later).
- Add env vars for service credentials.
- Run initial smoke sync on small page size.
