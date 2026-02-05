# Sophie Hub Feedback & Error Tracking System

## Overview

Sophie Hub has an integrated feedback system for bug reports, feature requests, and error tracking. This keeps everything in-app rather than requiring external tools like ClickUp for user-facing feedback.

**Philosophy:**
- **ClickUp** = Team project management, sprint planning, developer tasks
- **Sophie Hub Feedback** = User-reported bugs, feature requests, error logs, roadmap visibility

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER EXPERIENCE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Feedback Button] → Modal with:                                │
│    • Type: Bug / Feature / Question                             │
│    • Description + optional screenshot                          │
│    • Auto-attached: URL, user, timestamp, session ID            │
│                                                                 │
│  [View My Reports] → Track status of submitted feedback         │
│  [Roadmap] → See planned features, upvote                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         POSTHOG                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  • Session Replay - See exactly what user did before bug        │
│  • Error Tracking - Auto-capture JS errors with context         │
│  • Analytics - Usage patterns, feature adoption                 │
│  • MCP Integration - Debug errors directly in Claude Code       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ADMIN DASHBOARD                              │
│                  /admin/feedback                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Tabs: [All] [Bugs] [Features] [Questions] [Errors]             │
│                                                                 │
│  • View all feedback with filters                               │
│  • See PostHog session replay link                              │
│  • Update status: new → reviewed → in-progress → resolved       │
│  • Add internal notes                                           │
│  • Convert to ClickUp task (optional)                           │
│  • Error log from PostHog integration                           │
│                                                                 │
│  Roles with access: admin, developer                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## PostHog Integration

### Why PostHog?

| Feature | Benefit |
|---------|---------|
| Session Replay | See exactly what user did before reporting bug |
| Error Tracking | Auto-capture JS errors with stack traces |
| MCP Server | Debug errors directly in Claude Code |
| Analytics | Understand usage patterns |
| Feature Flags | Roll out features gradually |
| Free Tier | 1M events/month, generous for our size |

### MCP Integration with Claude Code

