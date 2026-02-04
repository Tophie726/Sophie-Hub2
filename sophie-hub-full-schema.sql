-- ============================================
-- SOPHIE HUB v2 - FULL SCHEMA
-- Run this in Supabase SQL Editor
-- ============================================

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


-- ============================================
-- ADDITIONAL MIGRATIONS
-- ============================================

-- Migration: 20260115_computed_fields.sql
-- Computed Fields Registry
-- Fields whose values come from logic rather than direct sync
-- Supports hot-swapping sources and gradual implementation

-- ============================================
-- UPDATED_AT TRIGGER FUNCTION (idempotent)
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS computed_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Target location
  target_table TEXT NOT NULL,             -- 'partners', 'staff', 'asins'
  target_field TEXT NOT NULL,             -- Database column name
  display_name TEXT NOT NULL,             -- Human-friendly name

  -- Computation definition
  computation_type TEXT NOT NULL,         -- 'formula', 'aggregation', 'lookup', 'custom'
  config JSONB NOT NULL DEFAULT '{}',     -- Type-specific configuration

  -- Discovery context (where we first saw this)
  discovered_in_source_id UUID REFERENCES data_sources(id) ON DELETE SET NULL,
  discovered_in_tab TEXT,
  discovered_in_column TEXT,

  -- Source priority for hot-swapping (array of {source, source_ref, priority})
  source_priority JSONB NOT NULL DEFAULT '[]',

  -- Implementation status
  description TEXT,                       -- Human description of what this computes
  implementation_notes TEXT,              -- Developer notes
  is_implemented BOOLEAN NOT NULL DEFAULT false,
  implemented_at TIMESTAMPTZ,

  -- Metadata
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(target_table, target_field)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_computed_fields_table ON computed_fields(target_table);
CREATE INDEX IF NOT EXISTS idx_computed_fields_type ON computed_fields(computation_type);
CREATE INDEX IF NOT EXISTS idx_computed_fields_implemented ON computed_fields(is_implemented);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
CREATE TRIGGER update_computed_fields_updated_at
  BEFORE UPDATE ON computed_fields
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE computed_fields IS 'Registry of fields computed from logic rather than direct sync. Supports hot-swappable sources.';
COMMENT ON COLUMN computed_fields.computation_type IS 'formula=depends on other fields, aggregation=from time-series, lookup=external system, custom=manual implementation';
COMMENT ON COLUMN computed_fields.config IS 'Type-specific config: formula needs depends_on+formula, aggregation needs source_table+aggregation, lookup needs source+match_field+lookup_field';
COMMENT ON COLUMN computed_fields.source_priority IS 'Array of {source, source_ref, priority} for hot-swapping data sources';

-- ============================================
-- EXAMPLE CONFIGS (as comments for reference)
-- ============================================
-- Formula (Current Time from Timezone):
-- {
--   "depends_on": ["timezone"],
--   "formula": "timezone_to_current_time"
-- }
--
-- Aggregation (Latest Status):
-- {
--   "source_table": "weekly_statuses",
--   "aggregation": "latest",
--   "field": "status",
--   "order_by": "week_date"
-- }
--
-- Aggregation (Count Months):
-- {
--   "source_table": "weekly_statuses",
--   "aggregation": "count_distinct",
--   "field": "week_date",
--   "date_part": "month",
--   "filter": {"status": "active"}
-- }
--
-- Lookup (Payment Status from Zoho):
-- {
--   "source": "zoho",
--   "match_field": "email",
--   "lookup_field": "payment_status"
-- }
--
-- Custom:
-- {
--   "description": "Complex business logic - see implementation_notes"
-- }

-- Migration: 20260115_data_enrichment_mappings.sql
-- Data Enrichment: Mapping Configuration Tables
-- Stores how external data sources map to our entity tables

