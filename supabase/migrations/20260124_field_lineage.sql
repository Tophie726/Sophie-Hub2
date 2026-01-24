-- Field Lineage Tracking
-- Records where each field value came from for data provenance

CREATE TABLE IF NOT EXISTS field_lineage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Entity reference
  entity_type TEXT NOT NULL,         -- 'partners', 'staff', 'asins'
  entity_id UUID NOT NULL,           -- ID of the entity record
  field_name TEXT NOT NULL,          -- Field that was updated

  -- Source information
  source_type TEXT NOT NULL,         -- 'google_sheet', 'api', 'app', 'manual'
  source_id UUID,                    -- data_source_id if from external
  source_ref TEXT,                   -- Human-readable: "Master Sheet → Tab → Column B"

  -- Value tracking
  previous_value JSONB,              -- Value before change
  new_value JSONB,                   -- Value after change

  -- Audit trail
  sync_run_id UUID REFERENCES sync_runs(id) ON DELETE SET NULL,
  changed_by UUID,                   -- User ID if manual, null if sync
  changed_at TIMESTAMPTZ DEFAULT NOW(),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_lineage_entity
  ON field_lineage(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_lineage_field
  ON field_lineage(entity_type, entity_id, field_name);

CREATE INDEX IF NOT EXISTS idx_lineage_source
  ON field_lineage(source_id)
  WHERE source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lineage_sync_run
  ON field_lineage(sync_run_id)
  WHERE sync_run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lineage_changed_at
  ON field_lineage(changed_at DESC);

-- Comment for documentation
COMMENT ON TABLE field_lineage IS 'Tracks the origin and history of field values across entities';
COMMENT ON COLUMN field_lineage.source_ref IS 'Human-readable reference like "Brand Master Sheet → Partners → Column D"';
COMMENT ON COLUMN field_lineage.authority IS 'Whether this source is authoritative for this field';
