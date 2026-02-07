-- Staff approval queue (Google Workspace connector)
-- Persists unmatched person accounts so admins can review and approve creation/mapping.

BEGIN;

CREATE TABLE IF NOT EXISTS staff_approval_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  source_user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  full_name TEXT,
  title TEXT,
  org_unit_path TEXT,
  account_type TEXT NOT NULL DEFAULT 'person',
  reason TEXT NOT NULL DEFAULT 'unmatched_person_google_account',
  status TEXT NOT NULL DEFAULT 'pending',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  suggested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  reviewed_by TEXT,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT staff_approval_queue_source_check CHECK (source IN ('google_workspace')),
  CONSTRAINT staff_approval_queue_account_type_check CHECK (account_type IN ('person', 'shared_account')),
  CONSTRAINT staff_approval_queue_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'ignored', 'resolved')),
  CONSTRAINT staff_approval_queue_source_user_unique UNIQUE (source, source_user_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_approval_queue_source_status
  ON staff_approval_queue(source, status);

CREATE INDEX IF NOT EXISTS idx_staff_approval_queue_email
  ON staff_approval_queue(lower(email));

CREATE OR REPLACE FUNCTION update_staff_approval_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS staff_approval_queue_updated_at ON staff_approval_queue;
CREATE TRIGGER staff_approval_queue_updated_at
  BEFORE UPDATE ON staff_approval_queue
  FOR EACH ROW EXECUTE FUNCTION update_staff_approval_queue_updated_at();

ALTER TABLE staff_approval_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY staff_approval_queue_read ON staff_approval_queue
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM staff s
      WHERE s.email = current_setting('request.jwt.claims', true)::jsonb->>'email'
      AND s.role IN ('admin', 'operations_admin')
    )
    OR current_user = 'service_role'
  );

CREATE POLICY staff_approval_queue_write ON staff_approval_queue
  FOR ALL USING (current_user = 'service_role')
  WITH CHECK (current_user = 'service_role');

COMMENT ON TABLE staff_approval_queue IS
  'Persistent approval queue for connector-discovered staff candidates.';
COMMENT ON COLUMN staff_approval_queue.source_user_id IS
  'Immutable external user ID (for Google Workspace, this is google_user_id).';

COMMIT;
