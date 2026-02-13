-- Google Workspace Connector — Down Migration (Rollback)
-- Reverses 20260207_google_workspace_connector.sql

BEGIN;

-- 1. Remove snapshot table and trigger
DROP TRIGGER IF EXISTS gws_snapshot_updated_at ON google_workspace_directory_snapshot;
DROP FUNCTION IF EXISTS update_gws_snapshot_updated_at();
DROP TABLE IF EXISTS google_workspace_directory_snapshot CASCADE;

-- 2. Restore original partial unique index (without google_workspace_user)
DROP INDEX IF EXISTS idx_entity_external_ids_one_to_one_sources;
CREATE UNIQUE INDEX idx_entity_external_ids_one_to_one_sources
  ON entity_external_ids(entity_type, entity_id, source)
  WHERE source IN ('bigquery', 'slack_user');

-- 3. Optional: clean up google_workspace mappings (uncomment if needed)
-- DELETE FROM entity_external_ids WHERE source LIKE 'google_workspace_%';

COMMIT;
