-- Migration: Add source_data JSONB column for zero-data-loss source capture
-- Purpose: Preserve ALL raw values from external sources (Google Sheets, etc.)
--          even for columns not mapped to predefined fields.
-- Date: 2026-01-27
--
-- Structure: { "<connector_type>": { "<tab_name>": { "<column_header>": "raw_value" } } }
-- Example:   { "gsheets": { "Master Client Sheet": { "Brand Name": "ACME", "Client Count": "0" } } }

-- =============================================================================
-- Add source_data column to all entity tables
-- =============================================================================

ALTER TABLE partners
ADD COLUMN IF NOT EXISTS source_data JSONB DEFAULT '{}'::jsonb;

ALTER TABLE staff
ADD COLUMN IF NOT EXISTS source_data JSONB DEFAULT '{}'::jsonb;

ALTER TABLE asins
ADD COLUMN IF NOT EXISTS source_data JSONB DEFAULT '{}'::jsonb;

-- =============================================================================
-- Documentation
-- =============================================================================

COMMENT ON COLUMN partners.source_data IS 'Raw values from all external sources. Structure: { connector_type: { tab_name: { column_header: raw_value } } }. No data loss — every source column is preserved.';
COMMENT ON COLUMN staff.source_data IS 'Raw values from all external sources. Structure: { connector_type: { tab_name: { column_header: raw_value } } }. No data loss — every source column is preserved.';
COMMENT ON COLUMN asins.source_data IS 'Raw values from all external sources. Structure: { connector_type: { tab_name: { column_header: raw_value } } }. No data loss — every source column is preserved.';
