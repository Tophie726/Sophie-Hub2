-- Migration: slack_clickup_sync_state
-- Tracks high-watermark message timestamp for Slack -> ClickUp daily sync.

CREATE TABLE IF NOT EXISTS slack_clickup_sync_state (
  channel_id TEXT PRIMARY KEY,
  last_processed_ts TEXT NOT NULL DEFAULT '0',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_slack_clickup_sync_state_updated_at
  ON slack_clickup_sync_state(updated_at DESC);

ALTER TABLE slack_clickup_sync_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS slack_clickup_sync_state_service_write ON slack_clickup_sync_state;
CREATE POLICY slack_clickup_sync_state_service_write ON slack_clickup_sync_state
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS slack_clickup_sync_state_admin_read ON slack_clickup_sync_state;
CREATE POLICY slack_clickup_sync_state_admin_read ON slack_clickup_sync_state
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM staff
    WHERE staff.id = auth.uid()
      AND staff.role IN ('admin', 'operations_admin')
  ));

CREATE OR REPLACE FUNCTION update_slack_clickup_sync_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_slack_clickup_sync_state_updated_at ON slack_clickup_sync_state;
CREATE TRIGGER trigger_slack_clickup_sync_state_updated_at
  BEFORE UPDATE ON slack_clickup_sync_state
  FOR EACH ROW
  EXECUTE FUNCTION update_slack_clickup_sync_state_updated_at();
