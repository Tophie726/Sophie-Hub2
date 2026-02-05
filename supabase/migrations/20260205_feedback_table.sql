-- Feedback & Bug Reporting System
-- Run this in Supabase SQL Editor

-- Main feedback table
create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),

  -- Core fields
  type text not null check (type in ('bug', 'feature', 'question')),
  status text not null default 'new' check (status in ('new', 'reviewed', 'in_progress', 'resolved', 'wont_fix')),
  priority text check (priority in ('low', 'medium', 'high', 'critical')),

  -- Content
  title text,
  description text not null,
  screenshot_url text,

  -- Context (auto-captured)
  page_url text,
  browser_info jsonb,
  posthog_session_id text,

  -- User info
  submitted_by uuid references staff(id),
  submitted_by_email text,

  -- Admin fields
  assigned_to uuid references staff(id),
  internal_notes text,
  resolution_notes text,

  -- Timestamps
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  resolved_at timestamptz
);

-- Indexes
create index if not exists feedback_type_idx on feedback(type);
create index if not exists feedback_status_idx on feedback(status);
create index if not exists feedback_submitted_by_idx on feedback(submitted_by);
create index if not exists feedback_created_at_idx on feedback(created_at desc);

-- RLS
alter table feedback enable row level security;

-- Staff can view their own feedback
create policy "Staff view own feedback" on feedback
  for select using (
    submitted_by_email = (select email from staff where id = auth.uid())
    or submitted_by = auth.uid()
  );

-- Anyone authenticated can insert feedback
create policy "Authenticated users insert feedback" on feedback
  for insert with check (true);

-- Admins can do everything
create policy "Admins full access" on feedback
  for all using (
    exists (
      select 1 from staff
      where staff.email = auth.jwt()->>'email'
      and staff.role in ('admin', 'operations_admin')
    )
  );

-- Feature votes table (for roadmap upvoting)
create table if not exists feature_votes (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid references feedback(id) on delete cascade,
  user_email text not null,
  created_at timestamptz default now(),
  unique(feedback_id, user_email)
);

-- RLS for votes
alter table feature_votes enable row level security;

create policy "Anyone can view votes" on feature_votes
  for select using (true);

create policy "Authenticated users can vote" on feature_votes
  for insert with check (true);

create policy "Users can remove own votes" on feature_votes
  for delete using (user_email = auth.jwt()->>'email');
