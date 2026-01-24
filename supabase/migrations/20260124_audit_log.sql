-- Migration: Create mapping_audit_log table for data enrichment audit trail
-- Purpose: Track all changes made through the data enrichment system
-- Date: 2026-01-24

-- =============================================================================
-- Create audit log table
-- =============================================================================

CREATE TABLE IF NOT EXISTS mapping_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who
  user_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  user_email TEXT,  -- Denormalized for quick lookup even if user deleted

  -- What action
  action TEXT NOT NULL CHECK (action IN (
    'create', 'update', 'delete',  -- CRUD operations
    'sync_start', 'sync_complete', 'sync_fail',  -- Sync lifecycle
    'mapping_save', 'mapping_publish',  -- Mapping workflow
    'import', 'export'  -- Data operations
  )),

  -- What resource
  resource_type TEXT NOT NULL CHECK (resource_type IN (
    'data_source', 'tab_mapping', 'column_mapping', 'column_pattern',
    'computed_field', 'sync_run', 'field_lineage'
  )),
  resource_id UUID,
  resource_name TEXT,  -- Human-readable identifier (e.g., "Master Client Dashboard")

  -- Change details
  changes JSONB,  -- { field: { old: value, new: value } }
  metadata JSONB,  -- Additional context (e.g., { rows_affected: 150, dry_run: false })

  -- Security context
  ip_address INET,
  user_agent TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- Indexes for common queries
-- =============================================================================

-- Find all actions by a user
CREATE INDEX IF NOT EXISTS idx_audit_user
ON mapping_audit_log(user_id);

-- Find all actions on a resource
CREATE INDEX IF NOT EXISTS idx_audit_resource
ON mapping_audit_log(resource_type, resource_id);

-- Find actions by type
CREATE INDEX IF NOT EXISTS idx_audit_action
ON mapping_audit_log(action);

-- Time-based queries (most common - recent activity)
CREATE INDEX IF NOT EXISTS idx_audit_created
ON mapping_audit_log(created_at DESC);

-- Composite index for dashboard queries
CREATE INDEX IF NOT EXISTS idx_audit_dashboard
ON mapping_audit_log(created_at DESC, action, resource_type);

-- =============================================================================
-- Helper function for logging
-- =============================================================================

CREATE OR REPLACE FUNCTION log_mapping_audit(
  p_user_id UUID,
  p_user_email TEXT,
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id UUID,
  p_resource_name TEXT DEFAULT NULL,
  p_changes JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO mapping_audit_log (
    user_id, user_email, action, resource_type,
    resource_id, resource_name, changes, metadata,
    ip_address, user_agent
  ) VALUES (
    p_user_id, p_user_email, p_action, p_resource_type,
    p_resource_id, p_resource_name, p_changes, p_metadata,
    p_ip_address, p_user_agent
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================

-- Enable RLS
ALTER TABLE mapping_audit_log ENABLE ROW LEVEL SECURITY;

-- Admins can view all audit logs
CREATE POLICY audit_admin_read ON mapping_audit_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = auth.uid()
      AND staff.role IN ('admin', 'operations_admin')
    )
  );

-- Only the system (service role) can insert audit logs
CREATE POLICY audit_system_insert ON mapping_audit_log
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- No one can update or delete audit logs (immutable)
-- (No UPDATE or DELETE policies = denied by default)
