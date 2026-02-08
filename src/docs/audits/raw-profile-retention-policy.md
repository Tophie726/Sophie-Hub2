# Raw Profile Retention Policy — Google Workspace Directory

**Status:** Active
**Created:** 2026-02-08
**Scope:** `google_workspace_directory_snapshot.raw_profile` column

---

## Overview

The `raw_profile` column in `google_workspace_directory_snapshot` stores the full Google Admin SDK API response for each directory user. This ensures **no data loss** during sync — fields not yet mapped to first-class columns are preserved for future use.

---

## Access Controls

| Control | Status |
|---------|--------|
| Browser-facing API excludes `raw_profile` | Active (Fix 2 — select projection) |
| RLS: admin + service_role read-only | Active (table-level RLS) |
| Server-side only access | Active |

The `/api/google-workspace/users` endpoint returns an explicit column projection that **excludes** `raw_profile`. The raw payload is never sent to the browser.

---

## Retention Strategy

| Tier | Window | Action |
|------|--------|--------|
| Active | 0–90 days | Full `raw_profile` stored |
| Archive | 90–365 days | Future: move to cold storage or set `raw_profile_archived_at` |
| Purge | 365+ days | Future: nullify `raw_profile` column for aged-out rows |

**Current state:** All tiers store full `raw_profile` indefinitely. Retention automation is a Phase 6 follow-up.

---

## Sensitive Field Redaction (Future)

After 30 days, the following fields should be stripped from `raw_profile`:

- `recoveryEmail`
- `recoveryPhone`
- `agreedToTerms`
- `ipWhitelisted`

This prevents unnecessary PII accumulation. Redaction is a future migration task.

---

## What `raw_profile` Contains

The full Google Admin SDK `users.get` response, including:

- Identity: name, email, aliases, photo URL
- Organization: department, title, cost center, manager
- Account state: suspended, admin, delegated admin, 2SV enrollment
- Custom schemas (if configured in Google Workspace)
- External IDs, recovery info, agreed-to-terms

Fields already mapped to first-class columns (e.g., `primary_email`, `title`, `department`) are **also** in `raw_profile` for provenance.

---

## Compliance Notes

- `raw_profile` is classified as **internal operational data**, not customer-facing PII
- Blast radius if DB is exposed: directory metadata for all Google Workspace users
- Mitigation: RLS, server-only access, explicit select projection in APIs
- Follow-up: add `raw_profile_archived_at` column and cron-based archival

---

## Follow-Up Items

| Item | Owner | Target |
|------|-------|--------|
| Add `raw_profile_archived_at` column | platform-team | Phase 6 |
| Implement 90-day archival cron | platform-team | Phase 6 |
| Sensitive field redaction after 30 days | platform-team | Phase 6 |
