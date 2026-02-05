-- Add attachments support to feedback_comments
-- Stores array of {type, url, name} objects as JSONB

ALTER TABLE feedback_comments ADD COLUMN IF NOT EXISTS attachments jsonb;

-- Add comment for documentation
COMMENT ON COLUMN feedback_comments.attachments IS 'Array of attachment objects: {type: "image"|"drawing"|"file", url: string, name?: string}';
