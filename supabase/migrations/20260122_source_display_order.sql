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
