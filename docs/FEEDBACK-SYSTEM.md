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
# .env.local (ALREADY CONFIGURED)
NEXT_PUBLIC_POSTHOG_KEY=phc_yg2P72DWBUYePWThsKDS6e8DuYgP4zozWo8TWelHA4M
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com

# For MCP integration (in Claude Code config)
POSTHOG_API_KEY=phx_xxx  # Personal API key from PostHog
POSTHOG_PROJECT_ID=306226  # Sophie Hub project ID
```

**Note:** Enable Session Replay in PostHog Project Settings → Session Replay for replay links to work.

### Current Status

- [x] PostHog package installed (`posthog-js`)
- [x] PostHog provider created (`src/components/providers/posthog-provider.tsx`)
- [x] Provider added to root layout
- [x] Environment variables configured
- [x] Feedback button component (`src/components/feedback/feedback-button.tsx`)
- [x] Feedback modal (`src/components/feedback/feedback-modal.tsx`)
- [x] Feedback API (`src/app/api/feedback/route.ts`)
- [x] Admin dashboard (`src/app/(dashboard)/admin/feedback/page.tsx`)
- [x] Status update API (`src/app/api/feedback/[id]/status/route.ts`)
- [x] Feedback button in sidebar
- [x] Database migration (`supabase/migrations/20260205_feedback_table.sql`)
- [x] **Frill-style Feedback Center** (`/feedback`) - Ideas + Roadmap
- [x] **Voting system** - Upvote features, sort by votes
- [x] **Custom 404 page** with bug report option
- [x] **Navigation updated** - Feedback in Core section for all staff
- [x] **Screenshot capture** - "Snapshot Page" button + manual upload in feedback modal
- [x] **AI-assisted bug fix suggestions** - Two-tier approach (Haiku summaries, Sonnet analysis)
- [x] **AI-assisted feature implementation suggestions** - Implementation plans with file lists
- [x] **Comments on feedback** - User comments API for adding context
- [x] **AI result caching** - Results cached to database with "outdated" detection
- [ ] MCP integration for Claude Code (PostHog MCP available)
- [ ] Screenshot display in AI analysis (multimodal)
- [ ] Comments UI in feedback modal/detail dialog

### Setup Required

Before voting works, run the voting migration in Supabase:

```bash
# File: supabase/migrations/20260205_feedback_voting.sql
# Run this SQL in Supabase SQL Editor
```

Also enable **Session Replay** in PostHog Project Settings → Session Replay for replay links to work in feedback triage.

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

### Phase 1: Foundation ✅ COMPLETE

**Goal:** Basic feedback collection and admin view

1. **PostHog Setup** ✅
   - PostHog provider in root layout
   - Session replay and error tracking enabled
   - Page view tracking on route changes
   - `getPostHogSessionId()` for linking feedback to sessions

2. **Feedback Button Component** ✅
   - Button in sidebar footer (compact mode with tooltip)
   - Modal with type selection (bug/feature/question)
   - Auto-capture: URL, browser info, PostHog session ID

3. **Database Tables** ✅
   - `feedback` table with RLS policies
   - `feature_votes` table for roadmap upvoting
   - Migration: `supabase/migrations/20260205_feedback_table.sql`

4. **Admin Dashboard** (`/admin/feedback`) ✅
   - List view with type/status filters
   - Stats cards (New, Bugs, Features, Total)
   - Detail dialog with PostHog session replay link
   - Status updates (new → reviewed → in_progress → resolved)

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

## File Structure (Implemented)

```
src/
├── app/
│   ├── (dashboard)/
│   │   ├── admin/
│   │   │   └── feedback/
│   │   │       └── page.tsx              # Admin feedback triage ✅
│   │   └── feedback/
│   │       └── page.tsx                  # Frill-style feedback center ✅
│   └── api/
│       ├── feedback/
│       │   ├── route.ts                  # POST create, GET list ✅
│       │   ├── roadmap/
│       │   │   └── route.ts              # GET roadmap items ✅
│       │   └── [id]/
│       │       ├── route.ts              # GET single feedback ✅
│       │       ├── status/
│       │       │   └── route.ts          # PATCH status update ✅
│       │       ├── vote/
│       │       │   └── route.ts          # POST/DELETE vote ✅
│       │       └── comments/
│       │           └── route.ts          # GET/POST comments ✅
│       └── ai/
│           ├── summarize-feedback/
│           │   └── route.ts              # Quick summary (Haiku) ✅
│           ├── analyze-bug/
│           │   └── route.ts              # Bug analysis (Sonnet) ✅
│           └── suggest-implementation/
│               └── route.ts              # Feature plan (Sonnet) ✅
├── components/
│   ├── feedback/
│   │   ├── index.ts                      # Exports ✅
│   │   ├── feedback-button.tsx           # Sidebar trigger button ✅
│   │   ├── feedback-modal.tsx            # Report modal + screenshot ✅
│   │   ├── feedback-center.tsx           # Tabbed container ✅
│   │   ├── ideas-list.tsx                # Filterable ideas ✅
│   │   ├── idea-card.tsx                 # Single idea card ✅
│   │   ├── vote-button.tsx               # Upvote toggle ✅
│   │   ├── roadmap-board.tsx             # Kanban columns ✅
│   │   ├── roadmap-card.tsx              # Roadmap item ✅
│   │   └── submit-idea-modal.tsx         # Idea submission ✅
│   └── providers/
│       └── posthog-provider.tsx          # PostHog client setup ✅
├── not-found.tsx                         # Custom 404 with bug report ✅
└── supabase/
    └── migrations/
        ├── 20260205_feedback_table.sql       # Base schema ✅
        ├── 20260205_feedback_voting.sql      # Voting system ✅
        └── 20260205_feedback_ai_comments.sql # AI + comments ✅
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