-- ============================================
-- DATA SOURCES
-- ============================================
-- Represents a connected external data source (Google Sheet, Form, API)
CREATE TABLE IF NOT EXISTS data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                              -- Human-readable name
  type TEXT NOT NULL DEFAULT 'google_sheet',       -- 'google_sheet', 'google_form', 'api'
  spreadsheet_id TEXT,                             -- Google Sheet ID (for sheets)
  spreadsheet_url TEXT,                            -- Original URL for reference
  status TEXT NOT NULL DEFAULT 'active',           -- 'active', 'paused', 'error'
  last_synced_at TIMESTAMPTZ,
  sync_error TEXT,                                 -- Last error message if status='error'
  created_by UUID,                                 -- User who created this
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- TAB MAPPINGS
-- ============================================
-- Per-tab configuration within a data source
CREATE TABLE IF NOT EXISTS tab_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  tab_name TEXT NOT NULL,                          -- Sheet tab name
  header_row INT NOT NULL DEFAULT 0,               -- 0-indexed row containing headers
  primary_entity TEXT NOT NULL,                    -- 'partners', 'staff', 'asins'
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  last_sync_row_count INT,                         -- Rows processed in last sync
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(data_source_id, tab_name)
);

-- ============================================
-- COLUMN MAPPINGS
-- ============================================
-- Individual column → field mappings (for non-pattern columns)
CREATE TABLE IF NOT EXISTS column_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_mapping_id UUID NOT NULL REFERENCES tab_mappings(id) ON DELETE CASCADE,
  source_column TEXT NOT NULL,                     -- Column header name
  source_column_index INT,                         -- Column position (0-indexed, backup)
  category TEXT NOT NULL,                          -- 'partner', 'staff', 'asin', 'weekly', 'skip'
  target_field TEXT,                               -- e.g., 'brand_name', 'email', null if skip
  authority TEXT NOT NULL DEFAULT 'source_of_truth', -- 'source_of_truth', 'reference'
  is_key BOOLEAN NOT NULL DEFAULT false,           -- Is this the identifier column for its entity?
  transform_type TEXT DEFAULT 'none',              -- 'none', 'date', 'currency', 'boolean', 'trim'
  transform_config JSONB,                          -- Transform parameters
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tab_mapping_id, source_column)
);

