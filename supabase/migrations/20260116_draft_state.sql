-- Add draft_state column to tab_mappings
-- Enables persistence of in-progress mapping work across sessions and users

-- Add draft_state JSONB column
ALTER TABLE tab_mappings
ADD COLUMN IF NOT EXISTS draft_state JSONB;

-- Add draft_updated_by to track who last worked on the draft
ALTER TABLE tab_mappings
ADD COLUMN IF NOT EXISTS draft_updated_by TEXT;

-- Add draft_updated_at for freshness checks
ALTER TABLE tab_mappings
ADD COLUMN IF NOT EXISTS draft_updated_at TIMESTAMPTZ;

-- Comments
COMMENT ON COLUMN tab_mappings.draft_state IS 'In-progress mapping state: { phase, headerRow, columns, timestamp }. Cleared when mapping is completed.';
COMMENT ON COLUMN tab_mappings.draft_updated_by IS 'Email/name of user who last updated the draft';
COMMENT ON COLUMN tab_mappings.draft_updated_at IS 'When the draft was last updated';

-- Create index for finding tabs with drafts
CREATE INDEX IF NOT EXISTS idx_tab_mappings_has_draft ON tab_mappings((draft_state IS NOT NULL));
