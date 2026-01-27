-- Entity Versioning (Time Machine)
-- Tracks all INSERT/UPDATE/DELETE on core entity tables (partners, staff, asins).
-- Stores old + new row values as JSONB for full point-in-time reconstruction.
-- Storage: ~1KB per change, ~180MB/year at current scale. Negligible.

-- 1. Create the versions table
CREATE TABLE IF NOT EXISTS entity_versions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity_type TEXT NOT NULL,           -- 'partners', 'staff', 'asins'
  entity_id UUID NOT NULL,             -- Primary key of the changed row
  operation TEXT NOT NULL,             -- 'INSERT', 'UPDATE', 'DELETE'
  old_data JSONB,                      -- Row before change (NULL on INSERT)
  new_data JSONB,                      -- Row after change (NULL on DELETE)
  changed_fields TEXT[],               -- Which fields changed (UPDATE only)
  changed_by TEXT,                     -- current_user or app-set context
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX idx_entity_versions_lookup ON entity_versions (entity_type, entity_id, changed_at DESC);
CREATE INDEX idx_entity_versions_time ON entity_versions (changed_at DESC);
CREATE INDEX idx_entity_versions_operation ON entity_versions (operation) WHERE operation = 'DELETE';

COMMENT ON TABLE entity_versions IS 'Time machine: full row-level versioning of core entities. Every INSERT/UPDATE/DELETE is captured.';

-- 2. Generic trigger function (works for any table)
CREATE OR REPLACE FUNCTION track_entity_version()
RETURNS TRIGGER AS $$
DECLARE
  v_entity_type TEXT;
  v_entity_id UUID;
  v_changed TEXT[];
  v_key TEXT;
BEGIN
  v_entity_type := TG_TABLE_NAME;

  IF TG_OP = 'INSERT' THEN
    v_entity_id := NEW.id;
    INSERT INTO entity_versions (entity_type, entity_id, operation, new_data, changed_by)
    VALUES (v_entity_type, v_entity_id, 'INSERT', to_jsonb(NEW), current_user);
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    v_entity_id := NEW.id;
    -- Compute which fields actually changed
    v_changed := ARRAY(
      SELECT key FROM jsonb_each(to_jsonb(NEW))
      WHERE to_jsonb(NEW) -> key IS DISTINCT FROM to_jsonb(OLD) -> key
    );
    -- Only record if something actually changed
    IF array_length(v_changed, 1) > 0 THEN
      INSERT INTO entity_versions (entity_type, entity_id, operation, old_data, new_data, changed_fields, changed_by)
      VALUES (v_entity_type, v_entity_id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), v_changed, current_user);
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    v_entity_id := OLD.id;
    INSERT INTO entity_versions (entity_type, entity_id, operation, old_data, changed_by)
    VALUES (v_entity_type, v_entity_id, 'DELETE', to_jsonb(OLD), current_user);
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Attach triggers to core entity tables
CREATE TRIGGER partners_version_trigger
  AFTER INSERT OR UPDATE OR DELETE ON partners
  FOR EACH ROW EXECUTE FUNCTION track_entity_version();

CREATE TRIGGER staff_version_trigger
  AFTER INSERT OR UPDATE OR DELETE ON staff
  FOR EACH ROW EXECUTE FUNCTION track_entity_version();

CREATE TRIGGER asins_version_trigger
  AFTER INSERT OR UPDATE OR DELETE ON asins
  FOR EACH ROW EXECUTE FUNCTION track_entity_version();

-- 4. Row Level Security: only admins can read versions, only service_role can write
ALTER TABLE entity_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY entity_versions_read ON entity_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.email = current_setting('request.jwt.claims', true)::jsonb->>'email'
      AND s.role IN ('admin', 'operations_admin')
    )
    OR current_user = 'service_role'
  );

-- Triggers run as SECURITY DEFINER (superuser context), so inserts bypass RLS automatically.
-- Explicit policy for service_role inserts from API code:
CREATE POLICY entity_versions_insert ON entity_versions
  FOR INSERT WITH CHECK (current_user IN ('postgres', 'service_role'));
