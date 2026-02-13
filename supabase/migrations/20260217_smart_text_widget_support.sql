-- Add Smart Text support to dashboard widgets + seed Smart Text module.
-- Keeps constraints aligned with current widget types used by the app.

-- ============================================================================
-- UP
-- ============================================================================

-- Rebuild widget-type constraint to include ai_text + smart_text.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'dashboard_widgets'
      AND constraint_name = 'dashboard_widgets_type_check'
  ) THEN
    ALTER TABLE dashboard_widgets
      DROP CONSTRAINT dashboard_widgets_type_check;
  END IF;
END $$;

ALTER TABLE dashboard_widgets
  ADD CONSTRAINT dashboard_widgets_type_check
  CHECK (widget_type IN ('metric', 'chart', 'table', 'text', 'ai_text', 'smart_text'));

-- Rebuild span constraints to match the current builder limits.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'dashboard_widgets'
      AND constraint_name = 'dashboard_widgets_col_span_check'
  ) THEN
    ALTER TABLE dashboard_widgets
      DROP CONSTRAINT dashboard_widgets_col_span_check;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'dashboard_widgets'
      AND constraint_name = 'dashboard_widgets_row_span_check'
  ) THEN
    ALTER TABLE dashboard_widgets
      DROP CONSTRAINT dashboard_widgets_row_span_check;
  END IF;
END $$;

ALTER TABLE dashboard_widgets
  ADD CONSTRAINT dashboard_widgets_col_span_check
  CHECK (col_span >= 1 AND col_span <= 8);

ALTER TABLE dashboard_widgets
  ADD CONSTRAINT dashboard_widgets_row_span_check
  CHECK (row_span >= 1 AND row_span <= 4);

-- Seed Smart Text module for assignment in Views builder.
INSERT INTO modules (slug, name, description, icon, color, sort_order)
VALUES (
  'smart-text',
  'Smart Text',
  'Dynamic text blocks with personalized content.',
  'FileText',
  'violet',
  3
)
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color;

-- ============================================================================
-- DOWN
-- ============================================================================
-- ALTER TABLE dashboard_widgets DROP CONSTRAINT IF EXISTS dashboard_widgets_type_check;
-- ALTER TABLE dashboard_widgets ADD CONSTRAINT dashboard_widgets_type_check
--   CHECK (widget_type IN ('metric', 'chart', 'table', 'text', 'ai_text'));
-- ALTER TABLE dashboard_widgets DROP CONSTRAINT IF EXISTS dashboard_widgets_col_span_check;
-- ALTER TABLE dashboard_widgets ADD CONSTRAINT dashboard_widgets_col_span_check
--   CHECK (col_span >= 1 AND col_span <= 8);
-- ALTER TABLE dashboard_widgets DROP CONSTRAINT IF EXISTS dashboard_widgets_row_span_check;
-- ALTER TABLE dashboard_widgets ADD CONSTRAINT dashboard_widgets_row_span_check
--   CHECK (row_span >= 1 AND row_span <= 4);
-- DELETE FROM modules WHERE slug = 'smart-text';
