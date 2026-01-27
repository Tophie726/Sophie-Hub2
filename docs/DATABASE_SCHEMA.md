# Sophie Hub v2 - Database Schema

## Design Principles

1. **Entity-first**: Partners and Staff are the anchors. Everything else relates to them.
2. **Clean normalization**: No redundant data. Relationships via foreign keys.
3. **Audit-ready**: created_at, updated_at on every table. Soft deletes where appropriate.
4. **Lineage-aware**: Track where data came from for trust and debugging.

---

## Tier 1: Core Entities

### partners
The brands/clients we manage. This is THE source of truth for partner data.

```sql
CREATE TABLE partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_code TEXT UNIQUE NOT NULL, -- SO-0001 format, auto-generated

  -- Core identity
  brand_name TEXT NOT NULL,
  client_name TEXT, -- Primary contact name
  client_email TEXT,
  client_phone TEXT,

  -- Status & tier
  status TEXT NOT NULL DEFAULT 'onboarding',
    -- onboarding, active, paused, at_risk, offboarding, churned
  tier TEXT DEFAULT 'tier_2',
    -- tier_0 (highest), tier_1, tier_2, tier_3, tier_4 (lowest)

  -- Financial
  base_fee DECIMAL(10,2),
  commission_rate DECIMAL(5,4), -- e.g., 0.0300 = 3%
  billing_day INT, -- Day of month for billing

  -- Dates
  onboarding_date DATE,
  contract_start_date DATE,
  contract_end_date DATE,
  churned_date DATE,

  -- Product counts (denormalized for quick access, synced from asins table)
  parent_asin_count INT DEFAULT 0,
  child_asin_count INT DEFAULT 0,

  -- Metadata
  notes TEXT,
  source_data JSONB DEFAULT '{}'::jsonb, -- Raw values from all external sources (zero-data-loss capture)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_partners_status ON partners(status);
CREATE INDEX idx_partners_brand_name ON partners(brand_name);
CREATE INDEX idx_partners_partner_code ON partners(partner_code);
```

### staff
Team members at Sophie Society. Source of truth for staff data.

```sql
CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_code TEXT UNIQUE NOT NULL, -- ST-0001 format, auto-generated

  -- Identity
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL, -- Google OAuth email
  phone TEXT,
  slack_id TEXT, -- For future Slack integration

  -- Role & position
  role TEXT NOT NULL,
    -- pod_leader, ppc_manager, brand_manager, conversion_strategist,
    -- graphic_designer, sales_executive, admin, operations, etc.
  department TEXT,
    -- ppc, content_conversion, sales, operations, finance, marketing
  title TEXT, -- Official job title

  -- Status
  status TEXT DEFAULT 'active',
    -- onboarding, active, on_leave, offboarding, departed

  -- Capacity (for pod leaders / managers)
  max_clients INT,
  current_client_count INT DEFAULT 0, -- Calculated from assignments

  -- Services they handle (for pod leaders)
  services TEXT[], -- ['ppc', 'cc', 'fam', 'pli', 'tiktok']

  -- Dates
  hire_date DATE,
  probation_end_date DATE,
  departure_date DATE,

  -- Links
  dashboard_url TEXT, -- Legacy pod leader dashboard
  calendly_url TEXT,

  -- Metadata
  source_data JSONB DEFAULT '{}'::jsonb, -- Raw values from all external sources (zero-data-loss capture)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_staff_status ON staff(status);
CREATE INDEX idx_staff_role ON staff(role);
CREATE INDEX idx_staff_email ON staff(email);
```

---

## Tier 2: Relationship Entities

### squads
Team groupings. Pod leaders belong to squads, squads have captains/leaders.

```sql
CREATE TABLE squads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, -- "Squad Alpha", "CC Team", etc.
  type TEXT NOT NULL, -- 'ppc', 'cc', 'fam', 'sales', 'operations'
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### staff_squads
Junction table for staff membership in squads.

```sql
CREATE TABLE staff_squads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  squad_id UUID NOT NULL REFERENCES squads(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member', -- 'leader', 'captain', 'member'
  assigned_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true,

  UNIQUE(staff_id, squad_id)
);

