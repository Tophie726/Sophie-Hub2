-- Phase 2: Slack Message Sync
-- Creates slack_messages and slack_sync_runs tables for message metadata sync.
-- No message content stored — only timestamps, sender IDs, and thread references.

-- =============================================================================
-- 1. slack_messages — Message metadata per channel
-- =============================================================================

CREATE TABLE slack_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id TEXT NOT NULL,
  message_ts TEXT NOT NULL,
  thread_ts TEXT,                          -- NULL = top-level message
  sender_slack_id TEXT,                    -- NULL for non-user/system events
  sender_bot_id TEXT,                      -- Bot sender if applicable
  sender_type TEXT NOT NULL DEFAULT 'user' CHECK (sender_type IN ('user', 'bot', 'system')),
  sender_staff_id UUID,                    -- Resolved at sync time via entity_external_ids for user senders
  sender_is_staff BOOLEAN NOT NULL DEFAULT false,
  is_bot BOOLEAN NOT NULL DEFAULT false,
  posted_at TIMESTAMPTZ NOT NULL,          -- Parsed from message_ts (epoch seconds)

  CONSTRAINT slack_messages_pkey_channel_ts UNIQUE(channel_id, message_ts),
  CONSTRAINT slack_messages_sender_present CHECK (
    sender_slack_id IS NOT NULL OR sender_bot_id IS NOT NULL OR sender_type = 'system'
  )
);

-- Indexes for query patterns
CREATE INDEX idx_slack_messages_channel_posted ON slack_messages(channel_id, posted_at);
CREATE INDEX idx_slack_messages_thread ON slack_messages(thread_ts) WHERE thread_ts IS NOT NULL;
CREATE INDEX idx_slack_messages_sender ON slack_messages(sender_slack_id, posted_at);

-- Comments
COMMENT ON TABLE slack_messages IS 'Slack message metadata (no content) for response time analytics';
COMMENT ON COLUMN slack_messages.message_ts IS 'Slack unique message timestamp (e.g., 1234567890.123456)';
COMMENT ON COLUMN slack_messages.thread_ts IS 'Parent thread timestamp — NULL for top-level messages';
COMMENT ON COLUMN slack_messages.sender_type IS 'Message sender classification: user, bot, or system';
COMMENT ON COLUMN slack_messages.sender_staff_id IS 'Resolved staff UUID from entity_external_ids at sync time';
COMMENT ON COLUMN slack_messages.sender_is_staff IS 'Denormalized staff flag for fast analytics queries';
COMMENT ON COLUMN slack_messages.posted_at IS 'Message timestamp parsed as TIMESTAMPTZ for time-range queries';

-- RLS: admin/operations_admin + service_role only
ALTER TABLE slack_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY slack_messages_read ON slack_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.email = current_setting('request.jwt.claims', true)::jsonb->>'email'
      AND s.role IN ('admin', 'operations_admin')
    )
    OR current_user = 'service_role'
  );

CREATE POLICY slack_messages_write ON slack_messages
  FOR ALL USING (current_user = 'service_role')
  WITH CHECK (current_user = 'service_role');

-- =============================================================================
-- 2. slack_sync_runs — Sync run tracking for chunked cron processing
-- =============================================================================

CREATE TABLE slack_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'pending',   -- pending, running, completed, failed, cancelled
  triggered_by TEXT,                        -- admin email
  total_channels INT DEFAULT 0,
  synced_channels INT DEFAULT 0,
  failed_channels INT DEFAULT 0,
  total_messages_synced INT DEFAULT 0,
  next_channel_offset INT DEFAULT 0,        -- cursor for chunked processing
  worker_lease_expires_at TIMESTAMPTZ,      -- anti-overlap lease
  last_heartbeat_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_slack_sync_runs_status ON slack_sync_runs(status);
CREATE INDEX idx_slack_sync_runs_created ON slack_sync_runs(created_at DESC);

-- Comments
COMMENT ON TABLE slack_sync_runs IS 'Tracks sync run progress for chunked cron-based message sync';
COMMENT ON COLUMN slack_sync_runs.next_channel_offset IS 'Cursor into ordered channel list for chunked processing';
COMMENT ON COLUMN slack_sync_runs.worker_lease_expires_at IS 'Anti-overlap lease — only one worker processes at a time';

-- RLS: admin/operations_admin + service_role only
ALTER TABLE slack_sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY slack_sync_runs_read ON slack_sync_runs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.email = current_setting('request.jwt.claims', true)::jsonb->>'email'
      AND s.role IN ('admin', 'operations_admin')
    )
    OR current_user = 'service_role'
  );

CREATE POLICY slack_sync_runs_write ON slack_sync_runs
  FOR ALL USING (current_user = 'service_role')
  WITH CHECK (current_user = 'service_role');
