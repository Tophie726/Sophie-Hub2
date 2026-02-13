-- Add profile enrichment columns to staff table
-- These are populated from Slack profile data when staff ↔ Slack mappings exist

ALTER TABLE staff ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS timezone TEXT;

-- avatar_url: Slack profile picture URL (image_192 or image_512)
-- timezone: IANA timezone string from Slack (e.g., "Europe/Amsterdam")

COMMENT ON COLUMN staff.avatar_url IS 'Profile picture URL, sourced from Slack';
COMMENT ON COLUMN staff.timezone IS 'IANA timezone string, sourced from Slack (e.g., Europe/Amsterdam)';
