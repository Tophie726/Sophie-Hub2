-- RLS policies for view_profiles, view_audience_rules, view_profile_modules
-- Write: admin-only. Read: any authenticated user (needed for runtime view resolution).
-- Part of the Views + See-As feature (V2d).

-- ============================================================================
-- UP
-- ============================================================================

-- Enable RLS on all three tables
ALTER TABLE view_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE view_audience_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE view_profile_modules ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- view_profiles
-- ---------------------------------------------------------------------------

-- Any authenticated user can read active view profiles (resolver needs this)
CREATE POLICY "Authenticated users can read view profiles"
  ON view_profiles FOR SELECT
  TO authenticated
  USING (true);

-- Admins can create, update, delete view profiles
CREATE POLICY "Admins can manage view profiles"
  ON view_profiles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.email = auth.jwt()->>'email'
      AND staff.role IN ('admin', 'operations_admin')
    )
  );

-- ---------------------------------------------------------------------------
-- view_audience_rules
-- ---------------------------------------------------------------------------

-- Any authenticated user can read audience rules (resolver needs this)
CREATE POLICY "Authenticated users can read view audience rules"
  ON view_audience_rules FOR SELECT
  TO authenticated
  USING (true);

-- Admins can manage audience rules
CREATE POLICY "Admins can manage view audience rules"
  ON view_audience_rules FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.email = auth.jwt()->>'email'
      AND staff.role IN ('admin', 'operations_admin')
    )
  );

-- ---------------------------------------------------------------------------
-- view_profile_modules
-- ---------------------------------------------------------------------------

-- Any authenticated user can read module assignments (resolver needs this)
CREATE POLICY "Authenticated users can read view profile modules"
  ON view_profile_modules FOR SELECT
  TO authenticated
  USING (true);

-- Admins can manage module assignments
CREATE POLICY "Admins can manage view profile modules"
  ON view_profile_modules FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.email = auth.jwt()->>'email'
      AND staff.role IN ('admin', 'operations_admin')
    )
  );

-- ============================================================================
-- DOWN
-- ============================================================================
-- DROP POLICY IF EXISTS "Authenticated users can read view profiles" ON view_profiles;
-- DROP POLICY IF EXISTS "Admins can manage view profiles" ON view_profiles;
-- DROP POLICY IF EXISTS "Authenticated users can read view audience rules" ON view_audience_rules;
-- DROP POLICY IF EXISTS "Admins can manage view audience rules" ON view_audience_rules;
-- DROP POLICY IF EXISTS "Authenticated users can read view profile modules" ON view_profile_modules;
-- DROP POLICY IF EXISTS "Admins can manage view profile modules" ON view_profile_modules;
-- ALTER TABLE view_profiles DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE view_audience_rules DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE view_profile_modules DISABLE ROW LEVEL SECURITY;
