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
