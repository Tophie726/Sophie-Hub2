-- View Profile Modules junction table
-- Links view profiles to modules and optional dashboards for composition.
-- Part of the Views + See-As feature (V2b).

-- ============================================================================
-- UP
-- ============================================================================

CREATE TABLE view_profile_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  view_id UUID NOT NULL REFERENCES view_profiles(id) ON DELETE CASCADE,

  -- NOTE: modules and dashboards tables do not exist yet.
  -- FK constraints will be added via ALTER TABLE when those tables are created.
  -- For now these are plain uuid columns to avoid blocking the views feature.
  module_id UUID NOT NULL,
  dashboard_id UUID,

  sort_order SMALLINT DEFAULT 0,
  config JSONB DEFAULT '{}'
);

CREATE INDEX idx_view_profile_modules_view_id ON view_profile_modules(view_id);
CREATE INDEX idx_view_profile_modules_module_id ON view_profile_modules(module_id);

-- Prevent duplicate module entries within the same view
CREATE UNIQUE INDEX uq_view_profile_modules_view_module
  ON view_profile_modules (view_id, module_id);

COMMENT ON TABLE view_profile_modules IS 'Junction table linking view profiles to modules/dashboards for composition.';
COMMENT ON COLUMN view_profile_modules.module_id IS 'References future modules table. FK deferred until modules table exists.';
COMMENT ON COLUMN view_profile_modules.dashboard_id IS 'Optional dashboard override. FK deferred until dashboards table exists.';
COMMENT ON COLUMN view_profile_modules.sort_order IS 'Display order of the module within the view.';
COMMENT ON COLUMN view_profile_modules.config IS 'Per-module configuration overrides for this view.';

-- ============================================================================
-- DOWN
-- ============================================================================
-- DROP TABLE IF EXISTS view_profile_modules;
