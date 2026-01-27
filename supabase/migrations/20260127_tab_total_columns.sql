-- Add total_columns to tab_mappings for accurate progress calculation
-- Without this, progress is computed from column_mappings count only (saved columns),
-- which shows 100% when only a few columns are saved (e.g., 11/11 = 100% instead of 11/241)
ALTER TABLE tab_mappings ADD COLUMN IF NOT EXISTS total_columns INT;

COMMENT ON COLUMN tab_mappings.total_columns IS 'Total number of columns in the source sheet. Used as denominator for progress calculation.';
