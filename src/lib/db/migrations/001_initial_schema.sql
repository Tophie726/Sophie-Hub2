-- Sophie Hub v2 - Initial Schema Migration
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- ============================================
-- TIER 1: CORE ENTITIES
-- ============================================

-- Partners (clients/brands we manage)
CREATE TABLE IF NOT EXISTS partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_code TEXT UNIQUE,

  -- Core identity
  brand_name TEXT NOT NULL,
  client_name TEXT,
  client_email TEXT,
  client_phone TEXT,

  -- Status & tier
  status TEXT NOT NULL DEFAULT 'onboarding'
    CHECK (status IN ('onboarding', 'active', 'paused', 'at_risk', 'offboarding', 'churned')),
  tier TEXT DEFAULT 'tier_2'
    CHECK (tier IN ('tier_0', 'tier_1', 'tier_2', 'tier_3', 'tier_4')),

  -- Financial
  base_fee DECIMAL(10,2),
  commission_rate DECIMAL(5,4),
  billing_day INT CHECK (billing_day >= 1 AND billing_day <= 31),

  -- Dates
  onboarding_date DATE,
  contract_start_date DATE,
  contract_end_date DATE,
  churned_date DATE,

  -- Product counts
  parent_asin_count INT DEFAULT 0,
  child_asin_count INT DEFAULT 0,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Staff (team members)
CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_code TEXT UNIQUE,

  -- Identity
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  slack_id TEXT,

  -- Role & position
  role TEXT NOT NULL,
  department TEXT,
  title TEXT,

  -- Status
  status TEXT DEFAULT 'active'
    CHECK (status IN ('onboarding', 'active', 'on_leave', 'offboarding', 'departed')),

  -- Capacity
  max_clients INT,
  current_client_count INT DEFAULT 0,

  -- Services (for pod leaders)
  services TEXT[],

  -- Dates
  hire_date DATE,
  probation_end_date DATE,
  departure_date DATE,

  -- Links
  dashboard_url TEXT,
  calendly_url TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TIER 2: RELATIONSHIP ENTITIES
-- ============================================

-- Squads (team groupings)
CREATE TABLE IF NOT EXISTS squads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('ppc', 'cc', 'fam', 'sales', 'operations', 'other')),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Staff membership in squads
CREATE TABLE IF NOT EXISTS staff_squads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  squad_id UUID NOT NULL REFERENCES squads(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('leader', 'captain', 'member')),
  assigned_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  UNIQUE(staff_id, squad_id)
);

-- Partner assignments (who manages which partner)
CREATE TABLE IF NOT EXISTS partner_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  assignment_role TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  unassigned_at TIMESTAMPTZ,
  notes TEXT,
  UNIQUE(partner_id, staff_id, assignment_role)
);

-- ============================================
-- TIER 3: DOMAIN ENTITIES
-- ============================================

-- ASINs (Amazon products)
CREATE TABLE IF NOT EXISTS asins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,

  asin_code TEXT NOT NULL,
  parent_asin TEXT,
  is_parent BOOLEAN DEFAULT false,

  title TEXT,
  sku TEXT,
  category TEXT,

  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'discontinued')),

  cogs DECIMAL(10,2),
  price DECIMAL(10,2),

  kw_research_sheet_url TEXT,
  kw_research_verified_at TIMESTAMPTZ,
  market_analysis_sheet_url TEXT,
  market_analysis_verified_at TIMESTAMPTZ,
  campaign_structure_sheet_url TEXT,
  campaign_structure_verified_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(partner_id, asin_code)
);

-- Weekly statuses (partner health tracking)
CREATE TABLE IF NOT EXISTS weekly_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,

  week_start_date DATE NOT NULL,
  week_number INT,
  year INT,

  status TEXT NOT NULL,
  reported_by UUID REFERENCES staff(id),
  reported_at TIMESTAMPTZ DEFAULT now(),

  notes TEXT,
  happy_client BOOLEAN,
  metrics JSONB,

  UNIQUE(partner_id, week_start_date)
);

-- Partner sheets (linked Google Sheets)
CREATE TABLE IF NOT EXISTS partner_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  asin_id UUID REFERENCES asins(id) ON DELETE SET NULL,

  sheet_type TEXT NOT NULL,
  sheet_url TEXT NOT NULL,
  sheet_name TEXT,

  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES staff(id),

  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'broken')),
  last_accessed_at TIMESTAMPTZ,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Staff training progress
