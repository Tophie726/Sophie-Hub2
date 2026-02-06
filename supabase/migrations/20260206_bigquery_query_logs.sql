-- BigQuery Query Logs
-- Tracks per-query usage for cost attribution and usage dashboards.
-- Run this migration in Supabase SQL Editor.

CREATE TABLE bigquery_query_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  partner_id UUID,
  partner_name TEXT,
  view_alias TEXT NOT NULL,
  view_name TEXT NOT NULL,
  bytes_processed BIGINT NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(10,6) NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  query_mode TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bq_logs_created ON bigquery_query_logs(created_at DESC);
CREATE INDEX idx_bq_logs_partner ON bigquery_query_logs(partner_id, created_at DESC);

ALTER TABLE bigquery_query_logs ENABLE ROW LEVEL SECURITY;

-- Only service_role can read/write (server-side API routes)
CREATE POLICY bq_logs_service ON bigquery_query_logs
  FOR ALL USING (auth.role() = 'service_role');
