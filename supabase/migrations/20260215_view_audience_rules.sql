-- View Audience Rules table
-- Maps view profiles to audiences via a 5-tier precedence system.
-- Part of the Views + See-As feature (V2a).

-- ============================================================================
-- UP
-- ============================================================================

CREATE TABLE view_audience_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  view_id UUID NOT NULL REFERENCES view_profiles(id) ON DELETE CASCADE,
  tier SMALLINT NOT NULL CHECK (tier BETWEEN 1 AND 5),
  target_type TEXT NOT NULL,
  target_id TEXT,
  priority SMALLINT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),

  -- C1: Tier must match its target_type exactly.
  --   tier 1 = staff (specific person)
  --   tier 2 = role (e.g. pod_leader)
  --   tier 3 = partner (specific partner)
  --   tier 4 = partner_type (canonical product slug)
  --   tier 5 = default (catch-all)
  CONSTRAINT chk_tier_target_type CHECK (
    (tier = 1 AND target_type = 'staff') OR
    (tier = 2 AND target_type = 'role') OR
    (tier = 3 AND target_type = 'partner') OR
    (tier = 4 AND target_type = 'partner_type') OR
    (tier = 5 AND target_type = 'default')
  ),

  -- C2: target_id is required for all types except 'default'.
  CONSTRAINT chk_target_id_required CHECK (
    (target_type = 'default' AND target_id IS NULL) OR
    (target_type != 'default' AND target_id IS NOT NULL)
  )
);

-- I1: Only one active default rule per view_id.
CREATE UNIQUE INDEX uq_view_audience_rules_active_default
  ON view_audience_rules (view_id)
  WHERE target_type = 'default' AND is_active = true;

-- I2: No duplicate non-default rules for the same view + target.
CREATE UNIQUE INDEX uq_view_audience_rules_target
  ON view_audience_rules (view_id, target_type, target_id)
  WHERE target_id IS NOT NULL;

-- General lookup indexes
CREATE INDEX idx_view_audience_rules_view_id ON view_audience_rules(view_id);
CREATE INDEX idx_view_audience_rules_target_type ON view_audience_rules(target_type);
CREATE INDEX idx_view_audience_rules_active ON view_audience_rules(is_active) WHERE is_active = true;

COMMENT ON TABLE view_audience_rules IS 'Audience-to-view mapping with 5-tier precedence (staff > role > partner > partner_type > default).';
COMMENT ON COLUMN view_audience_rules.tier IS 'Precedence tier: 1=staff, 2=role, 3=partner, 4=partner_type, 5=default. Lower wins.';
COMMENT ON COLUMN view_audience_rules.target_type IS 'Audience dimension this rule targets.';
COMMENT ON COLUMN view_audience_rules.target_id IS 'Identifier within the target_type dimension (NULL for default).';
COMMENT ON COLUMN view_audience_rules.priority IS 'Tie-break within the same tier. Higher priority wins.';

-- ============================================================================
-- DOWN
-- ============================================================================
-- DROP TABLE IF EXISTS view_audience_rules;
