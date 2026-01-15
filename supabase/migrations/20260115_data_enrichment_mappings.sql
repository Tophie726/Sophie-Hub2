-- Data Enrichment: Mapping Configuration Tables
-- Stores how external data sources map to our entity tables

-- ============================================
-- DATA SOURCES
-- ============================================
-- Represents a connected external data source (Google Sheet, Form, API)
CREATE TABLE IF NOT EXISTS data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                              -- Human-readable name
  type TEXT NOT NULL DEFAULT 'google_sheet',       -- 'google_sheet', 'google_form', 'api'
  spreadsheet_id TEXT,                             -- Google Sheet ID (for sheets)
  spreadsheet_url TEXT,                            -- Original URL for reference
  status TEXT NOT NULL DEFAULT 'active',           -- 'active', 'paused', 'error'
  last_synced_at TIMESTAMPTZ,
  sync_error TEXT,                                 -- Last error message if status='error'
  created_by UUID,                                 -- User who created this
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- TAB MAPPINGS
-- ============================================
-- Per-tab configuration within a data source
CREATE TABLE IF NOT EXISTS tab_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  tab_name TEXT NOT NULL,                          -- Sheet tab name
  header_row INT NOT NULL DEFAULT 0,               -- 0-indexed row containing headers
  primary_entity TEXT NOT NULL,                    -- 'partners', 'staff', 'asins'
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  last_sync_row_count INT,                         -- Rows processed in last sync
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(data_source_id, tab_name)
);

-- ============================================
-- COLUMN MAPPINGS
-- ============================================
-- Individual column → field mappings (for non-pattern columns)
CREATE TABLE IF NOT EXISTS column_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_mapping_id UUID NOT NULL REFERENCES tab_mappings(id) ON DELETE CASCADE,
  source_column TEXT NOT NULL,                     -- Column header name
  source_column_index INT,                         -- Column position (0-indexed, backup)
  category TEXT NOT NULL,                          -- 'partner', 'staff', 'asin', 'weekly', 'skip'
  target_field TEXT,                               -- e.g., 'brand_name', 'email', null if skip
  authority TEXT NOT NULL DEFAULT 'source_of_truth', -- 'source_of_truth', 'reference'
  is_key BOOLEAN NOT NULL DEFAULT false,           -- Is this the identifier column for its entity?
  transform_type TEXT DEFAULT 'none',              -- 'none', 'date', 'currency', 'boolean', 'trim'
  transform_config JSONB,                          -- Transform parameters
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tab_mapping_id, source_column)
);

-- ============================================
-- COLUMN PATTERNS
-- ============================================
-- Pattern rules for dynamic column detection (mainly for weekly columns)
-- Instead of mapping each weekly column individually, store a pattern that matches them all
CREATE TABLE IF NOT EXISTS column_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_mapping_id UUID NOT NULL REFERENCES tab_mappings(id) ON DELETE CASCADE,
  pattern_name TEXT NOT NULL,                      -- Human-readable, e.g., 'Weekly Status Columns'
  category TEXT NOT NULL,                          -- 'weekly', 'skip', etc.

  -- Pattern matching rules (all conditions must match)
  match_config JSONB NOT NULL DEFAULT '{}',
  -- Example: {
  --   "contains": ["weekly"],           -- Column name contains any of these (case-insensitive)
  --   "starts_with": ["W"],             -- Column name starts with any of these
  --   "matches_regex": "^\\d{1,2}/\\d{1,2}", -- Column name matches this regex
  --   "matches_date": true,             -- Column name looks like a date
  --   "after_column": "Email Address"   -- Only columns after this one
  -- }

  target_table TEXT,                               -- 'weekly_statuses' for weekly pattern
  target_field TEXT,                               -- Field name in target table, or null for auto
  priority INT NOT NULL DEFAULT 0,                 -- Higher priority patterns evaluated first
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- SYNC HISTORY
-- ============================================
-- Track each sync run for debugging and auditing
CREATE TABLE IF NOT EXISTS sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  tab_mapping_id UUID REFERENCES tab_mappings(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'running',          -- 'running', 'completed', 'failed'
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  rows_processed INT DEFAULT 0,
  rows_created INT DEFAULT 0,
  rows_updated INT DEFAULT 0,
  rows_skipped INT DEFAULT 0,
  errors JSONB,                                    -- Array of error details
  triggered_by UUID,                               -- User who triggered, null if scheduled
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_data_sources_status ON data_sources(status);
CREATE INDEX IF NOT EXISTS idx_tab_mappings_source ON tab_mappings(data_source_id);
CREATE INDEX IF NOT EXISTS idx_column_mappings_tab ON column_mappings(tab_mapping_id);
CREATE INDEX IF NOT EXISTS idx_column_patterns_tab ON column_patterns(tab_mapping_id);
CREATE INDEX IF NOT EXISTS idx_sync_runs_source ON sync_runs(data_source_id);
CREATE INDEX IF NOT EXISTS idx_sync_runs_status ON sync_runs(status);

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_data_sources_updated_at
  BEFORE UPDATE ON data_sources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tab_mappings_updated_at
  BEFORE UPDATE ON tab_mappings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE data_sources IS 'External data sources connected to Sophie Hub (Google Sheets, Forms, APIs)';
COMMENT ON TABLE tab_mappings IS 'Per-tab configuration within a data source';
COMMENT ON TABLE column_mappings IS 'Individual column to field mappings';
COMMENT ON TABLE column_patterns IS 'Pattern rules for dynamic column detection (e.g., weekly columns)';
COMMENT ON TABLE sync_runs IS 'History of sync operations for auditing';

COMMENT ON COLUMN column_patterns.match_config IS 'JSON object with pattern matching rules: contains, starts_with, matches_regex, matches_date, after_column';
