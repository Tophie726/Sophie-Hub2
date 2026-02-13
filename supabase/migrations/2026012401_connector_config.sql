-- Migration: Backfill connection_config JSONB column in data_sources
-- Purpose: Enable pluggable connector architecture for multiple data source types
-- Date: 2024-01-24
-- Note: The connection_config column already exists from initial schema

-- =============================================================================
-- Backfill existing Google Sheets records
-- =============================================================================

-- Populate connection_config for existing records that have spreadsheet_id
UPDATE data_sources
SET connection_config = jsonb_build_object(
  'type', 'google_sheet',
  'spreadsheet_id', spreadsheet_id,
  'spreadsheet_url', spreadsheet_url
)
WHERE type = 'google_sheet'
  AND spreadsheet_id IS NOT NULL
  AND connection_config IS NULL;

-- =============================================================================
-- Create index for querying by connector type
-- =============================================================================

-- Index on the type field within connection_config for efficient filtering
CREATE INDEX IF NOT EXISTS idx_data_sources_connector_type
ON data_sources ((connection_config->>'type'))
WHERE connection_config IS NOT NULL;
