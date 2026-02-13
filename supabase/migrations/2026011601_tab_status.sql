-- Add status and notes fields to tab_mappings
-- Allows tabs to be hidden, flagged, or marked as reference-only

-- Add status field (replaces boolean is_active with more granular control)
ALTER TABLE tab_mappings
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

-- Add constraint for valid status values
ALTER TABLE tab_mappings
DROP CONSTRAINT IF EXISTS tab_mappings_status_check;

ALTER TABLE tab_mappings
ADD CONSTRAINT tab_mappings_status_check
CHECK (status IN ('active', 'reference', 'hidden', 'flagged'));

-- Add notes field for flagged tabs or general notes
ALTER TABLE tab_mappings
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Migrate existing is_active data to new status field
UPDATE tab_mappings
SET status = CASE
  WHEN is_active = false THEN 'hidden'
  ELSE 'active'
END
WHERE status = 'active' AND is_active = false;

-- Create index for status filtering
CREATE INDEX IF NOT EXISTS idx_tab_mappings_status ON tab_mappings(status);

-- Comments
COMMENT ON COLUMN tab_mappings.status IS 'Tab status: active (map columns), reference (visible but no mapping), hidden (not shown), flagged (needs attention)';
COMMENT ON COLUMN tab_mappings.notes IS 'Notes about this tab, especially for flagged tabs';
