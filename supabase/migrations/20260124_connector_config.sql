-- Migration: Add connector_config JSONB column to data_sources
-- Purpose: Enable pluggable connector architecture for multiple data source types
-- Date: 2024-01-24

-- =============================================================================
-- Add connector_config column
-- =============================================================================

-- Add the new JSONB column to store connector-specific configuration
-- This replaces the need for type-specific columns (spreadsheet_id, form_id, etc.)
ALTER TABLE data_sources
ADD COLUMN IF NOT EXISTS connector_config JSONB;

-- Add a comment explaining the column
COMMENT ON COLUMN data_sources.connector_config IS
'JSONB configuration for the connector. Structure depends on the type field.
Example for google_sheet: {"type": "google_sheet", "spreadsheet_id": "abc123", "spreadsheet_url": "..."}
Example for api: {"type": "api", "endpoint_url": "https://...", "auth_type": "bearer"}';

-- =============================================================================
-- Backfill existing Google Sheets records
-- =============================================================================

-- Populate connector_config for existing records that have spreadsheet_id
UPDATE data_sources
SET connector_config = jsonb_build_object(
  'type', 'google_sheet',
  'spreadsheet_id', spreadsheet_id,
  'spreadsheet_url', spreadsheet_url
)
WHERE type = 'google_sheet'
  AND spreadsheet_id IS NOT NULL
  AND connector_config IS NULL;

-- =============================================================================
-- Add validation constraint (optional, can be enabled later)
-- =============================================================================

-- This constraint ensures connector_config has a valid 'type' field when present
-- Commented out for now to allow gradual migration
-- ALTER TABLE data_sources
-- ADD CONSTRAINT connector_config_has_type
-- CHECK (
--   connector_config IS NULL
--   OR (connector_config->>'type' IS NOT NULL)
-- );

-- =============================================================================
-- Create index for querying by connector type
-- =============================================================================

-- Index on the type field within connector_config for efficient filtering
CREATE INDEX IF NOT EXISTS idx_data_sources_connector_type
ON data_sources ((connector_config->>'type'))
WHERE connector_config IS NOT NULL;
