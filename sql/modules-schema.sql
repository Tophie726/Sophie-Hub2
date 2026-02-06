-- Modules & Dashboards Schema
--
-- Creates the tables for the modular dashboard system:
--   modules → dashboards → dashboard_sections → dashboard_widgets
--
-- Run in Supabase SQL Editor or as a migration.

-- =============================================================================
-- 1. MODULES table
-- =============================================================================

CREATE TABLE IF NOT EXISTS modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE modules IS 'Top-level groupings for dashboard features (e.g., Amazon Reporting)';
COMMENT ON COLUMN modules.slug IS 'URL-safe identifier (e.g., amazon-reporting)';
COMMENT ON COLUMN modules.icon IS 'Lucide icon name for UI display';
COMMENT ON COLUMN modules.config IS 'Module-specific settings as JSONB';

-- =============================================================================
-- 2. DASHBOARDS table
-- =============================================================================

CREATE TABLE IF NOT EXISTS dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  partner_id UUID REFERENCES partners(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  is_template BOOLEAN NOT NULL DEFAULT false,
  date_range_default TEXT DEFAULT '30d',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE dashboards IS 'A dashboard belongs to a module and optionally a specific partner';
COMMENT ON COLUMN dashboards.partner_id IS 'NULL for template dashboards, set for partner-specific instances';
COMMENT ON COLUMN dashboards.is_template IS 'Template dashboards are cloned for each partner';
COMMENT ON COLUMN dashboards.date_range_default IS 'Default date range preset: 7d, 30d, 90d, custom';

-- =============================================================================
-- 3. DASHBOARD_SECTIONS table
-- =============================================================================

CREATE TABLE IF NOT EXISTS dashboard_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  collapsed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE dashboard_sections IS 'Sections group widgets within a dashboard';

-- =============================================================================
-- 4. DASHBOARD_WIDGETS table
-- =============================================================================

CREATE TABLE IF NOT EXISTS dashboard_widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES dashboard_sections(id) ON DELETE CASCADE,
  widget_type TEXT NOT NULL,
  title TEXT NOT NULL,
  grid_column INT NOT NULL DEFAULT 0,
  grid_row INT NOT NULL DEFAULT 0,
  col_span INT NOT NULL DEFAULT 1,
  row_span INT NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Only valid widget types
  CONSTRAINT dashboard_widgets_type_check
    CHECK (widget_type IN ('metric', 'chart', 'table', 'text')),

  -- Grid constraints
  CONSTRAINT dashboard_widgets_col_span_check CHECK (col_span >= 1 AND col_span <= 4),
  CONSTRAINT dashboard_widgets_row_span_check CHECK (row_span >= 1 AND row_span <= 4)
);

COMMENT ON TABLE dashboard_widgets IS 'Individual data widgets within a dashboard section';
COMMENT ON COLUMN dashboard_widgets.widget_type IS 'Widget type: metric, chart, table, or text';
COMMENT ON COLUMN dashboard_widgets.config IS 'Widget-specific configuration as JSONB (see WidgetConfig types)';

-- =============================================================================
-- 5. INDEXES
-- =============================================================================

-- Dashboards: lookup by module
CREATE INDEX idx_dashboards_module_id ON dashboards(module_id);

-- Dashboards: lookup by partner
CREATE INDEX idx_dashboards_partner_id ON dashboards(partner_id) WHERE partner_id IS NOT NULL;

-- Dashboards: find templates
CREATE INDEX idx_dashboards_template ON dashboards(module_id, is_template) WHERE is_template = true;

-- Sections: lookup by dashboard, ordered
CREATE INDEX idx_dashboard_sections_dashboard_id ON dashboard_sections(dashboard_id, sort_order);

-- Widgets: lookup by dashboard
CREATE INDEX idx_dashboard_widgets_dashboard_id ON dashboard_widgets(dashboard_id);

-- Widgets: lookup by section, ordered
CREATE INDEX idx_dashboard_widgets_section_id ON dashboard_widgets(section_id, sort_order);

-- =============================================================================
-- 6. UPDATED_AT TRIGGERS
-- =============================================================================

CREATE OR REPLACE FUNCTION update_modules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER modules_updated_at
  BEFORE UPDATE ON modules
  FOR EACH ROW EXECUTE FUNCTION update_modules_updated_at();

