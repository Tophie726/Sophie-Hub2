-- Migration: Change mapping_audit_log.user_id from UUID to TEXT
-- Reason: NextAuth user IDs are email strings, not staff table UUIDs
-- Date: 2026-01-28

ALTER TABLE mapping_audit_log
  DROP CONSTRAINT IF EXISTS mapping_audit_log_user_id_fkey;

ALTER TABLE mapping_audit_log
  ALTER COLUMN user_id TYPE TEXT USING user_id::text;

COMMENT ON COLUMN mapping_audit_log.user_id IS 'NextAuth user identifier (email or provider ID)';