-- ============================================
-- COLUMN PATTERNS
-- ============================================
-- Pattern rules for dynamic column detection (mainly for weekly columns)
-- Instead of mapping each weekly column individually, store a pattern that matches them all
CREATE TABLE IF NOT EXISTS column_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_mapping_id UUID NOT NULL REFERENCES tab_mappings(id) ON DELETE CASCADE,
  pattern_name TEXT NOT NULL,                      -- Human-readable, e.g., 'Weekly Status Columns'
  category TEXT NOT NULL,                          -- 'weekly', 'skip', etc.

  -- Pattern matching rules (all conditions must match)
  match_config JSONB NOT NULL DEFAULT '{}',
  -- Example: {
  --   "contains": ["weekly"],           -- Column name contains any of these (case-insensitive)
  --   "starts_with": ["W"],             -- Column name starts with any of these
  --   "matches_regex": "^\\d{1,2}/\\d{1,2}", -- Column name matches this regex
  --   "matches_date": true,             -- Column name looks like a date
  --   "after_column": "Email Address"   -- Only columns after this one
  -- }

  target_table TEXT,                               -- 'weekly_statuses' for weekly pattern
  target_field TEXT,                               -- Field name in target table, or null for auto
  priority INT NOT NULL DEFAULT 0,                 -- Higher priority patterns evaluated first
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- SYNC HISTORY
-- ============================================
-- Track each sync run for debugging and auditing
CREATE TABLE IF NOT EXISTS sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  tab_mapping_id UUID REFERENCES tab_mappings(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'running',          -- 'running', 'completed', 'failed'
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  rows_processed INT DEFAULT 0,
  rows_created INT DEFAULT 0,
  rows_updated INT DEFAULT 0,
  rows_skipped INT DEFAULT 0,
  errors JSONB,                                    -- Array of error details
  triggered_by UUID,                               -- User who triggered, null if scheduled
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_data_sources_status ON data_sources(status);
CREATE INDEX IF NOT EXISTS idx_tab_mappings_source ON tab_mappings(data_source_id);
CREATE INDEX IF NOT EXISTS idx_column_mappings_tab ON column_mappings(tab_mapping_id);
CREATE INDEX IF NOT EXISTS idx_column_patterns_tab ON column_patterns(tab_mapping_id);
CREATE INDEX IF NOT EXISTS idx_sync_runs_source ON sync_runs(data_source_id);
CREATE INDEX IF NOT EXISTS idx_sync_runs_status ON sync_runs(status);

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_data_sources_updated_at
  BEFORE UPDATE ON data_sources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tab_mappings_updated_at
  BEFORE UPDATE ON tab_mappings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE data_sources IS 'External data sources connected to Sophie Hub (Google Sheets, Forms, APIs)';
COMMENT ON TABLE tab_mappings IS 'Per-tab configuration within a data source';
COMMENT ON TABLE column_mappings IS 'Individual column to field mappings';
COMMENT ON TABLE column_patterns IS 'Pattern rules for dynamic column detection (e.g., weekly columns)';
COMMENT ON TABLE sync_runs IS 'History of sync operations for auditing';

COMMENT ON COLUMN column_patterns.match_config IS 'JSON object with pattern matching rules: contains, starts_with, matches_regex, matches_date, after_column';

-- Migration: 20260116_draft_state.sql
-- Add draft_state column to tab_mappings
-- Enables persistence of in-progress mapping work across sessions and users

-- Add draft_state JSONB column
ALTER TABLE tab_mappings
ADD COLUMN IF NOT EXISTS draft_state JSONB;

-- Add draft_updated_by to track who last worked on the draft
ALTER TABLE tab_mappings
ADD COLUMN IF NOT EXISTS draft_updated_by TEXT;

-- Add draft_updated_at for freshness checks
ALTER TABLE tab_mappings
ADD COLUMN IF NOT EXISTS draft_updated_at TIMESTAMPTZ;

-- Comments
COMMENT ON COLUMN tab_mappings.draft_state IS 'In-progress mapping state: { phase, headerRow, columns, timestamp }. Cleared when mapping is completed.';
COMMENT ON COLUMN tab_mappings.draft_updated_by IS 'Email/name of user who last updated the draft';
COMMENT ON COLUMN tab_mappings.draft_updated_at IS 'When the draft was last updated';

-- Create index for finding tabs with drafts
CREATE INDEX IF NOT EXISTS idx_tab_mappings_has_draft ON tab_mappings((draft_state IS NOT NULL));

-- Migration: 20260116_tab_status.sql
-- Add status and notes fields to tab_mappings
-- Allows tabs to be hidden, flagged, or marked as reference-only

-- Add status field (replaces boolean is_active with more granular control)
ALTER TABLE tab_mappings
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

-- Add constraint for valid status values
ALTER TABLE tab_mappings
DROP CONSTRAINT IF EXISTS tab_mappings_status_check;

ALTER TABLE tab_mappings
ADD CONSTRAINT tab_mappings_status_check
CHECK (status IN ('active', 'reference', 'hidden', 'flagged'));

-- Add notes field for flagged tabs or general notes
ALTER TABLE tab_mappings
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Migrate existing is_active data to new status field
UPDATE tab_mappings
SET status = CASE
  WHEN is_active = false THEN 'hidden'
  ELSE 'active'
END
WHERE status = 'active' AND is_active = false;

-- Create index for status filtering
CREATE INDEX IF NOT EXISTS idx_tab_mappings_status ON tab_mappings(status);

-- Comments
COMMENT ON COLUMN tab_mappings.status IS 'Tab status: active (map columns), reference (visible but no mapping), hidden (not shown), flagged (needs attention)';
COMMENT ON COLUMN tab_mappings.notes IS 'Notes about this tab, especially for flagged tabs';

-- Migration: 20260122_field_tags.sql
-- Field Tags: Cross-cutting domain tags for column mappings
-- e.g., Finance, Operations, Contact, HR, Product

-- Predefined tags table
CREATE TABLE field_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT 'gray',  -- For UI badge colors: emerald, blue, violet, amber, orange, etc.
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Junction table for many-to-many relationship
CREATE TABLE column_mapping_tags (
  column_mapping_id UUID REFERENCES column_mappings(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES field_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (column_mapping_id, tag_id)
);

-- Index for efficient tag lookups
CREATE INDEX idx_column_mapping_tags_tag_id ON column_mapping_tags(tag_id);

-- Seed default tags
INSERT INTO field_tags (name, color, description) VALUES
  ('Finance', 'emerald', 'Financial data: fees, salaries, invoices, billing'),
  ('Operations', 'blue', 'Operational data: status, capacity, assignments'),
  ('Contact', 'violet', 'Contact information: email, phone, address, Slack'),
  ('HR', 'amber', 'Human resources: hire dates, PTO, training'),
  ('Product', 'orange', 'Product data: categories, pricing, inventory');

-- Migration: 20260122_source_display_order.sql
-- Add display_order column to data_sources for drag-and-drop ordering
ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Set initial order based on creation date
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) - 1 as rn
  FROM data_sources
)
UPDATE data_sources
SET display_order = ordered.rn
FROM ordered
WHERE data_sources.id = ordered.id;

