-- Admin Audit Log table
-- Lightweight audit trail for admin operations (views, context switches, etc.)
-- Separate from mapping_audit_log which is specific to data enrichment.
-- Part of the Views + See-As feature (V9a).

-- ============================================================================
-- UP
-- ============================================================================

CREATE TABLE admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_admin_audit_log_action ON admin_audit_log(action);
CREATE INDEX idx_admin_audit_log_actor ON admin_audit_log(actor_email);
CREATE INDEX idx_admin_audit_log_created ON admin_audit_log(created_at DESC);

-- RLS: only admins can read, only service role can write
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_audit_read ON admin_audit_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = auth.uid()
      AND staff.role IN ('admin', 'operations_admin')
    )
  );

CREATE POLICY admin_audit_insert ON admin_audit_log
  FOR INSERT TO service_role
  WITH CHECK (true);

COMMENT ON TABLE admin_audit_log IS 'Audit trail for admin operations: view context switches, view CRUD, rule assignments.';
COMMENT ON COLUMN admin_audit_log.action IS 'Action type (e.g. context.switch, context.clear, view.create, rule.create).';
COMMENT ON COLUMN admin_audit_log.actor_id IS 'Staff ID or temp ID of the acting user.';
COMMENT ON COLUMN admin_audit_log.actor_email IS 'Denormalized email for quick lookup.';
COMMENT ON COLUMN admin_audit_log.details IS 'Structured details about the action. Never contains secrets.';

-- ============================================================================
-- DOWN
-- ============================================================================
-- DROP TABLE IF EXISTS admin_audit_log;
