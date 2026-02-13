-- Status Color Mappings
-- Stores configurable mappings from status text to color buckets
-- Replaces hardcoded STATUS_BUCKETS in src/lib/status-colors.ts

CREATE TABLE IF NOT EXISTS status_color_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The status text pattern to match (case-insensitive, partial match)
  status_pattern TEXT NOT NULL,

  -- The target color bucket
  bucket TEXT NOT NULL CHECK (bucket IN (
    'healthy', 'onboarding', 'warning', 'paused',
    'offboarding', 'churned', 'unknown', 'no-data'
  )),

  -- Priority for matching (higher = checked first)
  -- Default priorities: churned=100, offboarding=90, warning=80, paused=70, onboarding=60, healthy=50
  priority INT NOT NULL DEFAULT 50,

  -- Whether this is a system default (shown but cannot be deleted)
  is_system_default BOOLEAN DEFAULT false,

  -- Whether this mapping is active
  is_active BOOLEAN DEFAULT true,

  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES staff(id) ON DELETE SET NULL,

  -- Ensure unique patterns
  UNIQUE(status_pattern)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_status_color_mappings_active
  ON status_color_mappings(is_active, priority DESC);
CREATE INDEX IF NOT EXISTS idx_status_color_mappings_bucket
  ON status_color_mappings(bucket);

-- Updated_at trigger (reuse existing function if available)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at') THEN
    CREATE FUNCTION update_updated_at()
    RETURNS TRIGGER AS $func$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;
  END IF;
END$$;

DROP TRIGGER IF EXISTS update_status_color_mappings_updated_at ON status_color_mappings;
CREATE TRIGGER update_status_color_mappings_updated_at
  BEFORE UPDATE ON status_color_mappings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Row Level Security
ALTER TABLE status_color_mappings ENABLE ROW LEVEL SECURITY;

-- Everyone can read active mappings (needed for color display)
CREATE POLICY status_mappings_read ON status_color_mappings
  FOR SELECT TO authenticated
  USING (true);

-- Only admins can modify
CREATE POLICY status_mappings_admin_write ON status_color_mappings
  FOR ALL TO service_role
  WITH CHECK (true);

-- Seed default mappings from STATUS_BUCKETS
-- Priority order: churned (100) > offboarding (90) > warning (80) > paused (70) > onboarding (60) > healthy (50)

INSERT INTO status_color_mappings (status_pattern, bucket, priority, is_system_default) VALUES
  -- Churned (highest priority - check first)
  ('churn', 'churned', 100, true),
  ('cancel', 'churned', 100, true),
  ('terminated', 'churned', 100, true),
  ('ended', 'churned', 100, true),

  -- Offboarding
  ('offboard', 'offboarding', 90, true),
  ('off-board', 'offboarding', 90, true),
  ('winding down', 'offboarding', 90, true),
  ('ending', 'offboarding', 90, true),

  -- Warning
  ('at risk', 'warning', 80, true),
  ('at-risk', 'warning', 80, true),
  ('under-perform', 'warning', 80, true),
  ('underperform', 'warning', 80, true),
  ('struggling', 'warning', 80, true),
  ('needs attention', 'warning', 80, true),
  ('concern', 'warning', 80, true),
  ('issue', 'warning', 80, true),
  ('problem', 'warning', 80, true),
  ('declining', 'warning', 80, true),

  -- Paused
  ('pause', 'paused', 70, true),
  ('hold', 'paused', 70, true),
  ('on hold', 'paused', 70, true),
  ('on-hold', 'paused', 70, true),
  ('inactive', 'paused', 70, true),
  ('dormant', 'paused', 70, true),
  ('suspended', 'paused', 70, true),

  -- Onboarding
  ('onboard', 'onboarding', 60, true),
  ('on-board', 'onboarding', 60, true),
  ('waiting', 'onboarding', 60, true),
  ('new', 'onboarding', 60, true),
  ('setup', 'onboarding', 60, true),
  ('set-up', 'onboarding', 60, true),
  ('setting up', 'onboarding', 60, true),
  ('getting started', 'onboarding', 60, true),
  ('welcome', 'onboarding', 60, true),

  -- Healthy (lowest priority among matched)
  ('high perform', 'healthy', 50, true),
  ('high-perform', 'healthy', 50, true),
  ('outperform', 'healthy', 50, true),
  ('out-perform', 'healthy', 50, true),
  ('excellent', 'healthy', 50, true),
  ('great', 'healthy', 50, true),
  ('on track', 'healthy', 50, true),
  ('on-track', 'healthy', 50, true),
  ('active', 'healthy', 50, true),
  ('subscribed', 'healthy', 50, true),
  ('healthy', 'healthy', 50, true),
  ('good', 'healthy', 50, true),
  ('stable', 'healthy', 50, true),
  ('strong', 'healthy', 50, true),
  ('growing', 'healthy', 50, true)
ON CONFLICT (status_pattern) DO NOTHING;

COMMENT ON TABLE status_color_mappings IS 'Configurable mappings from status text patterns to color buckets for partner health visualization';
COMMENT ON COLUMN status_color_mappings.status_pattern IS 'Text pattern to match (case-insensitive partial match)';
COMMENT ON COLUMN status_color_mappings.bucket IS 'Color bucket: healthy, onboarding, warning, paused, offboarding, churned, unknown, no-data';
COMMENT ON COLUMN status_color_mappings.priority IS 'Higher values are checked first (100=churned, 90=offboarding, 80=warning, 70=paused, 60=onboarding, 50=healthy)';
COMMENT ON COLUMN status_color_mappings.is_system_default IS 'System defaults cannot be deleted but can be deactivated';