-- Migration: 20260123_header_confirmed.sql
-- Add header_confirmed column to track when user explicitly confirms the header row
-- Distinguishes between auto-detected headers and user-confirmed headers

ALTER TABLE tab_mappings
ADD COLUMN IF NOT EXISTS header_confirmed BOOLEAN NOT NULL DEFAULT false;

-- Comment
COMMENT ON COLUMN tab_mappings.header_confirmed IS 'True when user has explicitly confirmed the header row selection (clicked "This looks right")';

-- Migration: 20260124_audit_log.sql
-- Migration: Create mapping_audit_log table for data enrichment audit trail
-- Purpose: Track all changes made through the data enrichment system
-- Date: 2026-01-24

-- =============================================================================
-- Create audit log table
-- =============================================================================

CREATE TABLE IF NOT EXISTS mapping_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who
  user_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  user_email TEXT,  -- Denormalized for quick lookup even if user deleted

  -- What action
  action TEXT NOT NULL CHECK (action IN (
    'create', 'update', 'delete',  -- CRUD operations
    'sync_start', 'sync_complete', 'sync_fail',  -- Sync lifecycle
    'mapping_save', 'mapping_publish',  -- Mapping workflow
    'import', 'export'  -- Data operations
  )),

  -- What resource
  resource_type TEXT NOT NULL CHECK (resource_type IN (
    'data_source', 'tab_mapping', 'column_mapping', 'column_pattern',
    'computed_field', 'sync_run', 'field_lineage'
  )),
  resource_id UUID,
  resource_name TEXT,  -- Human-readable identifier (e.g., "Master Client Dashboard")

  -- Change details
  changes JSONB,  -- { field: { old: value, new: value } }
  metadata JSONB,  -- Additional context (e.g., { rows_affected: 150, dry_run: false })

  -- Security context
  ip_address INET,
  user_agent TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- Indexes for common queries
-- =============================================================================

-- Find all actions by a user
CREATE INDEX IF NOT EXISTS idx_audit_user
ON mapping_audit_log(user_id);

-- Find all actions on a resource
CREATE INDEX IF NOT EXISTS idx_audit_resource
ON mapping_audit_log(resource_type, resource_id);

-- Find actions by type
CREATE INDEX IF NOT EXISTS idx_audit_action
ON mapping_audit_log(action);

-- Time-based queries (most common - recent activity)
CREATE INDEX IF NOT EXISTS idx_audit_created
ON mapping_audit_log(created_at DESC);

-- Composite index for dashboard queries
CREATE INDEX IF NOT EXISTS idx_audit_dashboard
ON mapping_audit_log(created_at DESC, action, resource_type);

-- =============================================================================
-- Helper function for logging
-- =============================================================================

