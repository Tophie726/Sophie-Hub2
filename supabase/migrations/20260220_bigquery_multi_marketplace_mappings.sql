-- Allow BigQuery mappings to be one-to-many per partner (multi-marketplace).
--
-- Keep strict one-to-one behavior for staff identity sources only.
-- BigQuery still retains UNIQUE(source, external_id), so each external identifier
-- can only map to one partner.

BEGIN;

-- Deduplicate strict one-to-one sources defensively before rebuilding the index.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY entity_type, entity_id, source
      ORDER BY updated_at DESC NULLS LAST, created_at DESC, id DESC
    ) AS row_num
  FROM entity_external_ids
  WHERE source IN ('slack_user', 'google_workspace_user')
)
DELETE FROM entity_external_ids e
USING ranked r
WHERE e.id = r.id
  AND r.row_num > 1;

DROP INDEX IF EXISTS idx_entity_external_ids_one_to_one_sources;

CREATE UNIQUE INDEX idx_entity_external_ids_one_to_one_sources
  ON entity_external_ids(entity_type, entity_id, source)
  WHERE source IN ('slack_user', 'google_workspace_user');

COMMIT;
