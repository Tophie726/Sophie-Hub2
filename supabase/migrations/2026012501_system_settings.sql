-- Migration: Create system_settings table for API keys and configuration
-- Date: 2026-01-25

-- =============================================================================
-- Create system settings table
-- =============================================================================

CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,              -- 'anthropic_api_key', 'openai_api_key', etc.
  value TEXT NOT NULL,                   -- Encrypted/raw value
  encrypted BOOLEAN DEFAULT true,        -- Whether value is encrypted
  description TEXT,                      -- Human-readable description
  updated_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for key lookups
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key);

-- =============================================================================
-- Row Level Security
-- =============================================================================

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can read settings
CREATE POLICY settings_admin_read ON system_settings
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM staff
    WHERE staff.id = auth.uid()
    AND staff.role IN ('admin', 'operations_admin')
  ));

-- Only service role can insert/update (API routes use service role)
CREATE POLICY settings_service_write ON system_settings
  FOR ALL TO service_role
  WITH CHECK (true);

-- =============================================================================
-- Trigger to update updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION update_system_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_system_settings_updated_at
  BEFORE UPDATE ON system_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_system_settings_updated_at();
