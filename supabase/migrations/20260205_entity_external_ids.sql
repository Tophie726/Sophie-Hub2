-- Entity External IDs
-- Links Sophie Hub entities (partners, staff, asins) to identifiers in external systems.
-- Enables scalable integration with BigQuery, CloseIO, Zoho, Forms, etc.
-- without adding columns to entity tables for each new source.

-- 1. Create the mapping table
CREATE TABLE IF NOT EXISTS entity_external_ids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,              -- 'partners', 'staff', 'asins'
  entity_id UUID NOT NULL,                -- FK to the entity (not enforced for flexibility)
  source TEXT NOT NULL,                   -- 'bigquery', 'closeio', 'zoho', 'forms', etc.
  external_id TEXT NOT NULL,              -- The identifier in that system
  metadata JSONB DEFAULT '{}',            -- Source-specific config/context
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT,                        -- User who created the mapping

  -- Each entity can only have one mapping per source
  CONSTRAINT entity_external_ids_unique_entity_source
    UNIQUE(entity_type, entity_id, source),

  -- Each external_id is unique within a source (no two partners map to same BigQuery client_name)
  CONSTRAINT entity_external_ids_unique_source_external
    UNIQUE(source, external_id)
);

-- 2. Indexes for common query patterns
-- Lookup by source + external_id (e.g., "which partner is 'Coat Defense' in BigQuery?")
CREATE INDEX idx_entity_external_ids_source_lookup
  ON entity_external_ids(source, external_id);

-- Lookup by entity (e.g., "what are all external IDs for this partner?")
CREATE INDEX idx_entity_external_ids_entity_lookup
  ON entity_external_ids(entity_type, entity_id);

-- Filter by source (e.g., "all BigQuery mappings")
CREATE INDEX idx_entity_external_ids_source
  ON entity_external_ids(source);

-- 3. Updated_at trigger
CREATE OR REPLACE FUNCTION update_entity_external_ids_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER entity_external_ids_updated_at
  BEFORE UPDATE ON entity_external_ids
  FOR EACH ROW EXECUTE FUNCTION update_entity_external_ids_updated_at();

-- 4. Comments
COMMENT ON TABLE entity_external_ids IS 'Maps Sophie Hub entities to identifiers in external systems (BigQuery, CloseIO, Zoho, etc.)';
COMMENT ON COLUMN entity_external_ids.entity_type IS 'Entity table name: partners, staff, or asins';
COMMENT ON COLUMN entity_external_ids.source IS 'External system identifier: bigquery, closeio, zoho, forms, etc.';
COMMENT ON COLUMN entity_external_ids.external_id IS 'The identifier in the external system (e.g., BigQuery client_name)';
COMMENT ON COLUMN entity_external_ids.metadata IS 'Optional source-specific configuration or context';

-- 5. Row Level Security
ALTER TABLE entity_external_ids ENABLE ROW LEVEL SECURITY;

-- Admins can read all mappings
CREATE POLICY entity_external_ids_read ON entity_external_ids
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.email = current_setting('request.jwt.claims', true)::jsonb->>'email'
      AND s.role IN ('admin', 'operations_admin')
    )
    OR current_user = 'service_role'
  );

-- Only admins and service_role can create/update/delete mappings
CREATE POLICY entity_external_ids_write ON entity_external_ids
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.email = current_setting('request.jwt.claims', true)::jsonb->>'email'
      AND s.role IN ('admin', 'operations_admin')
    )
    OR current_user = 'service_role'
  );

-- 6. Helper function: Get entity ID by external source + ID
CREATE OR REPLACE FUNCTION get_entity_by_external_id(
  p_source TEXT,
  p_external_id TEXT
) RETURNS TABLE (entity_type TEXT, entity_id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT e.entity_type, e.entity_id
  FROM entity_external_ids e
  WHERE e.source = p_source AND e.external_id = p_external_id;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_entity_by_external_id IS 'Look up Sophie Hub entity by external system identifier';
