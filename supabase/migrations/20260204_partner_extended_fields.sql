-- Add extended partner fields for complete data capture
-- These fields cover all common columns from the Master Client Sheet

-- Core Info (additions)
ALTER TABLE partners
  ADD COLUMN IF NOT EXISTS seller_central_name TEXT,
  ADD COLUMN IF NOT EXISTS marketplace TEXT,
  ADD COLUMN IF NOT EXISTS product_category TEXT;

-- Subscription fields
ALTER TABLE partners
  ADD COLUMN IF NOT EXISTS content_subscriber TEXT,
  ADD COLUMN IF NOT EXISTS prepaid_client TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_fee TEXT,
  ADD COLUMN IF NOT EXISTS payment_status TEXT,
  ADD COLUMN IF NOT EXISTS happy_client TEXT,
  ADD COLUMN IF NOT EXISTS months_subscribed INTEGER;

-- Link fields
ALTER TABLE partners
  ADD COLUMN IF NOT EXISTS client_folder_url TEXT,
  ADD COLUMN IF NOT EXISTS internal_brand_sheet_url TEXT,
  ADD COLUMN IF NOT EXISTS slack_channel_url TEXT,
  ADD COLUMN IF NOT EXISTS slack_alert_channel TEXT,
  ADD COLUMN IF NOT EXISTS looker_studio_url TEXT,
  ADD COLUMN IF NOT EXISTS notion_url TEXT,
  ADD COLUMN IF NOT EXISTS close_io_url TEXT,
  ADD COLUMN IF NOT EXISTS ad_console_id TEXT;

-- Add comments for documentation
COMMENT ON COLUMN partners.seller_central_name IS 'Amazon Seller Central account name';
COMMENT ON COLUMN partners.marketplace IS 'Amazon marketplace (US, UK, DE, etc.)';
COMMENT ON COLUMN partners.product_category IS 'Main product category';
COMMENT ON COLUMN partners.content_subscriber IS 'Whether partner subscribes to content services';
COMMENT ON COLUMN partners.prepaid_client IS 'Whether client is prepaid';
COMMENT ON COLUMN partners.onboarding_fee IS 'Whether onboarding fee was charged';
COMMENT ON COLUMN partners.payment_status IS 'Current payment status';
COMMENT ON COLUMN partners.happy_client IS 'Client satisfaction flag';
COMMENT ON COLUMN partners.months_subscribed IS 'Total months as a subscriber';
COMMENT ON COLUMN partners.client_folder_url IS 'Google Drive client folder URL';
COMMENT ON COLUMN partners.internal_brand_sheet_url IS 'Link to internal brand sheet';
COMMENT ON COLUMN partners.slack_channel_url IS 'Client Slack channel URL';
COMMENT ON COLUMN partners.slack_alert_channel IS 'Slack alert channel URL';
COMMENT ON COLUMN partners.looker_studio_url IS 'Looker Studio dashboard URL';
COMMENT ON COLUMN partners.notion_url IS 'Notion workspace URL';
COMMENT ON COLUMN partners.close_io_url IS 'Close CRM record URL';
COMMENT ON COLUMN partners.ad_console_id IS 'Amazon Advertising console ID';
