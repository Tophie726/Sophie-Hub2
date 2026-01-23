-- Add header_confirmed column to track when user explicitly confirms the header row
-- Distinguishes between auto-detected headers and user-confirmed headers

ALTER TABLE tab_mappings
ADD COLUMN IF NOT EXISTS header_confirmed BOOLEAN NOT NULL DEFAULT false;

-- Comment
COMMENT ON COLUMN tab_mappings.header_confirmed IS 'True when user has explicitly confirmed the header row selection (clicked "This looks right")';
