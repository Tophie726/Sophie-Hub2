-- Feedback Voting System Enhancement
-- Adds vote_count column and updates RLS for all-staff visibility

-- 1. Add vote_count column (denormalized for performance)
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS vote_count integer DEFAULT 0;

-- 2. Initialize vote_count from existing votes
UPDATE feedback f
SET vote_count = (
  SELECT COUNT(*) FROM feature_votes fv WHERE fv.feedback_id = f.id
);

-- 3. Create trigger function to keep vote_count in sync
CREATE OR REPLACE FUNCTION update_feedback_vote_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE feedback SET vote_count = vote_count + 1 WHERE id = NEW.feedback_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE feedback SET vote_count = vote_count - 1 WHERE id = OLD.feedback_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 4. Create trigger on feature_votes
DROP TRIGGER IF EXISTS feedback_vote_count_trigger ON feature_votes;
CREATE TRIGGER feedback_vote_count_trigger
AFTER INSERT OR DELETE ON feature_votes
FOR EACH ROW EXECUTE FUNCTION update_feedback_vote_count();

-- 5. Update RLS policies for all-staff visibility
-- Drop old restrictive policy
DROP POLICY IF EXISTS "Staff view own feedback" ON feedback;

-- New policy: all authenticated users can view all feedback
CREATE POLICY "All staff view feedback" ON feedback
  FOR SELECT USING (true);

-- Staff can only update their own feedback (title, description)
-- Note: Status updates go through admin API which uses service role
DROP POLICY IF EXISTS "Staff update own feedback" ON feedback;
CREATE POLICY "Staff update own feedback" ON feedback
  FOR UPDATE USING (
    submitted_by_email = (SELECT email FROM staff WHERE id = auth.uid())
  );

-- 6. Add index for sorting by votes
CREATE INDEX IF NOT EXISTS feedback_vote_count_idx ON feedback(vote_count DESC);

-- 7. Add index for roadmap queries (status-based filtering)
CREATE INDEX IF NOT EXISTS feedback_status_vote_idx ON feedback(status, vote_count DESC);