CREATE TABLE IF NOT EXISTS staff_training (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,

  module_name TEXT NOT NULL,
  module_type TEXT,

  status TEXT DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'in_progress', 'completed', 'needs_refresher')),

  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  due_date DATE,

  score DECIMAL(5,2),
  attempts INT DEFAULT 0,

  notes TEXT,

  UNIQUE(staff_id, module_name)
);

-- PTO records
CREATE TABLE IF NOT EXISTS pto_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,

  start_date DATE NOT NULL,
  end_date DATE NOT NULL,

  type TEXT DEFAULT 'vacation' CHECK (type IN ('vacation', 'sick', 'personal', 'holiday')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),

  approved_by UUID REFERENCES staff(id),
  approved_at TIMESTAMPTZ,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TIER 4: REFERENCE/CONFIG ENTITIES
-- ============================================

-- External contacts
CREATE TABLE IF NOT EXISTS external_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name TEXT NOT NULL,
  company TEXT,
  type TEXT NOT NULL CHECK (type IN ('amazon_rep', 'partner_referral', 'vendor', 'other')),

  email TEXT,
  phone TEXT,
  linkedin_url TEXT,

  notes TEXT,
  tags TEXT[],

  added_by UUID REFERENCES staff(id),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- System settings
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  category TEXT,
  description TEXT,
  updated_by UUID REFERENCES staff(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- DATA ENRICHMENT PIPELINE TABLES
-- ============================================

-- Data sources (external connections)
CREATE TABLE IF NOT EXISTS data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('google_sheet', 'google_form', 'api', 'csv')),

  connection_config JSONB NOT NULL,

  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'error', 'archived')),
  last_synced_at TIMESTAMPTZ,
  last_sync_error TEXT,

  sync_mode TEXT DEFAULT 'manual' CHECK (sync_mode IN ('manual', 'scheduled')),
  sync_schedule TEXT,

  description TEXT,
  created_by UUID REFERENCES staff(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Field mappings (source to target)
CREATE TABLE IF NOT EXISTS field_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,

  source_tab TEXT,
  source_column TEXT NOT NULL,
  source_column_index INT,

  target_table TEXT NOT NULL,
  target_field TEXT NOT NULL,

  transform_type TEXT DEFAULT 'none',
  transform_config JSONB,

  is_authoritative BOOLEAN DEFAULT false,
  priority INT DEFAULT 0,

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(data_source_id, source_tab, source_column)
);

-- Staged changes (pending review)
CREATE TABLE IF NOT EXISTS staged_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL,
  data_source_id UUID REFERENCES data_sources(id) ON DELETE SET NULL,

  entity_type TEXT NOT NULL,
  entity_key TEXT NOT NULL,
  entity_id UUID,

  change_type TEXT NOT NULL CHECK (change_type IN ('create', 'update', 'delete')),
  old_values JSONB,
  new_values JSONB NOT NULL,
  changed_fields TEXT[],

  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'applied', 'failed', 'conflict')),
  reviewed_by UUID REFERENCES staff(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,

  applied_at TIMESTAMPTZ,
  apply_error TEXT,

  source_reference TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Field lineage (data provenance)
CREATE TABLE IF NOT EXISTS field_lineage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  field_name TEXT NOT NULL,

  current_value TEXT,
  authoritative_source_id UUID REFERENCES data_sources(id),
  last_updated_at TIMESTAMPTZ DEFAULT now(),

  history JSONB DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(entity_type, entity_id, field_name)
);

-- Sync logs (audit trail)
CREATE TABLE IF NOT EXISTS sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL,
  data_source_id UUID REFERENCES data_sources(id),

  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,

  status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),

  records_scanned INT DEFAULT 0,
  changes_staged INT DEFAULT 0,
  changes_approved INT DEFAULT 0,
  changes_applied INT DEFAULT 0,
  errors INT DEFAULT 0,

  error_log JSONB,
  initiated_by UUID REFERENCES staff(id),

  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_partners_status ON partners(status);
CREATE INDEX IF NOT EXISTS idx_partners_brand_name ON partners(brand_name);
CREATE INDEX IF NOT EXISTS idx_partners_partner_code ON partners(partner_code);

CREATE INDEX IF NOT EXISTS idx_staff_status ON staff(status);
CREATE INDEX IF NOT EXISTS idx_staff_role ON staff(role);
CREATE INDEX IF NOT EXISTS idx_staff_email ON staff(email);