CREATE INDEX idx_staff_squads_staff ON staff_squads(staff_id);
CREATE INDEX idx_staff_squads_squad ON staff_squads(squad_id);
```

### partner_assignments
Who manages which partner. A partner can have multiple staff assigned.

```sql
CREATE TABLE partner_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,

  assignment_role TEXT NOT NULL,
    -- 'pod_leader', 'brand_manager', 'conversion_strategist',
    -- 'ppc_manager', 'graphic_designer', 'sales_rep'

  is_primary BOOLEAN DEFAULT false, -- Primary contact for this role
  assigned_at TIMESTAMPTZ DEFAULT now(),
  unassigned_at TIMESTAMPTZ, -- Null if still active

  notes TEXT,

  UNIQUE(partner_id, staff_id, assignment_role)
);

CREATE INDEX idx_partner_assignments_partner ON partner_assignments(partner_id);
CREATE INDEX idx_partner_assignments_staff ON partner_assignments(staff_id);
CREATE INDEX idx_partner_assignments_active ON partner_assignments(partner_id) WHERE unassigned_at IS NULL;
```

---

## Tier 3: Domain Entities

### asins
Amazon products managed under each partner.

```sql
CREATE TABLE asins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,

  -- ASIN identity
  asin_code TEXT NOT NULL, -- The actual Amazon ASIN
  parent_asin TEXT, -- Parent ASIN if this is a child variation
  is_parent BOOLEAN DEFAULT false,

  -- Product info
  title TEXT,
  sku TEXT,
  category TEXT,

  -- Status
  status TEXT DEFAULT 'active', -- 'active', 'paused', 'discontinued'

  -- Financials (if tracked)
  cogs DECIMAL(10,2), -- Cost of goods sold
  price DECIMAL(10,2),

  -- Linked sheets (verified URLs)
  kw_research_sheet_url TEXT,
  kw_research_verified_at TIMESTAMPTZ,

  market_analysis_sheet_url TEXT,
  market_analysis_verified_at TIMESTAMPTZ,

  campaign_structure_sheet_url TEXT,
  campaign_structure_verified_at TIMESTAMPTZ,

  -- Metadata
  source_data JSONB DEFAULT '{}'::jsonb, -- Raw values from all external sources (zero-data-loss capture)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(partner_id, asin_code)
);

CREATE INDEX idx_asins_partner ON asins(partner_id);
CREATE INDEX idx_asins_code ON asins(asin_code);
CREATE INDEX idx_asins_parent ON asins(parent_asin);
```

### weekly_statuses
Time-series data tracking partner health week by week.

```sql
CREATE TABLE weekly_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,

  -- Time period
  week_start_date DATE NOT NULL, -- Monday of the week
  week_number INT, -- Week number in year (1-52)
  year INT,

  -- Status reported
  status TEXT NOT NULL, -- 'active', 'paused', 'at_risk', etc.

  -- Who reported
  reported_by UUID REFERENCES staff(id),
  reported_at TIMESTAMPTZ DEFAULT now(),

  -- Notes
  notes TEXT,
  happy_client BOOLEAN, -- Manual flag from pod leader

  -- Metrics (optional, for future)
  metrics JSONB,

  UNIQUE(partner_id, week_start_date)
);

CREATE INDEX idx_weekly_statuses_partner ON weekly_statuses(partner_id);
CREATE INDEX idx_weekly_statuses_week ON weekly_statuses(week_start_date);
```

### partner_sheets
Links to Google Sheets associated with partners (beyond ASIN-level sheets).

```sql
CREATE TABLE partner_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  asin_id UUID REFERENCES asins(id) ON DELETE SET NULL, -- Optional ASIN association

  sheet_type TEXT NOT NULL,
    -- 'brand_info', 'internal_brand', 'kw_research', 'market_analysis',
    -- 'campaign_structure', 'notion', 'other'

  sheet_url TEXT NOT NULL,
  sheet_name TEXT, -- Human-readable name

  -- Verification
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES staff(id),

  -- Status
  status TEXT DEFAULT 'active', -- 'active', 'archived', 'broken'
  last_accessed_at TIMESTAMPTZ,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_partner_sheets_partner ON partner_sheets(partner_id);
CREATE INDEX idx_partner_sheets_type ON partner_sheets(sheet_type);
```

### staff_training
Training module progress per staff member.

```sql
CREATE TABLE staff_training (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,

  module_name TEXT NOT NULL, -- 'onboarding', 'ppc_basics', 'cc_advanced', etc.
  module_type TEXT, -- 'required', 'optional', 'refresher'

  status TEXT DEFAULT 'not_started',
    -- 'not_started', 'in_progress', 'completed', 'needs_refresher'

  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  due_date DATE,

  score DECIMAL(5,2), -- If module has assessment
  attempts INT DEFAULT 0,

  notes TEXT,

  UNIQUE(staff_id, module_name)
);