CREATE OR REPLACE FUNCTION update_dashboards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER dashboards_updated_at
  BEFORE UPDATE ON dashboards
  FOR EACH ROW EXECUTE FUNCTION update_dashboards_updated_at();

CREATE OR REPLACE FUNCTION update_dashboard_widgets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER dashboard_widgets_updated_at
  BEFORE UPDATE ON dashboard_widgets
  FOR EACH ROW EXECUTE FUNCTION update_dashboard_widgets_updated_at();

-- =============================================================================
-- 7. ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_widgets ENABLE ROW LEVEL SECURITY;

-- Modules: all authenticated users can read enabled modules
CREATE POLICY modules_read ON modules
  FOR SELECT USING (
    current_user = 'service_role'
    OR (
      enabled = true
      AND EXISTS (
        SELECT 1 FROM staff s
        WHERE s.email = current_setting('request.jwt.claims', true)::jsonb->>'email'
      )
    )
  );

-- Modules: only admins can write
CREATE POLICY modules_write ON modules
  FOR ALL USING (
    current_user = 'service_role'
    OR EXISTS (
      SELECT 1 FROM staff s
      WHERE s.email = current_setting('request.jwt.claims', true)::jsonb->>'email'
      AND s.role IN ('admin', 'operations_admin')
    )
  );

-- Dashboards: authenticated users can read
CREATE POLICY dashboards_read ON dashboards
  FOR SELECT USING (
    current_user = 'service_role'
    OR EXISTS (
      SELECT 1 FROM staff s
      WHERE s.email = current_setting('request.jwt.claims', true)::jsonb->>'email'
    )
  );

-- Dashboards: only admins can write
CREATE POLICY dashboards_write ON dashboards
  FOR ALL USING (
    current_user = 'service_role'
    OR EXISTS (
      SELECT 1 FROM staff s
      WHERE s.email = current_setting('request.jwt.claims', true)::jsonb->>'email'
      AND s.role IN ('admin', 'operations_admin')
    )
  );

-- Sections: authenticated users can read
CREATE POLICY dashboard_sections_read ON dashboard_sections
  FOR SELECT USING (
    current_user = 'service_role'
    OR EXISTS (
      SELECT 1 FROM staff s
      WHERE s.email = current_setting('request.jwt.claims', true)::jsonb->>'email'
    )
  );

-- Sections: only admins can write
CREATE POLICY dashboard_sections_write ON dashboard_sections
  FOR ALL USING (
    current_user = 'service_role'
    OR EXISTS (
      SELECT 1 FROM staff s
      WHERE s.email = current_setting('request.jwt.claims', true)::jsonb->>'email'
      AND s.role IN ('admin', 'operations_admin')
    )
  );

-- Widgets: authenticated users can read
CREATE POLICY dashboard_widgets_read ON dashboard_widgets
  FOR SELECT USING (
    current_user = 'service_role'
    OR EXISTS (
      SELECT 1 FROM staff s
      WHERE s.email = current_setting('request.jwt.claims', true)::jsonb->>'email'
    )
  );

-- Widgets: only admins can write
CREATE POLICY dashboard_widgets_write ON dashboard_widgets
  FOR ALL USING (
    current_user = 'service_role'
    OR EXISTS (
      SELECT 1 FROM staff s
      WHERE s.email = current_setting('request.jwt.claims', true)::jsonb->>'email'
      AND s.role IN ('admin', 'operations_admin')
    )
  );

-- =============================================================================
-- 8. SEED DATA: Amazon Reporting module
-- =============================================================================

-- Insert the Amazon Reporting module
INSERT INTO modules (id, slug, name, description, icon, color, sort_order)
VALUES (
  gen_random_uuid(),
  'amazon-reporting',
  'Amazon Reporting',
  'Sales, advertising, and product performance dashboards powered by BigQuery',
  'BarChart3',
  'orange',
  1
)
ON CONFLICT (slug) DO NOTHING;

-- Create a template dashboard with sections and sample widgets
DO $$
DECLARE
  v_module_id UUID;
  v_dashboard_id UUID;
  v_overview_section_id UUID;
  v_ads_section_id UUID;
