# Google Workspace Connector - Setup Guide

Step-by-step walkthrough to get the Google Workspace connector running with live data.

---

## Prerequisites

- Access to Google Cloud Console with billing enabled
- Super admin access to your Google Workspace domain
- Sophie Hub `.env.local` file ready for new variables
- Supabase SQL editor access for connector migrations

---

## Step 0: Apply Google Workspace Migrations

Run these in order:

1. `supabase/migrations/20260207_google_workspace_connector.sql`
2. `supabase/migrations/20260207_staff_profile_enrichment.sql`
3. `supabase/migrations/20260211_staff_approval_queue.sql`
4. `supabase/migrations/20260212_google_workspace_snapshot_extended.sql`

Then notify PostgREST to reload schema:

```sql
select pg_notify('pgrst', 'reload schema');
```

---

## Step 1: Google Cloud Console - Enable Admin SDK API

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project (or create one). You can reuse `sophie-society-reporting` if preferred.
3. Navigate to **APIs & Services > Library** (left sidebar)
4. Search for **Admin SDK API**
5. Click on **Admin SDK API** in results
6. Click **Enable**
7. Wait for it to activate (takes a few seconds)

> If you already have BigQuery configured in this project, the project is fine to reuse. Each API is enabled independently.

---

## Step 2: Create a Service Account

1. In Google Cloud Console, go to **IAM & Admin > Service Accounts** (left sidebar)
2. Click **+ Create Service Account** at top
3. Fill in:
   - **Service account name**: `sophie-hub-directory` (or similar)
   - **Service account ID**: auto-fills (e.g., `sophie-hub-directory@your-project.iam.gserviceaccount.com`)
   - **Description**: "Sophie Hub - Google Workspace Directory API access"
4. Click **Create and Continue**
5. Skip the "Grant this service account access to project" step (click **Continue**)
6. Skip the "Grant users access" step (click **Done**)

You now have a service account. Note the **email address** - you'll need it for two things:
- The `GOOGLE_WORKSPACE_CLIENT_EMAIL` env var
- Domain-wide delegation setup

---

## Step 3: Create and Download a JSON Key

1. In the Service Accounts list, click on your new service account
2. Go to the **Keys** tab
3. Click **Add Key > Create new key**
4. Select **JSON** format
5. Click **Create**
6. A `.json` file downloads automatically. **Keep this safe** - it contains your private key.

Open the JSON file. You need two values:

```json
{
  "client_email": "sophie-hub-directory@your-project.iam.gserviceaccount.com",
  "private_key": "-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----\n"
}
```

---

## Step 4: Enable Domain-Wide Delegation

This is the critical step that allows the service account to impersonate a Google Workspace admin and read directory data.

### 4a: Enable delegation on the service account

1. In Google Cloud Console, go to **IAM & Admin > Service Accounts**
2. Click on your service account
3. Click **Edit** (pencil icon) or go to **Details** tab
4. Expand **Show domain-wide delegation** (or look for the checkbox)
5. Check **Enable Google Workspace Domain-wide Delegation**
6. Click **Save**
7. Note the **Client ID** (a numeric string like `123456789012345678901`) - you'll need this next

> If you don't see the delegation option, you may need to enable the **Identity** API or have Organization Admin permissions.

### 4b: Authorize the service account in Google Workspace Admin Console

