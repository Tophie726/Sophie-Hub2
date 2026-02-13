-- SupTask Sync Run Exclusivity
-- Matches Slack's atomic single-active-run pattern:
-- 1. Partial unique index guarantees at-most-one active run
-- 2. RPC function atomically recovers stale runs + creates new one
-- 3. Stale threshold: 15 minutes

-- ============================================================================
-- Step 0: Clean up any duplicate active runs (defensive, for existing data)
-- ============================================================================

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (ORDER BY created_at DESC, id DESC) AS rn
  FROM suptask_sync_runs
  WHERE status = 'running'
)
UPDATE suptask_sync_runs
SET status = 'failed',
    finished_at = now(),
    error_summary = '[{"ticketNumber": 0, "error": "Duplicate active run cleaned up by migration"}]'::jsonb
WHERE id IN (
  SELECT id FROM ranked WHERE rn > 1
);

-- ============================================================================
-- Step 1: Partial unique index — at most one active run at a time
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_suptask_sync_runs_one_active
  ON suptask_sync_runs ((true))
  WHERE status = 'running';

-- ============================================================================
-- Step 2: Atomic RPC function for creating sync runs
-- ============================================================================

CREATE OR REPLACE FUNCTION create_suptask_sync_run_atomic(
  p_ticket_range_start INT,
  p_ticket_range_end INT
) RETURNS UUID
  LANGUAGE plpgsql
  SECURITY INVOKER
AS $$
DECLARE
  v_run_id UUID;
  v_stale_threshold TIMESTAMPTZ := now() - interval '15 minutes';
BEGIN
  -- Step 1: Atomically recover stale runs (same transaction)
  UPDATE suptask_sync_runs
    SET status = 'failed',
        finished_at = now(),
        error_summary = '[{"ticketNumber": 0, "error": "Stale run recovered — lease expired"}]'::jsonb
  WHERE status = 'running'
    AND created_at < v_stale_threshold;

  -- Step 2: Insert new run (unique index guards concurrency)
  INSERT INTO suptask_sync_runs (
    status,
    ticket_range_start,
    ticket_range_end
  )
  VALUES (
    'running',
    p_ticket_range_start,
    p_ticket_range_end
  )
  RETURNING id INTO v_run_id;

  RETURN v_run_id;
END;
$$;

-- Lock down execution — service_role only
REVOKE ALL ON FUNCTION create_suptask_sync_run_atomic(INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_suptask_sync_run_atomic(INT, INT) TO service_role;

COMMENT ON FUNCTION create_suptask_sync_run_atomic IS
  'Atomically recover stale SupTask sync runs and create a new one. '
  'Unique index ensures at most one running sync at a time.';
