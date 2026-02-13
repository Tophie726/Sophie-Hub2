-- Staff multi-tag lifecycle support (secondary statuses/flags).
ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS status_tags TEXT[] DEFAULT '{}'::TEXT[];

UPDATE staff
SET status_tags = '{}'::TEXT[]
WHERE status_tags IS NULL;

ALTER TABLE staff
  ALTER COLUMN status_tags SET DEFAULT '{}'::TEXT[];

ALTER TABLE staff
  ALTER COLUMN status_tags SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_staff_status_tags
  ON staff USING GIN (status_tags);

COMMENT ON COLUMN staff.status_tags IS
  'Supplemental lifecycle tags (multi-select), separate from primary status.';