1. Go to [Google Workspace Admin Console](https://admin.google.com)
2. Sign in as a **super administrator**
3. Navigate to **Security > Access and data control > API Controls**
4. Scroll down to **Domain-wide Delegation** section
5. Click **Manage Domain Wide Delegation**
6. Click **Add new**
7. Fill in:
   - **Client ID**: The numeric ID from step 4a (NOT the email)
   - **OAuth scopes** (comma-separated):
     ```
     https://www.googleapis.com/auth/admin.directory.user.readonly,https://www.googleapis.com/auth/admin.directory.group.readonly
     ```
8. Click **Authorize**

> The second scope (`group.readonly`) is optional but future-proofs for Google Groups sync.

---

## Step 5: Identify Your Admin Email

The service account impersonates a real admin user to access the directory. This must be a **super admin** account in your Google Workspace domain.

Find it:
1. In Google Workspace Admin Console, go to **Account > Admin roles**
2. Click **Super Admin**
3. Note one of the listed admin email addresses

This becomes your `GOOGLE_WORKSPACE_ADMIN_EMAIL`.

---

## Step 6: Set Environment Variables

Add these to your `.env.local` in the Sophie Hub project root:

```bash
# Google Workspace Admin SDK
GOOGLE_WORKSPACE_CLIENT_EMAIL=sophie-hub-directory@your-project.iam.gserviceaccount.com
GOOGLE_WORKSPACE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIE...your-key-here...\n-----END RSA PRIVATE KEY-----\n"
GOOGLE_WORKSPACE_ADMIN_EMAIL=admin@yourdomain.com
GOOGLE_WORKSPACE_DOMAIN=yourdomain.com
```

### Private key formatting

The private key from the JSON file has literal `\n` characters. You have two options:

**Option A: Raw key (wrap in double quotes)**

Copy the `private_key` value from the JSON file exactly as-is, wrapped in double quotes:
```bash
GOOGLE_WORKSPACE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----\n"
```

**Option B: Base64 encoded (avoids newline issues)**

```bash
# Encode the key:
cat your-key.json | jq -r '.private_key' | base64

# Then set:
GOOGLE_WORKSPACE_PRIVATE_KEY_BASE64=LS0tLS1CRUdJTi...
```

The connector supports both formats automatically.

### For Vercel deployment

Set the same 4 variables in Vercel dashboard under **Settings > Environment Variables**. Use the base64 option to avoid Vercel's newline handling issues.

---

## Step 7: Verify - Run Smoke Tests

Start the dev server and run these in order:

### 1. Test Connection

```bash
curl -X POST http://localhost:3000/api/google-workspace/test-connection \
  -H "Cookie: <your-session-cookie>"
```

Expected: `{ "data": { "connected": true, "domain": "yourdomain.com", "user_count": 1 } }`

**Common errors:**
- `"Not Authorized"` → Domain-wide delegation not configured (step 4b) or wrong Client ID
- `"invalid_grant"` → Private key is malformed (check newlines) or admin email doesn't have super admin role
- `"API not enabled"` → Admin SDK API not enabled in the GCP project (step 1)

### 2. Sync Directory

```bash
curl -X POST http://localhost:3000/api/google-workspace/sync \
  -H "Cookie: <your-session-cookie>"
```

Expected: `{ "data": { "success": true, "total_pulled": 120, "upserted": 120, "tombstoned": 0 } }`

### 3. Check Sync Status

```bash
curl http://localhost:3000/api/google-workspace/sync/status \
  -H "Cookie: <your-session-cookie>"
```

Expected: `{ "data": { "snapshot_stats": { "total": 120, "active": 115, "suspended": 5 }, ... } }`

### 4. List Users

```bash
curl http://localhost:3000/api/google-workspace/users \
  -H "Cookie: <your-session-cookie>"
```

Expected: Array of directory users from the snapshot.

### 5. Auto-Match Staff

```bash
curl -X POST http://localhost:3000/api/google-workspace/mappings/staff/auto-match \
  -H "Cookie: <your-session-cookie>"
```

Expected: includes `matched`, `suggested_alias_matches`, and `staff_approvals_queue`.

Notes:
- Shared inboxes are skipped from staff mapping.
- Staff records with inactive lifecycle statuses (for example `departed`, `legacy_hidden`) are excluded from auto-match.
- Unmatched person accounts are persisted to `staff_approval_queue` for admin review.

### 5b. First-Run Bootstrap (Create Staff from Directory)

```bash
curl -X POST http://localhost:3000/api/google-workspace/staff/bootstrap \
  -H "Cookie: <your-session-cookie>"
```

Use this when `/staff` is initially empty.

Behavior:
- Creates staff rows from Google person accounts (email as anchor).
- Skips shared inboxes and suspended/deleted users.
- Creates `google_workspace_user` mappings for created or existing-by-email staff.

### 6. Enrich Staff

```bash
curl -X POST http://localhost:3000/api/google-workspace/enrich-staff \
  -H "Cookie: <your-session-cookie>"
```

Expected: `{ "data": { "enriched": 80, "fields_updated": { "title": 60, "phone": 30, "avatar_url": 45 } } }`

### 7. Check Mappings

```bash
curl http://localhost:3000/api/google-workspace/mappings/staff \
  -H "Cookie: <your-session-cookie>"
```

Expected: Array of staff-to-Google user mappings.

### 8. Check Staff Approval Queue

```bash
curl http://localhost:3000/api/google-workspace/staff-approvals \
  -H "Cookie: <your-session-cookie>"
```

Expected: `counts.pending` plus recent approval candidates from unmatched Google person accounts.

---

## Step 8: UI Verification

1. Navigate to `/admin/data-enrichment`
2. The Google Workspace card should appear in the category hub (indigo Building2 icon)
3. Click it to enter the Google Workspace view
4. Test Connection card should show your domain
5. Staff Mapping tab should show directory users with:
   - `Refresh Directory`
   - `Auto-match by email`
   - `Seed Staff`
   - `Enrich mapped staff`
   - per-row classification controls (`Auto detect`, `Person`, `Shared inbox`)
   - per-row queue controls (`Skip`, `Re-open`) for approval triage

---

## Step 9: First-Run Operator Workflow (Recommended)

Use this order for first rollout:

1. **Refresh Directory** (or run API sync) to pull the latest snapshot.
2. Review account classification:
   - Keep `Auto detect` for normal `name@sophiesociety.com` staff patterns.
   - Switch to `Shared inbox` for role aliases (`billing@`, `catalogue@`, `leadgen@`, etc.).
   - Use `Skip` for uncertain rows and re-open later from the `Skipped` filter.
3. If `/staff` is empty, run **Seed Staff** once to create baseline staff rows from person accounts.
4. Run **Auto-match by email** to connect Google users to existing/seeded staff records.
5. Run **Enrich mapped staff** to write profile fields onto mapped staff rows.

Notes:
- `Seed Staff` and `Auto-match by email` are separate on purpose.
  - Seed creates baseline staff records.
  - Auto-match links Google users to staff records via external IDs.
- `Enrich mapped staff` only updates staff rows that already have a `google_workspace_user` mapping.

---

## Troubleshooting

### "Domain-wide delegation not configured"
The service account's Client ID needs to be added in Google Workspace Admin Console (step 4b). Make sure you're using the **numeric Client ID**, not the email address.

### "Not Authorized to access this resource/api"
- Check that the scopes in step 4b match exactly (including the `https://` prefix)
- Verify the admin email in `GOOGLE_WORKSPACE_ADMIN_EMAIL` is a super admin
- Wait 5-10 minutes after configuring delegation - propagation can take time

### "invalid_grant: Invalid JWT"
- Private key may have formatting issues (try base64 option)
- Admin email may not exist or may be suspended
- Clock skew between your machine and Google's servers (rare)

### Users endpoint returns empty
- Run sync first (`POST /api/google-workspace/sync`) - the users endpoint reads from the local snapshot, not the live API

### Auto-match returns 0 matches
- Verify staff email addresses in the `staff` table match Google Workspace primary emails
- Check case sensitivity (matching is case-insensitive, but verify emails are populated)

### Snapshot table is "missing or out of date"
- Apply `supabase/migrations/20260212_google_workspace_snapshot_extended.sql`
- Then run:
  ```sql
  select pg_notify('pgrst', 'reload schema');
  ```

---

## Data Flow Reference

### What we pull from Google Directory

Each sync stores the following in `google_workspace_directory_snapshot`:

- Identity: `google_user_id`, `primary_email`, `full_name`, `given_name`, `family_name`
- Account state: `is_suspended`, `is_deleted`, `is_admin`, `is_delegated_admin`
- Org metadata: `org_unit_path`, `department`, `cost_center`, `location`, `manager_email`
- Profile metadata: `title`, `phone`, `thumbnail_photo_url`
- Email metadata: `aliases`, `non_editable_aliases`
- Lifecycle metadata: `creation_time`, `last_login_time`, `last_seen_at`, `first_seen_at`
- Raw payload: `raw_profile` (no-data-loss capture from Google API)

### What "Seed Staff" writes to staff CRM

`POST /api/google-workspace/staff/bootstrap` writes directly to `staff`:

- `full_name` (Google full name or derived from email local-part)
- `email` (primary anchor)
- `status='onboarding'`
- `role='staff'`
- `title` and `avatar_url` (if available)
- `source_data.google_workspace.directory_snapshot` (full provenance snapshot)

It also upserts the link in `entity_external_ids`:

- `source='google_workspace_user'`
- `external_id=<google_user_id>`
- `entity_type='staff'`, `entity_id=<staff.id>`

### What "Enrich mapped staff" writes

`POST /api/google-workspace/enrich-staff` updates only mapped staff rows:

- Requires an existing `google_workspace_user` mapping.
- Pulls fields from the snapshot into staff (for example `title`, `phone`, `avatar_url`).
- Does not create new staff rows.

### Auto staff vs shared inbox classification

`Auto` classification uses:

- Email-local-part first (primary signal).
  - Shared keyword and prefix rules for role aliases (`catalogue`, `brandmanager`, `leadgen`, `billing`, etc.).
  - Person-name pattern fallback for normal name-like aliases.
- Context hints from `full_name`, `org_unit_path`, and `title` only when email pattern is ambiguous.
- Optional manual override per row (`Auto detect`, `Person`, `Shared inbox`).
- Optional queue triage per row (`Skip`/`Re-open`) so uncertain accounts do not block rollout.
