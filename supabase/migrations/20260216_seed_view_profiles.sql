-- Seed initial view profiles for roles and partner types
-- Creates blank (no modules assigned) but named view profiles so admins
-- can configure them later.  Each profile gets a matching audience rule.

-- ============================================================================
-- UP
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Role-based view profiles  (tier 2 audience rules)
-- ---------------------------------------------------------------------------
INSERT INTO view_profiles (slug, name, description) VALUES
  ('admin-view',          'Admin',          'Default view for admin users.'),
  ('ppc-strategist-view', 'PPC Strategist', 'Default view for PPC Strategist (pod leader) users.'),
  ('staff-view',          'Staff',          'Default view for staff users.');

-- Audience rules: one rule per role
INSERT INTO view_audience_rules (view_id, tier, target_type, target_id)
SELECT vp.id, 2, 'role', role_slug
FROM (VALUES
  ('admin-view',          'admin'),
  ('ppc-strategist-view', 'pod_leader'),
  ('staff-view',          'staff')
) AS seeds(profile_slug, role_slug)
JOIN view_profiles vp ON vp.slug = seeds.profile_slug;

-- ---------------------------------------------------------------------------
-- 2. Partner-type-based view profiles  (tier 4 audience rules)
-- ---------------------------------------------------------------------------
INSERT INTO view_profiles (slug, name, description) VALUES
  ('ppc-basic-view',   'PPC Basic',                   'View for PPC Basic partners.'),
  ('sophie-ppc-view',  'The Sophie PPC Partnership',   'View for Sophie PPC Partnership partners.'),
  ('cc-view',          'CC',                           'View for CC partners.'),
  ('fam-view',         'FAM',                          'View for FAM partners.'),
  ('pli-view',         'PLI',                          'View for PLI partners.'),
  ('tts-view',         'TTS',                          'View for TTS (TikTok) partners.');

-- Audience rules: one rule per partner type
INSERT INTO view_audience_rules (view_id, tier, target_type, target_id)
SELECT vp.id, 4, 'partner_type', ptype_slug
FROM (VALUES
  ('ppc-basic-view',   'ppc_basic'),
  ('sophie-ppc-view',  'sophie_ppc'),
  ('cc-view',          'cc'),
  ('fam-view',         'fam'),
  ('pli-view',         'pli'),
  ('tts-view',         'tiktok')
) AS seeds(profile_slug, ptype_slug)
JOIN view_profiles vp ON vp.slug = seeds.profile_slug;

-- ============================================================================
-- DOWN
-- ============================================================================
-- DELETE FROM view_audience_rules WHERE view_id IN (
--   SELECT id FROM view_profiles WHERE slug IN (
--     'admin-view','ppc-strategist-view','staff-view',
--     'ppc-basic-view','sophie-ppc-view','cc-view','fam-view','pli-view','tts-view'
--   )
-- );
-- DELETE FROM view_profiles WHERE slug IN (
--   'admin-view','ppc-strategist-view','staff-view',
--   'ppc-basic-view','sophie-ppc-view','cc-view','fam-view','pli-view','tts-view'
-- );
