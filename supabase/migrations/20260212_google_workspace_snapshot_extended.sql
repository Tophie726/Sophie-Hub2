-- Google Workspace snapshot: extended no-data-loss fields
-- Adds additional directory metadata so we can preserve full identity context
-- even before all fields are mapped into first-class staff columns.

BEGIN;

ALTER TABLE google_workspace_directory_snapshot
  ADD COLUMN IF NOT EXISTS given_name TEXT,
  ADD COLUMN IF NOT EXISTS family_name TEXT,
  ADD COLUMN IF NOT EXISTS is_delegated_admin BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS non_editable_aliases TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS creation_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_login_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS cost_center TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS manager_email TEXT,
  ADD COLUMN IF NOT EXISTS account_type_override TEXT,
  ADD COLUMN IF NOT EXISTS raw_profile JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'gws_snapshot_account_type_override_check'
  ) THEN
    ALTER TABLE google_workspace_directory_snapshot
      ADD CONSTRAINT gws_snapshot_account_type_override_check
      CHECK (account_type_override IN ('person', 'shared_account') OR account_type_override IS NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_gws_snapshot_manager_email
  ON google_workspace_directory_snapshot(manager_email)
  WHERE manager_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gws_snapshot_last_login_time
  ON google_workspace_directory_snapshot(last_login_time DESC)
  WHERE last_login_time IS NOT NULL;

COMMENT ON COLUMN google_workspace_directory_snapshot.raw_profile IS
  'Raw Google Directory user payload (projection=full) for no-data-loss archival.';
COMMENT ON COLUMN google_workspace_directory_snapshot.creation_time IS
  'Google account creation time from Directory API.';
COMMENT ON COLUMN google_workspace_directory_snapshot.last_login_time IS
  'Last successful Google account login from Directory API.';

COMMIT;
