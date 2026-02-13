-- SupTask Connector: Ticket snapshot table + sync state
-- Phase 2 of the Suptask connector rollout.
-- Stores ingested ticket data with staff resolution metadata.

-- ============================================================================
-- UP
-- ============================================================================

-- Ticket snapshot table
CREATE TABLE IF NOT EXISTS suptask_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Natural key (upsert target)
  team_id TEXT NOT NULL,
  ticket_number INTEGER NOT NULL,

  -- Normalized fields for queries and analytics
  status TEXT NOT NULL DEFAULT 'unknown',
  archived BOOLEAN NOT NULL DEFAULT false,
  requester_id TEXT,          -- Slack member ID from SupTask payload
  assignee TEXT,              -- Slack member ID from SupTask payload
  form_id TEXT,
  queue_id TEXT,
  subject TEXT,

  -- Staff resolution (Phase 3 will populate these)
  resolved_requester_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  resolved_assignee_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,

  -- Raw payload for zero-data-loss
  raw_payload JSONB NOT NULL DEFAULT '{}',

  -- Sync metadata
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ticket_created_at TIMESTAMPTZ,
  ticket_updated_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_suptask_ticket UNIQUE (team_id, ticket_number)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_suptask_tickets_status ON suptask_tickets(status);
CREATE INDEX IF NOT EXISTS idx_suptask_tickets_requester ON suptask_tickets(requester_id);
CREATE INDEX IF NOT EXISTS idx_suptask_tickets_assignee ON suptask_tickets(assignee);
CREATE INDEX IF NOT EXISTS idx_suptask_tickets_synced ON suptask_tickets(last_synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_suptask_tickets_team ON suptask_tickets(team_id);

-- Sync run log table
CREATE TABLE IF NOT EXISTS suptask_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',   -- running, completed, failed
  ticket_range_start INTEGER,
  ticket_range_end INTEGER,
  tickets_fetched INTEGER DEFAULT 0,
  tickets_upserted INTEGER DEFAULT 0,
  tickets_failed INTEGER DEFAULT 0,
  error_summary JSONB DEFAULT '[]',         -- Array of { ticketNumber, error }
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suptask_sync_runs_status ON suptask_sync_runs(status);
CREATE INDEX IF NOT EXISTS idx_suptask_sync_runs_started ON suptask_sync_runs(started_at DESC);

-- RLS: only admins can read/write
ALTER TABLE suptask_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE suptask_sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY suptask_tickets_admin_read ON suptask_tickets
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = auth.uid()
      AND staff.role IN ('admin', 'operations_admin')
    )
  );

CREATE POLICY suptask_tickets_service_write ON suptask_tickets
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY suptask_sync_runs_admin_read ON suptask_sync_runs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = auth.uid()
      AND staff.role IN ('admin', 'operations_admin')
    )
  );

CREATE POLICY suptask_sync_runs_service_write ON suptask_sync_runs
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE suptask_tickets IS 'Snapshot of SupTask tickets ingested for workload and support analytics.';
COMMENT ON TABLE suptask_sync_runs IS 'Log of SupTask sync runs for status tracking and debugging.';
COMMENT ON COLUMN suptask_tickets.requester_id IS 'Slack member ID of the ticket requester. Resolved to staff.id in Phase 3.';
COMMENT ON COLUMN suptask_tickets.assignee IS 'Slack member ID of the ticket assignee. Resolved to staff.id in Phase 3.';
COMMENT ON COLUMN suptask_tickets.raw_payload IS 'Full raw API response for zero-data-loss. Never dropped on re-sync.';

-- ============================================================================
-- DOWN
-- ============================================================================
-- DROP TABLE IF EXISTS suptask_sync_runs;
-- DROP TABLE IF EXISTS suptask_tickets;
