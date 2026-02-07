-- Migration: slack_response_metrics
-- Phase 3: Pre-computed response time analytics per channel per day
-- Computed from slack_messages by the analytics engine

CREATE TABLE slack_response_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id TEXT NOT NULL,
  partner_id UUID NOT NULL REFERENCES partners(id),
  pod_leader_id UUID REFERENCES staff(id),     -- Snapshotted at compute time
  date DATE NOT NULL,

  -- Volume
  total_messages INT NOT NULL DEFAULT 0,
  staff_messages INT NOT NULL DEFAULT 0,
  partner_messages INT NOT NULL DEFAULT 0,

  -- Response times (minutes)
  avg_response_time_mins NUMERIC(10,2),
  median_response_time_mins NUMERIC(10,2),
  p95_response_time_mins NUMERIC(10,2),
  max_response_time_mins NUMERIC(10,2),
  min_response_time_mins NUMERIC(10,2),

  -- Buckets
  responses_under_30m INT NOT NULL DEFAULT 0,
  responses_30m_to_1h INT NOT NULL DEFAULT 0,
  responses_1h_to_4h INT NOT NULL DEFAULT 0,
  responses_4h_to_24h INT NOT NULL DEFAULT 0,
  responses_over_24h INT NOT NULL DEFAULT 0,
  unanswered_count INT NOT NULL DEFAULT 0,

  -- Metadata
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  algorithm_version INT NOT NULL DEFAULT 1,

  UNIQUE(channel_id, date)
);

-- Indexes for common query patterns
CREATE INDEX idx_response_metrics_partner ON slack_response_metrics(partner_id, date);
CREATE INDEX idx_response_metrics_pod ON slack_response_metrics(pod_leader_id, date);
CREATE INDEX idx_response_metrics_date ON slack_response_metrics(date);

-- RLS: admin/operations_admin + service_role only
ALTER TABLE slack_response_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY response_metrics_read ON slack_response_metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.email = current_setting('request.jwt.claims', true)::jsonb->>'email'
      AND s.role IN ('admin', 'operations_admin')
    )
    OR current_user = 'service_role'
  );

CREATE POLICY response_metrics_write ON slack_response_metrics
  FOR ALL USING (current_user = 'service_role')
  WITH CHECK (current_user = 'service_role');
