-- Add AI summary storage to tab_mappings
-- Stores the full AI-generated summary for context and persistence

ALTER TABLE tab_mappings
ADD COLUMN IF NOT EXISTS ai_summary JSONB;

-- Add comment for documentation
COMMENT ON COLUMN tab_mappings.ai_summary IS 'AI-generated tab summary including purpose, key_column, column_categories, and data_quality_notes';
