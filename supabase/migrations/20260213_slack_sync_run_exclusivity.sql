-- =============================================================================
-- Slack Sync Run Exclusivity + Stale-Run Recovery
--
-- 1. Deterministic cleanup of any existing duplicate active runs
-- 2. Partial unique index ensuring at most one active run
-- 3. Atomic RPC function for stale-run recovery + new run creation
-- =============================================================================

-- Step 1: Deterministic duplicate cleanup
-- Keep the newest active run (by created_at DESC, id DESC for tie-safety)
-- Mark all older active runs as cancelled
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (ORDER BY created_at DESC, id DESC) AS rn
  FROM slack_sync_runs
  WHERE status IN ('pending', 'running')
)
UPDATE slack_sync_runs
SET status = 'cancelled',
    error = 'Duplicate active run cleaned up by migration 20260213',
    completed_at = now()
WHERE id IN (
  SELECT id FROM ranked WHERE rn > 1
);

-- Step 2: Partial unique index — at most one active run at any time
CREATE UNIQUE INDEX IF NOT EXISTS idx_slack_sync_runs_one_active
  ON slack_sync_runs ((true))
  WHERE status IN ('pending', 'running');

-- Step 3: Atomic RPC function for stale-run recovery + creation
CREATE OR REPLACE FUNCTION create_sync_run_atomic(
  p_triggered_by TEXT,
  p_total_channels INT
) RETURNS UUID
  LANGUAGE plpgsql
  SECURITY INVOKER
AS $$
DECLARE
  v_run_id UUID;
  v_stale_threshold TIMESTAMPTZ := now() - interval '15 minutes';
BEGIN
  -- Step 1: Atomically recover stale runs (same transaction)
  UPDATE slack_sync_runs
    SET status = 'failed',
        error = 'Stale run recovered — lease expired',
        completed_at = now()
  WHERE status IN ('pending', 'running')
    AND (
      (worker_lease_expires_at IS NOT NULL AND worker_lease_expires_at < v_stale_threshold)
      OR (worker_lease_expires_at IS NULL AND created_at < v_stale_threshold)
    );

  -- Step 2: Insert new run (unique index guards concurrency)
  INSERT INTO slack_sync_runs (status, triggered_by, total_channels)
  VALUES ('pending', p_triggered_by, p_total_channels)
  RETURNING id INTO v_run_id;

  RETURN v_run_id;
END;
$$;

-- Step 4: Lock down execution — service_role only
REVOKE ALL ON FUNCTION create_sync_run_atomic(TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_sync_run_atomic(TEXT, INT) TO service_role;

-- Comments
COMMENT ON INDEX idx_slack_sync_runs_one_active IS 'Ensures at most one pending/running sync run exists at any time';
COMMENT ON FUNCTION create_sync_run_atomic IS 'Atomically recovers stale runs and creates a new pending run. Returns new run UUID. Raises unique_violation (23505) if a genuinely active run exists.';