CREATE OR REPLACE FUNCTION log_mapping_audit(
  p_user_id UUID,
  p_user_email TEXT,
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id UUID,
  p_resource_name TEXT DEFAULT NULL,
  p_changes JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO mapping_audit_log (
    user_id, user_email, action, resource_type,
    resource_id, resource_name, changes, metadata,
    ip_address, user_agent
  ) VALUES (
    p_user_id, p_user_email, p_action, p_resource_type,
    p_resource_id, p_resource_name, p_changes, p_metadata,
    p_ip_address, p_user_agent
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================

-- Enable RLS
ALTER TABLE mapping_audit_log ENABLE ROW LEVEL SECURITY;

-- Admins can view all audit logs
CREATE POLICY audit_admin_read ON mapping_audit_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = auth.uid()
      AND staff.role IN ('admin', 'operations_admin')
    )
  );

-- Only the system (service role) can insert audit logs
CREATE POLICY audit_system_insert ON mapping_audit_log
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- No one can update or delete audit logs (immutable)
-- (No UPDATE or DELETE policies = denied by default)

-- Migration: 20260124_connector_config.sql
-- Migration: Backfill connection_config JSONB column in data_sources
-- Purpose: Enable pluggable connector architecture for multiple data source types
-- Date: 2024-01-24
-- Note: The connection_config column already exists from initial schema

-- =============================================================================
-- Backfill existing Google Sheets records
-- =============================================================================

-- Populate connection_config for existing records that have spreadsheet_id
UPDATE data_sources
SET connection_config = jsonb_build_object(
  'type', 'google_sheet',
  'spreadsheet_id', spreadsheet_id,
  'spreadsheet_url', spreadsheet_url
)
WHERE type = 'google_sheet'
  AND spreadsheet_id IS NOT NULL
  AND connection_config IS NULL;

-- =============================================================================
-- Create index for querying by connector type
-- =============================================================================

-- Index on the type field within connection_config for efficient filtering
CREATE INDEX IF NOT EXISTS idx_data_sources_connector_type
ON data_sources ((connection_config->>'type'))
WHERE connection_config IS NOT NULL;

-- Migration: 20260124_field_lineage.sql
-- Field Lineage Tracking
-- Records where each field value came from for data provenance

CREATE TABLE IF NOT EXISTS field_lineage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Entity reference
  entity_type TEXT NOT NULL,         -- 'partners', 'staff', 'asins'
  entity_id UUID NOT NULL,           -- ID of the entity record
  field_name TEXT NOT NULL,          -- Field that was updated

  -- Source information
  source_type TEXT NOT NULL,         -- 'google_sheet', 'api', 'app', 'manual'
  source_id UUID,                    -- data_source_id if from external
  source_ref TEXT,                   -- Human-readable: "Master Sheet → Tab → Column B"

  -- Value tracking
  previous_value JSONB,              -- Value before change
  new_value JSONB,                   -- Value after change

  -- Audit trail
  sync_run_id UUID REFERENCES sync_runs(id) ON DELETE SET NULL,
  changed_by UUID,                   -- User ID if manual, null if sync
  changed_at TIMESTAMPTZ DEFAULT NOW(),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_lineage_entity
  ON field_lineage(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_lineage_field
  ON field_lineage(entity_type, entity_id, field_name);

CREATE INDEX IF NOT EXISTS idx_lineage_source
  ON field_lineage(source_id)
  WHERE source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lineage_sync_run
  ON field_lineage(sync_run_id)
  WHERE sync_run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lineage_changed_at
  ON field_lineage(changed_at DESC);

-- Comment for documentation
COMMENT ON TABLE field_lineage IS 'Tracks the origin and history of field values across entities';
COMMENT ON COLUMN field_lineage.source_ref IS 'Human-readable reference like "Brand Master Sheet → Partners → Column D"';
COMMENT ON COLUMN field_lineage.authority IS 'Whether this source is authoritative for this field';

-- Migration: 20260125_ai_tab_summary.sql
-- Add AI summary storage to tab_mappings
-- Stores the full AI-generated summary for context and persistence

ALTER TABLE tab_mappings
ADD COLUMN IF NOT EXISTS ai_summary JSONB;

-- Add comment for documentation
COMMENT ON COLUMN tab_mappings.ai_summary IS 'AI-generated tab summary including purpose, key_column, column_categories, and data_quality_notes';

-- Migration: 20260125_system_settings.sql
-- Migration: Create system_settings table for API keys and configuration
-- Date: 2026-01-25

-- =============================================================================
-- Create system settings table
-- =============================================================================

CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,              -- 'anthropic_api_key', 'openai_api_key', etc.
  value TEXT NOT NULL,                   -- Encrypted/raw value
  encrypted BOOLEAN DEFAULT true,        -- Whether value is encrypted
  description TEXT,                      -- Human-readable description
  updated_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for key lookups
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key);