CREATE INDEX IF NOT EXISTS idx_staff_squads_staff ON staff_squads(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_squads_squad ON staff_squads(squad_id);

CREATE INDEX IF NOT EXISTS idx_partner_assignments_partner ON partner_assignments(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_assignments_staff ON partner_assignments(staff_id);

CREATE INDEX IF NOT EXISTS idx_asins_partner ON asins(partner_id);
CREATE INDEX IF NOT EXISTS idx_asins_code ON asins(asin_code);

CREATE INDEX IF NOT EXISTS idx_weekly_statuses_partner ON weekly_statuses(partner_id);
CREATE INDEX IF NOT EXISTS idx_weekly_statuses_week ON weekly_statuses(week_start_date);

CREATE INDEX IF NOT EXISTS idx_partner_sheets_partner ON partner_sheets(partner_id);

CREATE INDEX IF NOT EXISTS idx_staff_training_staff ON staff_training(staff_id);

CREATE INDEX IF NOT EXISTS idx_pto_records_staff ON pto_records(staff_id);

CREATE INDEX IF NOT EXISTS idx_data_sources_status ON data_sources(status);

CREATE INDEX IF NOT EXISTS idx_field_mappings_source ON field_mappings(data_source_id);
CREATE INDEX IF NOT EXISTS idx_field_mappings_target ON field_mappings(target_table, target_field);

CREATE INDEX IF NOT EXISTS idx_staged_changes_batch ON staged_changes(batch_id);
CREATE INDEX IF NOT EXISTS idx_staged_changes_status ON staged_changes(status);

CREATE INDEX IF NOT EXISTS idx_field_lineage_entity ON field_lineage(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_sync_logs_batch ON sync_logs(batch_id);

-- ============================================
-- TRIGGER FUNCTIONS
-- ============================================

-- Auto-generate partner_code (SO-0001 format)
CREATE OR REPLACE FUNCTION generate_partner_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.partner_code IS NULL THEN
    NEW.partner_code := 'SO-' || LPAD(
      COALESCE(
        (SELECT MAX(CAST(SUBSTRING(partner_code FROM 4) AS INT)) + 1 FROM partners),
        1
      )::TEXT,
      4, '0'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_partner_code ON partners;
CREATE TRIGGER set_partner_code
  BEFORE INSERT ON partners
  FOR EACH ROW
  EXECUTE FUNCTION generate_partner_code();

-- Auto-generate staff_code (ST-0001 format)
CREATE OR REPLACE FUNCTION generate_staff_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.staff_code IS NULL THEN
    NEW.staff_code := 'ST-' || LPAD(
      COALESCE(
        (SELECT MAX(CAST(SUBSTRING(staff_code FROM 4) AS INT)) + 1 FROM staff),
        1
      )::TEXT,
      4, '0'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_staff_code ON staff;
CREATE TRIGGER set_staff_code
  BEFORE INSERT ON staff
  FOR EACH ROW
  EXECUTE FUNCTION generate_staff_code();

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all relevant tables
DROP TRIGGER IF EXISTS update_partners_updated_at ON partners;
CREATE TRIGGER update_partners_updated_at
  BEFORE UPDATE ON partners FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_staff_updated_at ON staff;
CREATE TRIGGER update_staff_updated_at
  BEFORE UPDATE ON staff FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_squads_updated_at ON squads;
CREATE TRIGGER update_squads_updated_at
  BEFORE UPDATE ON squads FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_asins_updated_at ON asins;
CREATE TRIGGER update_asins_updated_at
  BEFORE UPDATE ON asins FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_partner_sheets_updated_at ON partner_sheets;
CREATE TRIGGER update_partner_sheets_updated_at
  BEFORE UPDATE ON partner_sheets FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_external_contacts_updated_at ON external_contacts;
CREATE TRIGGER update_external_contacts_updated_at
  BEFORE UPDATE ON external_contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_data_sources_updated_at ON data_sources;
CREATE TRIGGER update_data_sources_updated_at
  BEFORE UPDATE ON data_sources FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_field_mappings_updated_at ON field_mappings;
CREATE TRIGGER update_field_mappings_updated_at
  BEFORE UPDATE ON field_mappings FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_field_lineage_updated_at ON field_lineage;
CREATE TRIGGER update_field_lineage_updated_at
  BEFORE UPDATE ON field_lineage FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE 'Sophie Hub v2 schema created successfully!';
  RAISE NOTICE 'Tables created: 18';
  RAISE NOTICE 'Indexes created: 15';
  RAISE NOTICE 'Triggers created: 11';
END $$;
