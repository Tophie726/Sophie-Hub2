-- Add thread support and internal (admin-only) comments to feedback_comments

-- Add parent_id for thread replies
ALTER TABLE feedback_comments ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES feedback_comments(id) ON DELETE CASCADE;

-- Add is_internal flag for admin-only comments
ALTER TABLE feedback_comments ADD COLUMN IF NOT EXISTS is_internal boolean DEFAULT false;

-- Index for finding replies
CREATE INDEX IF NOT EXISTS feedback_comments_parent_id_idx ON feedback_comments(parent_id);

-- Drop existing policies
DROP POLICY IF EXISTS "All staff view comments" ON feedback_comments;
DROP POLICY IF EXISTS "Staff insert comments" ON feedback_comments;

-- New policy: Staff can view non-internal comments, admins can view all
-- Note: This assumes you have a way to check admin status. For now, we'll allow all and filter in the API.
CREATE POLICY "Staff view comments" ON feedback_comments
  FOR SELECT USING (
    is_internal = false
    OR EXISTS (
      SELECT 1 FROM staff
      WHERE staff.email = auth.jwt()->>'email'
      AND staff.role IN ('admin', 'operations_admin')
    )
  );

-- Staff can insert non-internal comments, admins can insert any
CREATE POLICY "Staff insert comments" ON feedback_comments
  FOR INSERT WITH CHECK (
    is_internal = false
    OR EXISTS (
      SELECT 1 FROM staff
      WHERE staff.email = auth.jwt()->>'email'
      AND staff.role IN ('admin', 'operations_admin')
    )
  );

-- Admins can update/delete comments
CREATE POLICY "Admin manage comments" ON feedback_comments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.email = auth.jwt()->>'email'
      AND staff.role IN ('admin', 'operations_admin')
    )
  );