-- =============================================================================
-- Row Level Security
-- =============================================================================

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can read settings
CREATE POLICY settings_admin_read ON system_settings
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM staff
    WHERE staff.id = auth.uid()
    AND staff.role IN ('admin', 'operations_admin')
  ));

-- Only service role can insert/update (API routes use service role)
CREATE POLICY settings_service_write ON system_settings
  FOR ALL TO service_role
  WITH CHECK (true);

-- =============================================================================
-- Trigger to update updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION update_system_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_system_settings_updated_at
  BEFORE UPDATE ON system_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_system_settings_updated_at();

-- Migration: 20260127_entity_versioning.sql
-- Entity Versioning (Time Machine)
-- Tracks all INSERT/UPDATE/DELETE on core entity tables (partners, staff, asins).
-- Stores old + new row values as JSONB for full point-in-time reconstruction.
-- Storage: ~1KB per change, ~180MB/year at current scale. Negligible.

-- 1. Create the versions table
CREATE TABLE IF NOT EXISTS entity_versions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity_type TEXT NOT NULL,           -- 'partners', 'staff', 'asins'
  entity_id UUID NOT NULL,             -- Primary key of the changed row
  operation TEXT NOT NULL,             -- 'INSERT', 'UPDATE', 'DELETE'
  old_data JSONB,                      -- Row before change (NULL on INSERT)
  new_data JSONB,                      -- Row after change (NULL on DELETE)
  changed_fields TEXT[],               -- Which fields changed (UPDATE only)
  changed_by TEXT,                     -- current_user or app-set context
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX idx_entity_versions_lookup ON entity_versions (entity_type, entity_id, changed_at DESC);
CREATE INDEX idx_entity_versions_time ON entity_versions (changed_at DESC);
CREATE INDEX idx_entity_versions_operation ON entity_versions (operation) WHERE operation = 'DELETE';

COMMENT ON TABLE entity_versions IS 'Time machine: full row-level versioning of core entities. Every INSERT/UPDATE/DELETE is captured.';

-- 2. Generic trigger function (works for any table)
CREATE OR REPLACE FUNCTION track_entity_version()
RETURNS TRIGGER AS $$
DECLARE
  v_entity_type TEXT;
  v_entity_id UUID;
  v_changed TEXT[];
  v_key TEXT;
BEGIN
  v_entity_type := TG_TABLE_NAME;

  IF TG_OP = 'INSERT' THEN
    v_entity_id := NEW.id;
    INSERT INTO entity_versions (entity_type, entity_id, operation, new_data, changed_by)
    VALUES (v_entity_type, v_entity_id, 'INSERT', to_jsonb(NEW), current_user);
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    v_entity_id := NEW.id;
    -- Compute which fields actually changed
    v_changed := ARRAY(
      SELECT key FROM jsonb_each(to_jsonb(NEW))
      WHERE to_jsonb(NEW) -> key IS DISTINCT FROM to_jsonb(OLD) -> key
    );
    -- Only record if something actually changed
    IF array_length(v_changed, 1) > 0 THEN
      INSERT INTO entity_versions (entity_type, entity_id, operation, old_data, new_data, changed_fields, changed_by)
      VALUES (v_entity_type, v_entity_id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), v_changed, current_user);
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    v_entity_id := OLD.id;
    INSERT INTO entity_versions (entity_type, entity_id, operation, old_data, changed_by)
    VALUES (v_entity_type, v_entity_id, 'DELETE', to_jsonb(OLD), current_user);
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Attach triggers to core entity tables
CREATE TRIGGER partners_version_trigger
  AFTER INSERT OR UPDATE OR DELETE ON partners
  FOR EACH ROW EXECUTE FUNCTION track_entity_version();