## AI-Assisted Bug Fixing & Feature Suggestions (IMPLEMENTED)

### Overview

Sophie Hub integrates Claude AI for analyzing bugs and suggesting feature implementations. Uses a **two-tier approach** to minimize token costs:

1. **Quick Summary** (Haiku - cheap/fast) - One-line summary of the issue
2. **Full Analysis** (Sonnet - expensive/detailed) - Root cause analysis, suggested fixes, affected files

### Database Schema

```sql
-- AI caching columns on feedback table
ai_summary TEXT,           -- Quick summary from Haiku
ai_summary_at TIMESTAMPTZ, -- When summary was generated
ai_analysis JSONB,         -- Full analysis from Sonnet
ai_analysis_at TIMESTAMPTZ,-- When analysis was generated
content_updated_at TIMESTAMPTZ -- Trigger-updated when content/comments change

-- Comments table for adding context
feedback_comments (
  id UUID PRIMARY KEY,
  feedback_id UUID REFERENCES feedback(id),
  user_email TEXT,
  content TEXT,
  is_from_submitter BOOLEAN,
  created_at TIMESTAMPTZ
)
```

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/ai/summarize-feedback` | POST | Quick summary using Haiku (cached) |
| `/api/ai/analyze-bug` | POST | Full bug analysis using Sonnet (cached) |
| `/api/ai/suggest-implementation` | POST | Feature implementation plan using Sonnet |
| `/api/feedback/[id]/comments` | GET/POST | Comments for adding context |

### Bug Analysis Flow

```
1. Bug report submitted with PostHog session ID + optional screenshot
   ↓
2. Admin enables AI toggle on triage page
   ↓
3. Click "Summarize" → Haiku generates one-line summary (cached)
   ↓
4. Click "Find Solution" → Sonnet analyzes:
   - Bug description and context
   - PostHog session events (if API key configured)
   - Error logs and stack traces from session
   - Screenshot (if attached - TODO: multimodal)
   ↓
5. AI returns:
   - Summary, likely cause, suggested fix
   - Affected files list
   - Confidence level (low/medium/high)
   ↓
6. Results cached to database - "outdated" badge shown if content updated
```

### Feature Implementation Flow

```
1. Feature request submitted
   ↓
