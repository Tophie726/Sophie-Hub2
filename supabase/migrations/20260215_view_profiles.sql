-- View Profiles table
-- Named, reusable view definitions that control what modules/dashboards a user sees.
-- Part of the Views + See-As feature (V2).

-- ============================================================================
-- UP
-- ============================================================================

CREATE TABLE view_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES staff(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_view_profiles_slug ON view_profiles(slug);
CREATE INDEX idx_view_profiles_is_active ON view_profiles(is_active) WHERE is_active = true;

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION update_view_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER view_profiles_updated_at
  BEFORE UPDATE ON view_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_view_profiles_updated_at();

COMMENT ON TABLE view_profiles IS 'Named view definitions controlling module/dashboard composition per audience.';
COMMENT ON COLUMN view_profiles.slug IS 'URL-safe unique identifier (e.g. ppc-basic-view).';
COMMENT ON COLUMN view_profiles.is_default IS 'True if this view is the fallback when no audience rule matches.';
COMMENT ON COLUMN view_profiles.created_by IS 'Admin staff member who created this view profile.';

-- ============================================================================
-- DOWN
-- ============================================================================
-- DROP TRIGGER IF EXISTS view_profiles_updated_at ON view_profiles;
-- DROP FUNCTION IF EXISTS update_view_profiles_updated_at();
-- DROP TABLE IF EXISTS view_profiles;
