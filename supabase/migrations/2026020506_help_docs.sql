-- Help Documentation System
-- Centralized storage for user-facing help content (workflow steps, tooltips, etc.)

-- Main help docs table
CREATE TABLE help_docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id TEXT UNIQUE NOT NULL,                    -- e.g., "change-approval", "partners-overview"
  route_pattern TEXT,                              -- e.g., "/admin/change-approval"
  scope TEXT NOT NULL CHECK (scope IN ('page', 'section', 'workflow', 'field')),
  category TEXT NOT NULL CHECK (category IN ('core', 'admin', 'workflow', 'reference')),
  title TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}',            -- Structured content (steps, tips, etc.)

  -- AI metadata
  ai_generated BOOLEAN DEFAULT FALSE,
  ai_confidence REAL CHECK (ai_confidence >= 0 AND ai_confidence <= 1),
  ai_model TEXT,
  source_files TEXT[],                            -- Files AI analyzed to generate this

  -- Versioning
  version INTEGER DEFAULT 1,
  requires_review BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ                        -- NULL = draft, set when published

);

-- Indexes for common queries
CREATE INDEX idx_help_docs_doc_id ON help_docs(doc_id);
CREATE INDEX idx_help_docs_route ON help_docs(route_pattern);
CREATE INDEX idx_help_docs_scope ON help_docs(scope);
CREATE INDEX idx_help_docs_category ON help_docs(category);

-- Version history for rollback and audit
CREATE TABLE help_doc_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  help_doc_id UUID NOT NULL REFERENCES help_docs(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  content JSONB NOT NULL,
  changed_by TEXT,                                -- email or "ai"
  change_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(help_doc_id, version)
);

CREATE INDEX idx_help_doc_versions_doc ON help_doc_versions(help_doc_id);

-- Add help_system_enabled to system_settings if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_settings') THEN
    -- Check if column exists before adding
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'system_settings' AND column_name = 'help_system_enabled') THEN
      ALTER TABLE system_settings ADD COLUMN help_system_enabled BOOLEAN DEFAULT TRUE;
    END IF;
  END IF;
END $$;

-- RLS Policies
ALTER TABLE help_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE help_doc_versions ENABLE ROW LEVEL SECURITY;

-- Help docs: readable by all authenticated users (published only), writable by admins
CREATE POLICY "Published help docs readable by authenticated users"
  ON help_docs FOR SELECT
  TO authenticated
  USING (published_at IS NOT NULL);

CREATE POLICY "Help docs manageable by admins"
  ON help_docs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND staff.role IN ('admin', 'operations_admin')
    )
  );

CREATE POLICY "Version history readable by admins"
  ON help_doc_versions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND staff.role IN ('admin', 'operations_admin')
    )
  );

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_help_docs_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER help_docs_updated_at
  BEFORE UPDATE ON help_docs
  FOR EACH ROW
  EXECUTE FUNCTION update_help_docs_timestamp();

-- Trigger to create version history on update
CREATE OR REPLACE FUNCTION create_help_doc_version()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create version if content changed
  IF OLD.content IS DISTINCT FROM NEW.content THEN
    INSERT INTO help_doc_versions (help_doc_id, version, content, changed_by)
    VALUES (OLD.id, OLD.version, OLD.content, COALESCE(NEW.ai_generated::text, 'manual'));

    -- Increment version
    NEW.version = OLD.version + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER help_docs_version_history
  BEFORE UPDATE ON help_docs
  FOR EACH ROW
  EXECUTE FUNCTION create_help_doc_version();

-- Seed initial help doc for change approval
INSERT INTO help_docs (doc_id, route_pattern, scope, category, title, content, published_at)
VALUES (
  'change-approval',
  '/admin/change-approval',
  'workflow',
  'admin',
  'How Change Approval Works',
  '{
    "overview": "Review and approve data changes before they are applied to the database.",
    "steps": [
      {
        "title": "Changes Detected",
        "description": "When data syncs from your sources (automatically or manually), any differences are staged here for review."
      },
      {
        "title": "Review Changes",
        "description": "See exactly what will change: new records, updates, and field-level diffs showing before and after values."
      },
      {
        "title": "Approve & Apply",
        "description": "Approve changes to apply them to the database, or reject to discard. All actions are logged."
      }
    ],
    "tips": [
      "Data syncs automatically on a daily basis",
      "Review field-level diffs carefully before approving",
      "Rejected changes can be re-synced later if needed"
    ]
  }',
  NOW()
) ON CONFLICT (doc_id) DO NOTHING;
