-- Persist canonical partner taxonomy fields for billing/reporting stability.
-- Mirrors computed logic currently derived at runtime from source_data + staffing signals.

ALTER TABLE partners
  ADD COLUMN IF NOT EXISTS computed_partner_type TEXT
    CHECK (computed_partner_type IN ('ppc_basic', 'sophie_ppc', 'cc', 'fam', 'pli', 'tiktok')),
  ADD COLUMN IF NOT EXISTS computed_partner_type_source TEXT
    CHECK (computed_partner_type_source IN ('staffing', 'legacy_partner_type', 'unknown')),
  ADD COLUMN IF NOT EXISTS staffing_partner_type TEXT
    CHECK (staffing_partner_type IN ('ppc_basic', 'sophie_ppc', 'cc', 'fam', 'pli', 'tiktok')),
  ADD COLUMN IF NOT EXISTS legacy_partner_type_raw TEXT,
  ADD COLUMN IF NOT EXISTS legacy_partner_type TEXT
    CHECK (legacy_partner_type IN ('ppc_basic', 'sophie_ppc', 'cc', 'fam', 'pli', 'tiktok')),
  ADD COLUMN IF NOT EXISTS partner_type_matches BOOLEAN,
  ADD COLUMN IF NOT EXISTS partner_type_is_shared BOOLEAN,
  ADD COLUMN IF NOT EXISTS partner_type_reason TEXT,
  ADD COLUMN IF NOT EXISTS partner_type_computed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_partners_computed_partner_type
  ON partners (computed_partner_type);

CREATE INDEX IF NOT EXISTS idx_partners_partner_type_mismatch
  ON partners (id)
  WHERE partner_type_matches = false;

CREATE INDEX IF NOT EXISTS idx_partners_partner_type_computed_at
  ON partners (partner_type_computed_at DESC);

COMMENT ON COLUMN partners.computed_partner_type IS 'Canonical partner type used by app logic (billing/views).';
COMMENT ON COLUMN partners.computed_partner_type_source IS 'Source of computed canonical type: staffing, legacy_partner_type, or unknown.';
COMMENT ON COLUMN partners.staffing_partner_type IS 'Canonical type derived from staffing signals only.';
COMMENT ON COLUMN partners.legacy_partner_type_raw IS 'Raw legacy Partner type string captured from source_data.';
COMMENT ON COLUMN partners.legacy_partner_type IS 'Canonical type mapped from legacy Partner type source value.';
COMMENT ON COLUMN partners.partner_type_matches IS 'True when staffing-derived and legacy canonical types match.';
COMMENT ON COLUMN partners.partner_type_is_shared IS 'True when partner appears shared across FAM + PPC staffing model.';
COMMENT ON COLUMN partners.partner_type_reason IS 'Human-readable reason for computed partner type decision.';
COMMENT ON COLUMN partners.partner_type_computed_at IS 'Timestamp when computed partner type fields were last refreshed.';
