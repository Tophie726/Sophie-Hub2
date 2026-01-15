-- Computed Fields Registry
-- Fields whose values come from logic rather than direct sync
-- Supports hot-swapping sources and gradual implementation

CREATE TABLE IF NOT EXISTS computed_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Target location
  target_table TEXT NOT NULL,             -- 'partners', 'staff', 'asins'
  target_field TEXT NOT NULL,             -- Database column name
  display_name TEXT NOT NULL,             -- Human-friendly name

  -- Computation definition
  computation_type TEXT NOT NULL,         -- 'formula', 'aggregation', 'lookup', 'custom'
  config JSONB NOT NULL DEFAULT '{}',     -- Type-specific configuration

  -- Discovery context (where we first saw this)
  discovered_in_source_id UUID REFERENCES data_sources(id) ON DELETE SET NULL,
  discovered_in_tab TEXT,
  discovered_in_column TEXT,

  -- Source priority for hot-swapping (array of {source, source_ref, priority})
  source_priority JSONB NOT NULL DEFAULT '[]',

  -- Implementation status
  description TEXT,                       -- Human description of what this computes
  implementation_notes TEXT,              -- Developer notes
  is_implemented BOOLEAN NOT NULL DEFAULT false,
  implemented_at TIMESTAMPTZ,

  -- Metadata
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(target_table, target_field)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_computed_fields_table ON computed_fields(target_table);
CREATE INDEX IF NOT EXISTS idx_computed_fields_type ON computed_fields(computation_type);
CREATE INDEX IF NOT EXISTS idx_computed_fields_implemented ON computed_fields(is_implemented);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
CREATE TRIGGER update_computed_fields_updated_at
  BEFORE UPDATE ON computed_fields
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE computed_fields IS 'Registry of fields computed from logic rather than direct sync. Supports hot-swappable sources.';
COMMENT ON COLUMN computed_fields.computation_type IS 'formula=depends on other fields, aggregation=from time-series, lookup=external system, custom=manual implementation';
COMMENT ON COLUMN computed_fields.config IS 'Type-specific config: formula needs depends_on+formula, aggregation needs source_table+aggregation, lookup needs source+match_field+lookup_field';
COMMENT ON COLUMN computed_fields.source_priority IS 'Array of {source, source_ref, priority} for hot-swapping data sources';

-- ============================================
-- EXAMPLE CONFIGS (as comments for reference)
-- ============================================
-- Formula (Current Time from Timezone):
-- {
--   "depends_on": ["timezone"],
--   "formula": "timezone_to_current_time"
-- }
--
-- Aggregation (Latest Status):
-- {
--   "source_table": "weekly_statuses",
--   "aggregation": "latest",
--   "field": "status",
--   "order_by": "week_date"
-- }
--
-- Aggregation (Count Months):
-- {
--   "source_table": "weekly_statuses",
--   "aggregation": "count_distinct",
--   "field": "week_date",
--   "date_part": "month",
--   "filter": {"status": "active"}
-- }
--
-- Lookup (Payment Status from Zoho):
-- {
--   "source": "zoho",
--   "match_field": "email",
--   "lookup_field": "payment_status"
-- }
--
-- Custom:
-- {
--   "description": "Complex business logic - see implementation_notes"
-- }