CREATE INDEX idx_staff_training_staff ON staff_training(staff_id);
CREATE INDEX idx_staff_training_status ON staff_training(status);
```

### pto_records
Paid time off tracking.

```sql
CREATE TABLE pto_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,

  start_date DATE NOT NULL,
  end_date DATE NOT NULL,

  type TEXT DEFAULT 'vacation', -- 'vacation', 'sick', 'personal', 'holiday'
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'cancelled'

  approved_by UUID REFERENCES staff(id),
  approved_at TIMESTAMPTZ,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_pto_records_staff ON pto_records(staff_id);
CREATE INDEX idx_pto_records_dates ON pto_records(start_date, end_date);
```

---

## Tier 4: Reference/Config Entities

### external_contacts
People outside the organization we interact with (Amazon reps, partners, etc.)

```sql
CREATE TABLE external_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name TEXT NOT NULL,
  company TEXT,
  type TEXT NOT NULL, -- 'amazon_rep', 'partner_referral', 'vendor', 'other'

  email TEXT,
  phone TEXT,
  linkedin_url TEXT,

  notes TEXT,
  tags TEXT[],

  -- Who added/manages this contact
  added_by UUID REFERENCES staff(id),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_external_contacts_type ON external_contacts(type);
```

### system_settings
Application configuration key-value store.

```sql
CREATE TABLE system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  category TEXT, -- 'general', 'notifications', 'integrations'
  description TEXT,
  updated_by UUID REFERENCES staff(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Data Enrichment Pipeline Tables

### data_sources
Configured external data sources.

```sql
CREATE TABLE data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name TEXT NOT NULL, -- Human-readable name
  type TEXT NOT NULL, -- 'google_sheet', 'google_form', 'api', 'csv'

  -- Connection details
  connection_config JSONB NOT NULL,
    -- For sheets: { url, sheet_id, credentials_ref }
    -- For API: { endpoint, auth_type, credentials_ref }

  -- Status
  status TEXT DEFAULT 'active', -- 'active', 'paused', 'error', 'archived'
  last_synced_at TIMESTAMPTZ,
  last_sync_error TEXT,

  -- Sync configuration
  sync_mode TEXT DEFAULT 'manual', -- 'manual', 'scheduled'
  sync_schedule TEXT, -- Cron expression if scheduled

  -- Metadata
  description TEXT,
  created_by UUID REFERENCES staff(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_data_sources_status ON data_sources(status);
```

### field_mappings
How source fields map to target tables.

```sql
CREATE TABLE field_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,

  -- Source field identification
  source_tab TEXT, -- Sheet tab name (null for single-tab sources)
  source_column TEXT NOT NULL, -- Column header name
  source_column_index INT, -- Fallback if no header

  -- Target field
  target_table TEXT NOT NULL, -- 'partners', 'staff', 'asins', etc.
  target_field TEXT NOT NULL, -- Column name in target

  -- Transform configuration
  transform_type TEXT DEFAULT 'none',
    -- 'none', 'date', 'currency', 'number', 'boolean', 'lookup', 'custom'
  transform_config JSONB, -- { format: 'MM/DD/YYYY', currency: 'USD', etc. }

  -- Authority
  is_authoritative BOOLEAN DEFAULT false, -- Is this THE source for this field?
  priority INT DEFAULT 0, -- Higher = preferred when multiple sources

  -- Status
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(data_source_id, source_tab, source_column)
);

CREATE INDEX idx_field_mappings_source ON field_mappings(data_source_id);
CREATE INDEX idx_field_mappings_target ON field_mappings(target_table, target_field);
```

### staged_changes
Pending changes awaiting admin review.

```sql
CREATE TABLE staged_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL, -- Groups changes from same sync run
  data_source_id UUID REFERENCES data_sources(id) ON DELETE SET NULL,

  -- What's changing
  entity_type TEXT NOT NULL, -- 'partner', 'staff', 'asin', 'assignment'
  entity_key TEXT NOT NULL, -- Natural key for matching (brand_name, email, etc.)
  entity_id UUID, -- FK to existing record (null for creates)

  -- Change details
  change_type TEXT NOT NULL, -- 'create', 'update', 'delete'
  old_values JSONB, -- Previous values (null for create)
  new_values JSONB NOT NULL, -- New values
  changed_fields TEXT[], -- List of changed field names

  -- Review workflow
  status TEXT DEFAULT 'pending',
    -- 'pending', 'approved', 'rejected', 'applied', 'failed', 'conflict'
  reviewed_by UUID REFERENCES staff(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Application
  applied_at TIMESTAMPTZ,
  apply_error TEXT,

  -- Traceability
  source_reference TEXT, -- "Row 42 of Tab 'Master Client Sheet'"

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_staged_changes_batch ON staged_changes(batch_id);
CREATE INDEX idx_staged_changes_status ON staged_changes(status);
CREATE INDEX idx_staged_changes_entity ON staged_changes(entity_type, entity_key);
```

### field_lineage
Tracks where each field value originated.

```sql
CREATE TABLE field_lineage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  entity_type TEXT NOT NULL, -- 'partner', 'staff', etc.
  entity_id UUID NOT NULL, -- FK to the record
  field_name TEXT NOT NULL, -- Which field

  -- Current state
  current_value TEXT,
  authoritative_source_id UUID REFERENCES data_sources(id),
  last_updated_at TIMESTAMPTZ DEFAULT now(),

  -- History (for audit trail)
  history JSONB DEFAULT '[]'::jsonb,
    -- Array of { value, source_id, source_name, timestamp, changed_by }

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(entity_type, entity_id, field_name)
);

CREATE INDEX idx_field_lineage_entity ON field_lineage(entity_type, entity_id);
```

### sync_logs
Audit log of all sync operations.

```sql
CREATE TABLE sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL,
  data_source_id UUID REFERENCES data_sources(id),

  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,

  status TEXT DEFAULT 'running', -- 'running', 'completed', 'failed', 'cancelled'

  -- Stats
  records_scanned INT DEFAULT 0,
  changes_staged INT DEFAULT 0,
  changes_approved INT DEFAULT 0,
  changes_applied INT DEFAULT 0,
  errors INT DEFAULT 0,

  -- Details
  error_log JSONB,
  initiated_by UUID REFERENCES staff(id),

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sync_logs_batch ON sync_logs(batch_id);
CREATE INDEX idx_sync_logs_source ON sync_logs(data_source_id);
```

---

## Helper Functions

### Auto-generate partner_code
```sql
CREATE OR REPLACE FUNCTION generate_partner_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.partner_code IS NULL THEN
    NEW.partner_code := 'SO-' || LPAD(
      (SELECT COALESCE(MAX(CAST(SUBSTRING(partner_code FROM 4) AS INT)), 0) + 1
       FROM partners)::TEXT,
      4, '0'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_partner_code
  BEFORE INSERT ON partners
  FOR EACH ROW
  EXECUTE FUNCTION generate_partner_code();
```

### Auto-generate staff_code
```sql
CREATE OR REPLACE FUNCTION generate_staff_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.staff_code IS NULL THEN
    NEW.staff_code := 'ST-' || LPAD(
      (SELECT COALESCE(MAX(CAST(SUBSTRING(staff_code FROM 4) AS INT)), 0) + 1
       FROM staff)::TEXT,
      4, '0'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_staff_code
  BEFORE INSERT ON staff
  FOR EACH ROW
  EXECUTE FUNCTION generate_staff_code();
```

### Auto-update updated_at
```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_partners_updated_at
  BEFORE UPDATE ON partners FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_staff_updated_at
  BEFORE UPDATE ON staff FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ... (repeat for other tables)
```

---

## Row Level Security (RLS)

To be implemented based on auth roles. Example for partners:

```sql
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;

-- Admins can see all
CREATE POLICY admin_all ON partners
  FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');

-- Pod leaders see their assigned partners
CREATE POLICY pod_leader_assigned ON partners
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM partner_assignments pa
      WHERE pa.partner_id = partners.id
      AND pa.staff_id = (auth.jwt() ->> 'staff_id')::uuid
      AND pa.unassigned_at IS NULL
    )
  );
```

---

## Migration Order

1. Core types/enums (if using)
2. `staff` (no dependencies)
3. `squads` (no dependencies)
4. `partners` (no dependencies)
5. `staff_squads` (depends on staff, squads)
6. `partner_assignments` (depends on partners, staff)
7. `asins` (depends on partners)
8. `weekly_statuses` (depends on partners, staff)
9. `partner_sheets` (depends on partners, asins, staff)
10. `staff_training` (depends on staff)
11. `pto_records` (depends on staff)
12. `external_contacts` (depends on staff)
13. `system_settings` (depends on staff)
14. `data_sources` (depends on staff)
15. `field_mappings` (depends on data_sources)
16. `staged_changes` (depends on data_sources, staff)
17. `field_lineage` (depends on data_sources)
18. `sync_logs` (depends on data_sources, staff)
19. Triggers and functions
20. RLS policies