BEGIN
  -- Get the module ID
  SELECT id INTO v_module_id FROM modules WHERE slug = 'amazon-reporting';

  -- Only seed if module exists and no template dashboard yet
  IF v_module_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM dashboards WHERE module_id = v_module_id AND is_template = true
  ) THEN

    -- Create template dashboard
    INSERT INTO dashboards (id, module_id, title, description, is_template, date_range_default)
    VALUES (
      gen_random_uuid(),
      v_module_id,
      'Amazon Performance Overview',
      'Key sales and advertising metrics for your Amazon business',
      true,
      '30d'
    )
    RETURNING id INTO v_dashboard_id;

    -- Section 1: Sales Overview
    INSERT INTO dashboard_sections (id, dashboard_id, title, sort_order)
    VALUES (gen_random_uuid(), v_dashboard_id, 'Sales Overview', 0)
    RETURNING id INTO v_overview_section_id;

    -- Section 2: Advertising Performance
    INSERT INTO dashboard_sections (id, dashboard_id, title, sort_order)
    VALUES (gen_random_uuid(), v_dashboard_id, 'Advertising Performance', 1)
    RETURNING id INTO v_ads_section_id;

    -- Widget 1: Total Sales (metric)
    INSERT INTO dashboard_widgets (dashboard_id, section_id, widget_type, title, grid_column, grid_row, col_span, sort_order, config)
    VALUES (
      v_dashboard_id, v_overview_section_id, 'metric', 'Total Sales', 0, 0, 1, 0,
      '{"view": "sales", "metric": "ordered_product_sales_amount", "aggregation": "sum", "format": "currency"}'::jsonb
    );

    -- Widget 2: Total Orders (metric)
    INSERT INTO dashboard_widgets (dashboard_id, section_id, widget_type, title, grid_column, grid_row, col_span, sort_order, config)
    VALUES (
      v_dashboard_id, v_overview_section_id, 'metric', 'Total Orders', 1, 0, 1, 1,
      '{"view": "sales", "metric": "units_ordered", "aggregation": "sum", "format": "number"}'::jsonb
    );

    -- Widget 3: Units Refunded (metric)
    INSERT INTO dashboard_widgets (dashboard_id, section_id, widget_type, title, grid_column, grid_row, col_span, sort_order, config)
    VALUES (
      v_dashboard_id, v_overview_section_id, 'metric', 'Units Refunded', 2, 0, 1, 2,
      '{"view": "refunds", "metric": "units_refunded", "aggregation": "sum", "format": "number"}'::jsonb
    );

    -- Widget 4: Sales Trend (chart)
    INSERT INTO dashboard_widgets (dashboard_id, section_id, widget_type, title, grid_column, grid_row, col_span, sort_order, config)
    VALUES (
      v_dashboard_id, v_overview_section_id, 'chart', 'Sales Trend', 0, 1, 2, 3,
      '{"view": "sales", "chart_type": "line", "x_axis": "date", "y_axis": ["ordered_product_sales_amount"], "aggregation": "sum", "format": "currency"}'::jsonb
    );

    -- Widget 5: Ad Spend (metric)
    INSERT INTO dashboard_widgets (dashboard_id, section_id, widget_type, title, grid_column, grid_row, col_span, sort_order, config)
    VALUES (
      v_dashboard_id, v_ads_section_id, 'metric', 'Ad Spend', 0, 0, 1, 0,
      '{"view": "sp", "metric": "ppc_spend", "aggregation": "sum", "format": "currency"}'::jsonb
    );

    -- Widget 6: Ad Sales (metric)
    INSERT INTO dashboard_widgets (dashboard_id, section_id, widget_type, title, grid_column, grid_row, col_span, sort_order, config)
    VALUES (
      v_dashboard_id, v_ads_section_id, 'metric', 'Ad Sales', 1, 0, 1, 1,
      '{"view": "sp", "metric": "ppc_sales", "aggregation": "sum", "format": "currency"}'::jsonb
    );

    -- Widget 7: Top Campaigns (table)
    INSERT INTO dashboard_widgets (dashboard_id, section_id, widget_type, title, grid_column, grid_row, col_span, sort_order, config)
    VALUES (
      v_dashboard_id, v_ads_section_id, 'table', 'Top Campaigns by Ad Spend', 0, 1, 3, 2,
      '{"view": "sp", "columns": ["campaign_name", "impressions", "clicks", "ppc_spend", "ppc_sales"], "sort_by": "ppc_spend", "sort_direction": "desc", "limit": 10}'::jsonb
    );

  END IF;
END $$;
