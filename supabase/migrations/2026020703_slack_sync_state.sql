-- Slack Sync State
-- Tracks incremental sync position per channel for the Slack connector.
-- Phase 1: Connection + Mappings (sync state tracking for future message sync)

-- 1. Create the sync state table
CREATE TABLE IF NOT EXISTS slack_sync_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id TEXT NOT NULL UNIQUE,
  channel_name TEXT NOT NULL,
  partner_id UUID REFERENCES partners(id) ON DELETE SET NULL,
  latest_ts TEXT,                    -- Most recent message ts fetched
  is_backfill_complete BOOLEAN DEFAULT false,
  message_count INT DEFAULT 0,
  last_synced_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Indexes
CREATE INDEX idx_slack_sync_partner ON slack_sync_state(partner_id);
CREATE INDEX idx_slack_sync_channel ON slack_sync_state(channel_id);

-- 3. Updated_at trigger
CREATE OR REPLACE FUNCTION update_slack_sync_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER slack_sync_state_updated_at
  BEFORE UPDATE ON slack_sync_state
  FOR EACH ROW EXECUTE FUNCTION update_slack_sync_state_updated_at();

-- 4. Comments
COMMENT ON TABLE slack_sync_state IS 'Tracks incremental message sync position per Slack channel';
COMMENT ON COLUMN slack_sync_state.channel_id IS 'Slack channel ID (e.g., C01234ABCDE)';
COMMENT ON COLUMN slack_sync_state.latest_ts IS 'Most recent message timestamp fetched (Slack ts format)';
COMMENT ON COLUMN slack_sync_state.is_backfill_complete IS 'Whether initial historical backfill has completed';
COMMENT ON COLUMN slack_sync_state.message_count IS 'Total messages synced for this channel';

-- 5. Row Level Security
ALTER TABLE slack_sync_state ENABLE ROW LEVEL SECURITY;

-- Only admins and service_role can access sync state
CREATE POLICY slack_sync_state_read ON slack_sync_state
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.email = current_setting('request.jwt.claims', true)::jsonb->>'email'
      AND s.role IN ('admin', 'operations_admin')
    )
    OR current_user = 'service_role'
  );

CREATE POLICY slack_sync_state_write ON slack_sync_state
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.email = current_setting('request.jwt.claims', true)::jsonb->>'email'
      AND s.role IN ('admin', 'operations_admin')
    )
    OR current_user = 'service_role'
  );