CREATE TRIGGER staff_version_trigger
  AFTER INSERT OR UPDATE OR DELETE ON staff
  FOR EACH ROW EXECUTE FUNCTION track_entity_version();

CREATE TRIGGER asins_version_trigger
  AFTER INSERT OR UPDATE OR DELETE ON asins
  FOR EACH ROW EXECUTE FUNCTION track_entity_version();

-- 4. Row Level Security: only admins can read versions, only service_role can write
ALTER TABLE entity_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY entity_versions_read ON entity_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.email = current_setting('request.jwt.claims', true)::jsonb->>'email'
      AND s.role IN ('admin', 'operations_admin')
    )
    OR current_user = 'service_role'
  );

-- Triggers run as SECURITY DEFINER (superuser context), so inserts bypass RLS automatically.
-- Explicit policy for service_role inserts from API code:
CREATE POLICY entity_versions_insert ON entity_versions
  FOR INSERT WITH CHECK (current_user IN ('postgres', 'service_role'));

-- Migration: 20260127_source_data.sql
-- Migration: Add source_data JSONB column for zero-data-loss source capture
-- Purpose: Preserve ALL raw values from external sources (Google Sheets, etc.)
--          even for columns not mapped to predefined fields.
-- Date: 2026-01-27
--
-- Structure: { "<connector_type>": { "<tab_name>": { "<column_header>": "raw_value" } } }
-- Example:   { "gsheets": { "Master Client Sheet": { "Brand Name": "ACME", "Client Count": "0" } } }

-- =============================================================================
-- Add source_data column to all entity tables
-- =============================================================================

ALTER TABLE partners
ADD COLUMN IF NOT EXISTS source_data JSONB DEFAULT '{}'::jsonb;

ALTER TABLE staff
ADD COLUMN IF NOT EXISTS source_data JSONB DEFAULT '{}'::jsonb;

ALTER TABLE asins
ADD COLUMN IF NOT EXISTS source_data JSONB DEFAULT '{}'::jsonb;

-- =============================================================================
-- Documentation
-- =============================================================================

COMMENT ON COLUMN partners.source_data IS 'Raw values from all external sources. Structure: { connector_type: { tab_name: { column_header: raw_value } } }. No data loss — every source column is preserved.';
COMMENT ON COLUMN staff.source_data IS 'Raw values from all external sources. Structure: { connector_type: { tab_name: { column_header: raw_value } } }. No data loss — every source column is preserved.';
COMMENT ON COLUMN asins.source_data IS 'Raw values from all external sources. Structure: { connector_type: { tab_name: { column_header: raw_value } } }. No data loss — every source column is preserved.';

-- Migration: 20260127_tab_total_columns.sql
-- Add total_columns to tab_mappings for accurate progress calculation
-- Without this, progress is computed from column_mappings count only (saved columns),
-- which shows 100% when only a few columns are saved (e.g., 11/11 = 100% instead of 11/241)
ALTER TABLE tab_mappings ADD COLUMN IF NOT EXISTS total_columns INT;

COMMENT ON COLUMN tab_mappings.total_columns IS 'Total number of columns in the source sheet. Used as denominator for progress calculation.';

-- Migration: 20260128_audit_log_user_id_text.sql
-- Migration: Change mapping_audit_log.user_id from UUID to TEXT
-- Reason: NextAuth user IDs are email strings, not staff table UUIDs
-- Date: 2026-01-28

ALTER TABLE mapping_audit_log
  DROP CONSTRAINT IF EXISTS mapping_audit_log_user_id_fkey;

ALTER TABLE mapping_audit_log
  ALTER COLUMN user_id TYPE TEXT USING user_id::text;

COMMENT ON COLUMN mapping_audit_log.user_id IS 'NextAuth user identifier (email or provider ID)';