PostHog has an [official MCP server](https://github.com/PostHog/mcp) that integrates directly with Claude Code.

**Setup:**
```bash
# Run this in your terminal to add PostHog MCP to Claude Code
npx @anthropic-ai/claude-code mcp add posthog
```

**What you can do with PostHog MCP:**
- Query errors and exceptions
- View session replays
- Analyze feature flag usage
- Debug issues without leaving Claude Code

**Documentation:**
- [PostHog MCP Docs](https://posthog.com/docs/model-context-protocol)
- [Debugging with MCP](https://posthog.com/docs/error-tracking/debugging-with-mcp)

### Environment Variables

```bash
# .env.local
NEXT_PUBLIC_POSTHOG_KEY=phc_xxx
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com

# For MCP integration (in Claude Code config)
POSTHOG_API_KEY=phx_xxx
POSTHOG_PROJECT_ID=12345
```

---

## Database Schema

### feedback table

```sql
create table feedback (
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
  posthog_session_id text,  -- Links to session replay

  -- User info
  submitted_by uuid references staff(id),
  submitted_by_email text,

  -- Admin fields
  assigned_to uuid references staff(id),
  internal_notes text,
  resolution_notes text,
  clickup_task_id text,  -- Optional link to ClickUp

  -- Timestamps
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  resolved_at timestamptz
);

-- Indexes
create index feedback_type_idx on feedback(type);
create index feedback_status_idx on feedback(status);
create index feedback_submitted_by_idx on feedback(submitted_by);

-- RLS
alter table feedback enable row level security;

-- Staff can view their own feedback
create policy "Staff view own feedback" on feedback
  for select using (submitted_by = auth.uid());

-- Staff can insert feedback
create policy "Staff insert feedback" on feedback
  for insert with check (true);

-- Admins can do everything
create policy "Admins full access" on feedback
  for all using (
    exists (
      select 1 from staff
      where staff.id = auth.uid()
      and staff.role in ('admin', 'operations_admin', 'developer')
    )
  );
```

### feature_votes table (for roadmap upvoting)

```sql
create table feature_votes (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid references feedback(id) on delete cascade,
  user_id uuid references staff(id),
  created_at timestamptz default now(),
  unique(feedback_id, user_id)
);
```

### error_logs table (populated by PostHog webhook or API)

```sql
create table error_logs (
  id uuid primary key default gen_random_uuid(),

  -- Error details
  error_type text not null,
  message text not null,
  stack_trace text,

  -- Context
  page_url text,
  user_id uuid references staff(id),
  posthog_session_id text,
  posthog_event_id text,

  -- Metadata
  browser text,
  os text,
  device text,

  -- Status
  status text default 'new' check (status in ('new', 'investigating', 'fixed', 'ignored')),
  linked_feedback_id uuid references feedback(id),

  -- Timestamps
  occurred_at timestamptz not null,
  created_at timestamptz default now()
);

create index error_logs_status_idx on error_logs(status);
create index error_logs_occurred_at_idx on error_logs(occurred_at desc);
```

---

## Implementation Phases

### Phase 1: Foundation (Current Priority)

**Goal:** Basic feedback collection and admin view

1. **PostHog Setup**
   - Add PostHog script to `_app.tsx` or root layout
   - Enable session replay and error tracking
   - Set up MCP for Claude Code

2. **Feedback Button Component**
   - Floating button in sidebar or corner
   - Modal with type selection, description, screenshot
   - Auto-capture context (URL, user, session ID)

3. **Database Tables**
   - Create `feedback` table
   - Basic RLS policies

4. **Admin Dashboard** (`/admin/feedback`)
   - List view with filters (type, status)
   - Detail view with session replay link
   - Status updates

### Phase 2: Enhanced Admin

**Goal:** Better triage and error visibility

1. **Error Log Tab**
   - Display errors from PostHog
   - Link errors to feedback reports
   - One-click "investigate in Claude Code" via MCP

2. **Internal Notes**
   - Add notes to feedback items
   - Assign to team members

3. **ClickUp Integration** (optional)
   - Button to create ClickUp task from feedback
   - Sync status back to Sophie Hub

### Phase 3: Staff Experience

**Goal:** Staff can track their reports and influence roadmap

1. **My Feedback Page** (`/feedback/mine`)
   - View submitted feedback
   - Track status changes

2. **Roadmap Page** (`/roadmap`)
   - View planned features (status = 'in_progress' or tagged as roadmap)
   - Upvote features
   - See vote counts

3. **Notifications**
   - Email when feedback status changes
   - In-app notification bell

---

## File Structure

```
src/
├── app/
│   ├── (dashboard)/
│   │   ├── admin/
│   │   │   └── feedback/
│   │   │       ├── page.tsx          # Admin feedback dashboard
│   │   │       └── [id]/
│   │   │           └── page.tsx      # Feedback detail view
│   │   └── feedback/
│   │       └── mine/
│   │           └── page.tsx          # Staff's own feedback
│   └── api/
│       └── feedback/
│           ├── route.ts              # POST create, GET list
│           ├── [id]/
│           │   └── route.ts          # GET, PATCH, DELETE
│           └── vote/
│               └── route.ts          # POST vote
├── components/
│   └── feedback/
│       ├── feedback-button.tsx       # Floating trigger button
│       ├── feedback-modal.tsx        # Report modal
│       ├── feedback-list.tsx         # Admin list view
│       └── feedback-detail.tsx       # Detail with session link
└── lib/
    └── posthog/
        ├── client.ts                 # PostHog client setup
        └── hooks.ts                  # usePostHog, useSessionId
```

---

## Component Specs

### FeedbackButton

Appears in sidebar footer or as floating button.

```tsx
<FeedbackButton />
// Opens FeedbackModal on click
// Shows subtle pulse animation if user hasn't submitted feedback before
```

### FeedbackModal

```tsx
<FeedbackModal
  open={isOpen}
  onClose={() => setIsOpen(false)}
/>

// Fields:
// - Type: Bug | Feature Request | Question (radio/segmented)
// - Title: optional text input
// - Description: required textarea
// - Screenshot: optional file upload or browser capture
// - Auto-attached: current URL, user email, PostHog session ID
```

### Admin Feedback Dashboard

```
/admin/feedback

┌─────────────────────────────────────────────────────────────┐
│ Feedback                                        [+ Refresh] │
├─────────────────────────────────────────────────────────────┤
│ [All] [Bugs: 3] [Features: 12] [Questions: 2] [Errors: 5]   │
├─────────────────────────────────────────────────────────────┤
│ Status: [All ▼]  Priority: [All ▼]  Search: [________]      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🐛 Can't save column mappings                           │ │
│ │ Bug • Critical • New • 2 hours ago                      │ │
│ │ Submitted by: jane@sophiesociety.com                    │ │
│ │ [View Session] [Mark Reviewed]                          │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 💡 Add bulk partner status update                       │ │
│ │ Feature • Medium • Reviewed • 1 day ago                 │ │
│ │ Submitted by: john@sophiesociety.com  • 5 votes         │ │
│ │ [View Details]                                          │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## PostHog Session Replay Link

When viewing a feedback item, the admin can click to view the exact session:

```typescript
// The PostHog session URL format
const sessionReplayUrl = `https://app.posthog.com/replay/${posthogSessionId}`

// In the feedback detail view
<a href={sessionReplayUrl} target="_blank">
  View Session Replay →
</a>
```

---

## Error Tracking Flow

```
1. Error occurs in browser
   ↓
2. PostHog auto-captures with:
   - Stack trace
   - Session ID
   - User context
   - Page URL
   ↓
3. Webhook/API syncs to error_logs table (optional)
   ↓
4. Admin sees in Errors tab
   ↓
5. Click "Debug in Claude Code" → Opens MCP with error context
   ↓
6. Fix deployed → Mark error as fixed
```

---

## Access Control

| Role | Can Submit | View Own | Admin View | Manage |
|------|-----------|----------|------------|--------|
| Staff | ✅ | ✅ | ❌ | ❌ |
| Pod Leader | ✅ | ✅ | ❌ | ❌ |
| Admin | ✅ | ✅ | ✅ | ✅ |
| Developer | ✅ | ✅ | ✅ | ✅ |

---

## Future Enhancements

- [ ] Public changelog page
- [ ] Slack notifications for new bugs
- [ ] AI-suggested duplicate detection
- [ ] Automatic severity classification
- [ ] Integration with GitHub Issues
- [ ] SLA tracking for response times

---

## Related Documentation

- [PostHog MCP Server](https://github.com/PostHog/mcp)
- [PostHog Session Replay](https://posthog.com/docs/session-replay)
- [PostHog Error Tracking](https://posthog.com/docs/error-tracking)
- [Sophie Hub CLAUDE.md](../CLAUDE.md) - Main project context
