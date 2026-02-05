# PostHog Integration Guide

Sophie Hub uses PostHog for analytics, error tracking, feature flags, session replay, and user identification.

## Quick Start

```typescript
// Track an event
import { analytics } from '@/lib/posthog'
analytics.feedbackSubmitted('bug', true)

// Check a feature flag
import { useFeatureFlagEnabled, FEATURE_FLAGS } from '@/lib/posthog'
const enabled = useFeatureFlagEnabled(FEATURE_FLAGS.DARK_MODE)

// Capture an error
import { captureError } from '@/lib/posthog'
captureError(error, { extra: { context: 'sync' } })
```

---

## Module Structure

```
src/lib/posthog/
├── index.ts              # Re-exports all utilities
├── capture-error.ts      # Error capture for boundaries
├── events.ts             # Typed analytics events
├── flags.ts              # Feature flag constants
├── server.ts             # Server-side utilities
├── use-feature-flag.ts   # Client hooks for flags
└── use-identify.ts       # User identification hook
```

---

## Analytics Events

All events are typed in `src/lib/posthog/events.ts`. Use the `analytics` object instead of raw `posthog.capture()`.

### Available Events

```typescript
import { analytics } from '@/lib/posthog'

// Sync events
analytics.syncStarted(tabMappingId, entityType)
analytics.syncCompleted(tabMappingId, rowsSynced, durationMs)
analytics.syncFailed(tabMappingId, errorMessage)

// Mapping events
analytics.mappingSaved(tabMappingId, columnsMapped)
analytics.mappingDeleted(tabMappingId)

// Change approval events
analytics.changeApproved(changeId, entityType)
analytics.changeRejected(changeId, entityType)
analytics.changeBulkApproved(count)

// Feedback events
analytics.feedbackSubmitted(type, hasScreenshot)
analytics.feedbackModalOpened()

// Feature usage
analytics.featureUsed(feature, { metadata })

// Search events
analytics.searchPerformed(query, resultCount, context)

// Auth events
analytics.loginAttempted(method)
analytics.loginSucceeded(method)
analytics.loginFailed(method, reason)
analytics.logoutClicked()
```

### Adding New Events

1. Add the event to `src/lib/posthog/events.ts`:

```typescript
export const analytics = {
  // ... existing events

  myNewEvent: (param1: string, param2: number) =>
    posthog.capture('my_new_event', {
      param_1: param1,
      param_2: param2,
    }),
}
```

2. Use it in your component:

```typescript
import { analytics } from '@/lib/posthog'
analytics.myNewEvent('value', 42)
```

### Event Naming Conventions

- Use `snake_case` for event names
- Use descriptive names: `sync_started` not `start`
- Include relevant context in properties
- Keep property names consistent across events

---

## Feature Flags

### Available Flags

Defined in `src/lib/posthog/flags.ts`:

```typescript
export const FEATURE_FLAGS = {
  CHANGE_APPROVAL_V2: 'change-approval-v2',
  AI_SUGGESTIONS_ENHANCED: 'ai-suggestions-enhanced',
  WEEKLY_HEATMAP_V2: 'weekly-heatmap-v2',
  REALTIME_SYNC_STATUS: 'realtime-sync-status',
  DARK_MODE: 'dark-mode',
  ADVANCED_FILTERS: 'advanced-filters',
}
```

### Client-Side Usage

```typescript
import { useFeatureFlagEnabled, FEATURE_FLAGS } from '@/lib/posthog'

function MyComponent() {
  const showNewFeature = useFeatureFlagEnabled(FEATURE_FLAGS.DARK_MODE)

  if (!showNewFeature) {
    return <OldComponent />
  }

  return <NewComponent />
}
```

For multivariate flags:

```typescript
import { useFeatureFlag, useFeatureFlagPayload } from '@/lib/posthog'

function MyComponent() {
  // Get flag value (boolean or string variant)
  const variant = useFeatureFlag('experiment-variant')

  // Get flag payload (custom JSON data)
  const config = useFeatureFlagPayload<{ color: string }>('ui-config')
}
```

