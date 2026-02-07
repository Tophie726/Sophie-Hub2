-- Relax entity_external_ids constraint to allow multiple external IDs per entity per source.
--
-- The original UNIQUE(entity_type, entity_id, source) prevented a partner from having
-- more than one Slack channel mapping. Partners can legitimately have multiple channels
-- (e.g., "client-acme-general" and "client-acme-finance").
--
-- Replace with UNIQUE(entity_type, entity_id, source, external_id) which prevents
-- duplicate (entity, external_id) pairs but allows multiple different external_ids
-- per entity per source.
--
-- Keep DB-enforced one-to-one for specific sources that must remain singular:
--   - bigquery (partners -> one client_name)
--   - slack_user (staff -> one Slack user)

-- 1. Drop the old constraint
ALTER TABLE entity_external_ids
  DROP CONSTRAINT IF EXISTS entity_external_ids_unique_entity_source;

-- 2. Add the new, relaxed constraint
ALTER TABLE entity_external_ids
  ADD CONSTRAINT entity_external_ids_unique_entity_source_external
    UNIQUE(entity_type, entity_id, source, external_id);

-- 3. Deduplicate one-to-one sources before adding strict partial unique index
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY entity_type, entity_id, source
      ORDER BY updated_at DESC NULLS LAST, created_at DESC, id DESC
    ) AS row_num
  FROM entity_external_ids
  WHERE source IN ('bigquery', 'slack_user')
)
DELETE FROM entity_external_ids e
USING ranked r
WHERE e.id = r.id
  AND r.row_num > 1;

-- 4. Reintroduce one-to-one semantics for sources that require it
CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_external_ids_one_to_one_sources
  ON entity_external_ids(entity_type, entity_id, source)
  WHERE source IN ('bigquery', 'slack_user');
