-- Seed Work Calendar module
-- The modules table + Amazon Reporting were already created via sql/modules-schema.sql.
-- This migration adds the Work Calendar module and the FK from view_profile_modules.

-- ============================================================================
-- UP
-- ============================================================================

-- Add Work Calendar module
INSERT INTO modules (slug, name, description, icon, color, sort_order)
VALUES (
  'work-calendar',
  'Work Calendar',
  'Team schedules, task timelines, and partner activity calendar.',
  'Calendar',
  'blue',
  2
)
ON CONFLICT (slug) DO NOTHING;

-- Add FK from view_profile_modules to modules (deferred from 20260215)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_view_profile_modules_module_id'
      AND table_name = 'view_profile_modules'
  ) THEN
    ALTER TABLE view_profile_modules
      ADD CONSTRAINT fk_view_profile_modules_module_id
      FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- DOWN
-- ============================================================================
-- DELETE FROM modules WHERE slug = 'work-calendar';
-- ALTER TABLE view_profile_modules DROP CONSTRAINT IF EXISTS fk_view_profile_modules_module_id;