### Server-Side Usage

```typescript
import { isFeatureFlagEnabled, getFeatureFlagValue } from '@/lib/posthog'

// In API route or server component
export async function GET(request: Request) {
  const userId = getCurrentUserId()

  const enabled = await isFeatureFlagEnabled('dark-mode', userId)
  const variant = await getFeatureFlagValue('experiment', userId)

  // ...
}
```

### Creating New Flags

1. Create the flag in PostHog dashboard (Feature Flags → New)
2. Add the key to `src/lib/posthog/flags.ts`:

```typescript
export const FEATURE_FLAGS = {
  // ... existing flags
  MY_NEW_FLAG: 'my-new-flag',
}
```

3. Use it in your code with the constant

---

## Error Tracking

### Automatic Capture

The following are automatically captured:
- Unhandled JavaScript errors (`window.onerror`)
- Unhandled promise rejections
- React error boundary errors

### Manual Capture

Use `captureError` for caught errors you want to track:

```typescript
import { captureError } from '@/lib/posthog'

try {
  await riskyOperation()
} catch (error) {
  captureError(error as Error, {
    extra: {
      operation: 'riskyOperation',
      userId: user.id,
    }
  })
  // Handle error gracefully
}
```

### In Error Boundaries

```typescript
import { captureError } from '@/lib/posthog'

<ErrorBoundary
  onError={(error, errorInfo) => {
    captureError(error, {
      componentStack: errorInfo.componentStack
    })
  }}
>
  <MyComponent />
</ErrorBoundary>
```

### Viewing Errors

PostHog Error Tracking dashboard: https://us.posthog.com/project/306226/error_tracking

---

## User Identification

### Automatic Identification

Users are automatically identified when they log in. The `PostHogUserIdentifier` component in `posthog-provider.tsx` handles this.

Identified properties:
- `email`
- `name`
- `role`
- `is_admin`

### Manual Identification

If you need to identify users in a specific context:

```typescript
import posthog from 'posthog-js'

posthog.identify(userId, {
  email: user.email,
  name: user.name,
  custom_property: 'value',
})
```

### Reset on Logout

Identity is automatically reset when users log out (in `sidebar.tsx`).

---

## Server-Side Event Capture

For tracking events from API routes:

```typescript
import { captureServerEvent } from '@/lib/posthog'

export async function POST(request: Request) {
  const userId = getCurrentUserId()

  // ... process request

  await captureServerEvent(userId, 'api_endpoint_called', {
    endpoint: '/api/sync',
    duration_ms: endTime - startTime,
  })
}
```

---

## Session Replay

Session replay is enabled by default. To link feedback to session replays:

```typescript
import { getPostHogSessionId } from '@/components/providers/posthog-provider'

const sessionId = getPostHogSessionId()
// Include sessionId in feedback submission
```

View replays at: https://us.posthog.com/project/306226/replay

---

## Testing Feature Flags Locally

1. **Override in PostHog dashboard**: Feature Flags → Your Flag → Edit → Add override for your email

2. **Override in browser console**:
```javascript
posthog.featureFlags.override({ 'my-flag': true })
```

3. **Reset overrides**:
```javascript
posthog.featureFlags.override(false)
```

---

## Environment Variables

```bash
# Required
NEXT_PUBLIC_POSTHOG_KEY=phc_xxx
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

---

## PostHog Dashboard Setup

### Enable Exception Autocapture

1. Go to Project Settings
2. Navigate to Error Tracking
3. Click "Enable exception autocapture"

### Create Feature Flags

1. Go to Feature Flags
2. Click "New feature flag"
3. Add the key (e.g., `dark-mode`)
4. Set rollout percentage or targeting rules
5. Save

### Create Analytics Dashboard

Recommended insights:
- Sync success rate over time
- Error count by type
- Feature usage by user role
- Feedback submission trends

---

## MCP Integration

Add PostHog MCP to Claude Code for debugging:

```bash
npx @anthropic-ai/claude-code mcp add posthog
```

This allows Claude Code to query PostHog data directly when debugging issues.
