-- Migration: Add text fields for staff names on partners
-- These store the raw name from source data, enabling graceful degradation:
-- 1. Name is always visible even without a staff record
-- 2. UI shows "unlinked" indicator if no matching staff
-- 3. When staff syncs, can auto-link via partner_assignments

-- Add staff name text fields to partners
ALTER TABLE partners
  ADD COLUMN IF NOT EXISTS pod_leader_name TEXT,
  ADD COLUMN IF NOT EXISTS brand_manager_name TEXT,
  ADD COLUMN IF NOT EXISTS account_manager_name TEXT,
  ADD COLUMN IF NOT EXISTS sales_rep_name TEXT;

-- Add index for name lookups (used when auto-linking to staff)
CREATE INDEX IF NOT EXISTS idx_partners_pod_leader_name ON partners(pod_leader_name) WHERE pod_leader_name IS NOT NULL;

COMMENT ON COLUMN partners.pod_leader_name IS 'Raw pod leader name from source. May not link to staff table yet.';
COMMENT ON COLUMN partners.brand_manager_name IS 'Raw brand manager name from source. May not link to staff table yet.';
COMMENT ON COLUMN partners.account_manager_name IS 'Raw account manager name from source. May not link to staff table yet.';
COMMENT ON COLUMN partners.sales_rep_name IS 'Raw sales rep name from source. May not link to staff table yet.';