2. Click "Suggest Implementation" → Sonnet analyzes:
   - Feature description
   - Existing codebase patterns
   ↓
3. AI returns:
   - Summary and approach
   - Implementation steps with file lists
   - Files to create vs modify
   - Database changes needed
   - Complexity and scope estimate
   - Risks and alternatives
```

### UI Implementation

**Triage Page (`/admin/feedback`):**
- AI toggle in page header (purple, with Sparkles icon)
- Per-item "Summarize" and "Find Solution" / "Suggest Implementation" buttons
- Inline summary display with outdated indicator
- Collapsible analysis panel with confidence badge
- "Re-summarize" / "Re-analyze" when content is outdated

**Outdated Detection:**
- `content_updated_at` column updated via trigger when:
  - Description is modified
  - Comments are added
- UI shows "outdated" badge when `content_updated_at > ai_*_at`
- Buttons change to "Re-summarize" / "Re-analyze" when outdated

### PostHog Integration

When PostHog Personal API Key is configured in Settings:
- AI fetches session events for the bug's session ID
- Extracts errors, exceptions, and stack traces from events
- Includes console errors and navigation context
- Provides richer context for bug analysis

**Setup:**
1. Go to PostHog → Settings → Personal API Keys
2. Create key with: Query (read), Session recording (read), Error tracking (read)
3. Add to Sophie Hub Settings → PostHog (Personal API Key)

### Cost Optimization

| Operation | Model | Approx Cost |
|-----------|-------|-------------|
| Quick Summary | Haiku | ~$0.001 |
| Bug Analysis | Sonnet | ~$0.05 |
| Implementation Plan | Sonnet | ~$0.05 |

- Results cached to database - no re-running on page refresh
- Manual triggers only - no automatic AI usage
- Toggle to disable AI completely
- Outdated detection prevents unnecessary re-runs

---

## Screenshot Capture (IMPLEMENTED)

### How It Works

Users can attach screenshots to bug reports via two methods:

1. **"Snapshot Page" button** - Uses html2canvas to capture the current page
   - Modal temporarily hides during capture
   - Image captured at 50% scale, JPEG quality 0.7 (optimized for storage)
   - Shows preview with remove button

2. **"Upload Image" button** - Manual file upload
   - Accepts image/* files
   - 5MB size limit
   - Converts to base64 for storage

### Storage

Screenshots are stored as base64 in `feedback.screenshot_url` column. This is a temporary solution - future enhancement could use Supabase Storage for larger files.

### Components

- `FeedbackModal` (`src/components/feedback/feedback-modal.tsx`)
  - `captureScreenshot()` - Uses html2canvas to capture page
  - `handleFileUpload()` - Handles manual uploads
  - Preview display with remove button

### Display

Screenshots are shown in:
- Feedback detail dialog (admin view)
- Future: AI analysis context (multimodal)

---

## Pending Features

### Comments UI
- Backend API complete (`/api/feedback/[id]/comments`)
- Need to add UI in feedback detail dialog
- Show comment thread with submitter highlight
- Input for adding new comments

### Screenshot in AI Analysis
- Include screenshot in Claude API call (multimodal)
- Let AI see visual context for bugs
- Requires updating analyze-bug route to send image

### Test Fix on Dev Branch (Nice to Have)
- Button to apply suggested fix on a new branch
- Requires Git integration
- Run tests automatically

---

## Future Enhancements

- [ ] Public changelog page
- [ ] Slack notifications for new bugs
- [ ] AI-suggested duplicate detection
- [ ] Automatic severity classification
- [ ] Integration with GitHub Issues
- [ ] SLA tracking for response times
- [ ] Supabase Storage for screenshots (instead of base64)
- [ ] Multimodal AI analysis with screenshots

---

## Related Documentation

- [PostHog MCP Server](https://github.com/PostHog/mcp)
- [PostHog Session Replay](https://posthog.com/docs/session-replay)
- [PostHog Error Tracking](https://posthog.com/docs/error-tracking)
- [Sophie Hub CLAUDE.md](../CLAUDE.md) - Main project context
