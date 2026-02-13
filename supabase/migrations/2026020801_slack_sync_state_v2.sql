-- Phase 2: Alter slack_sync_state for two-watermark sync model
-- Adds oldest_ts (historical backfill boundary) and bot_is_member (membership tracking)

-- 1. Add oldest_ts — historical backfill boundary (oldest message timestamp synced)
ALTER TABLE slack_sync_state ADD COLUMN IF NOT EXISTS oldest_ts TEXT;

-- 2. Add bot_is_member — tracks whether the bot has joined this channel
ALTER TABLE slack_sync_state ADD COLUMN IF NOT EXISTS bot_is_member BOOLEAN DEFAULT false;

-- 3. Comments
COMMENT ON COLUMN slack_sync_state.oldest_ts IS 'Oldest message timestamp synced (backfill boundary, Slack ts format)';
COMMENT ON COLUMN slack_sync_state.bot_is_member IS 'Whether the sync bot is a member of this channel';
