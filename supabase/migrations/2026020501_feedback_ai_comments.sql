-- Add AI analysis columns to feedback table
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS ai_summary text;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS ai_summary_at timestamptz;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS ai_analysis jsonb;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS ai_analysis_at timestamptz;

-- Track when feedback content was last updated (for "out of date" detection)
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS content_updated_at timestamptz DEFAULT now();

-- Comments table for user updates/context
CREATE TABLE IF NOT EXISTS feedback_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid REFERENCES feedback(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES staff(id),
  user_email text NOT NULL,
  content text NOT NULL,
  is_from_submitter boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Index for fast comment lookups
CREATE INDEX IF NOT EXISTS feedback_comments_feedback_id_idx ON feedback_comments(feedback_id);

-- RLS for comments
ALTER TABLE feedback_comments ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view comments
CREATE POLICY "All staff view comments" ON feedback_comments
  FOR SELECT USING (true);

-- Users can insert comments
CREATE POLICY "Staff insert comments" ON feedback_comments
  FOR INSERT WITH CHECK (true);

-- Function to update content_updated_at when description changes
CREATE OR REPLACE FUNCTION update_feedback_content_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.description IS DISTINCT FROM NEW.description
     OR OLD.title IS DISTINCT FROM NEW.title THEN
    NEW.content_updated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for content updates
DROP TRIGGER IF EXISTS feedback_content_update_trigger ON feedback;
CREATE TRIGGER feedback_content_update_trigger
  BEFORE UPDATE ON feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_feedback_content_timestamp();

-- Also update content_updated_at when a comment is added
CREATE OR REPLACE FUNCTION update_feedback_on_comment()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE feedback
  SET content_updated_at = now()
  WHERE id = NEW.feedback_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS feedback_comment_trigger ON feedback_comments;
CREATE TRIGGER feedback_comment_trigger
  AFTER INSERT ON feedback_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_feedback_on_comment();
