-- Google Workspace Connector Migration
-- Up migration: adds directory snapshot table + updates 1:1 partial unique index
--
-- Rollback: see 20260207_google_workspace_connector_down.sql

BEGIN;

-- =============================================================================
-- Preflight: check for duplicates that would violate the updated index
-- =============================================================================

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

-- =============================================================================
-- 1. Update partial unique index to include google_workspace_user
-- =============================================================================

DROP INDEX IF EXISTS idx_entity_external_ids_one_to_one_sources;
CREATE UNIQUE INDEX idx_entity_external_ids_one_to_one_sources
  ON entity_external_ids(entity_type, entity_id, source)
  WHERE source IN ('bigquery', 'slack_user', 'google_workspace_user');

-- =============================================================================
-- 2. Directory snapshot table (local cache of Google user state)
-- =============================================================================

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

-- =============================================================================
-- 3. Updated_at trigger
-- =============================================================================

CREATE OR REPLACE FUNCTION update_gws_snapshot_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER gws_snapshot_updated_at
  BEFORE UPDATE ON google_workspace_directory_snapshot
  FOR EACH ROW EXECUTE FUNCTION update_gws_snapshot_updated_at();

-- =============================================================================
-- 4. Row Level Security
-- =============================================================================

ALTER TABLE google_workspace_directory_snapshot ENABLE ROW LEVEL SECURITY;

-- Admins can read
CREATE POLICY gws_snapshot_read ON google_workspace_directory_snapshot
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.email = current_setting('request.jwt.claims', true)::jsonb->>'email'
      AND s.role IN ('admin', 'operations_admin')
    )
    OR current_user = 'service_role'
  );

-- Only service_role can write (API routes use service_role client)
CREATE POLICY gws_snapshot_write ON google_workspace_directory_snapshot
  FOR ALL USING (current_user = 'service_role')
  WITH CHECK (current_user = 'service_role');

-- =============================================================================
-- 5. Comments
-- =============================================================================

COMMENT ON TABLE google_workspace_directory_snapshot IS
  'Local snapshot of Google Workspace directory users. Retains user state even after Google deletes the account (tombstone pattern).';
COMMENT ON COLUMN google_workspace_directory_snapshot.google_user_id IS
  'Immutable Google user ID — permanent anchor for identity mapping.';
COMMENT ON COLUMN google_workspace_directory_snapshot.is_deleted IS
  'Set to true when user no longer appears in a successful full directory pull. Only tombstone after confirmed full sync.';

COMMIT;
