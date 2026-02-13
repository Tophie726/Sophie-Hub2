# View Builder (Inception Mode) — Claude Revision (Round 04)

Date: 2026-02-10
Round: 04 (Revision of `02-claude-agent-plan.md` based on `03-codex-review.md`)

## Status Map

- **P1 findings: 3/3 closed**
- **P2 findings: 3/3 closed**
- **Open questions: 2/2 answered**
- New risks discovered: none

---

## Findings Addressed

### Finding P1.1 — Preview token verification must be server-only — CLOSED

**Root cause:** Plan described preview page as a client component calling `verifyPreviewToken()` directly, which would require HMAC secret access on the client.

**Fix:**

The preview page becomes a **server component** that verifies the token server-side before rendering:

```typescript
// src/app/(preview)/preview/page.tsx — SERVER COMPONENT
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { verifyPreviewToken } from '@/lib/views/preview-session'
import { isAdminEmail } from '@/lib/auth/admin-access'
import { getAdminClient } from '@/lib/supabase/admin'
import { PreviewShell } from '@/components/views/preview-shell'

export default async function PreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  // 1. Verify admin session (server-side)
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) redirect('/login.html')

  // 2. Verify admin entitlement (isTrueAdmin — P1.3 fix)
  const supabase = getAdminClient()
  const { data: staff } = await supabase
    .from('staff')
    .select('role')
    .eq('email', session.user.email)
    .maybeSingle()
  const staffRole = staff?.role ?? null
  if (!isTrueAdmin(staffRole, session.user.email)) {
    redirect('/dashboard')
  }

  // 3. Verify token server-side (HMAC check — never exposed to client)
  const { token } = await searchParams
  if (!token) return <PreviewError message="No preview token provided" />

  const payload = verifyPreviewToken(token)
  if (!payload) return <PreviewError message="Invalid or expired preview token" />

  // 4. Actor-binding check (P1.2 fix)
  if (payload.actorEmail !== session.user.email) {
    return <PreviewError message="Preview session belongs to a different admin" />
  }

  // 5. Resolve modules server-side and pass to client shell
  const modules = await fetchPreviewModules(payload.viewId)

  return <PreviewShell session={payload} modules={modules} />
}
```

**Key changes from original plan:**
- Preview page is a **server component**, not client component
- `verifyPreviewToken()` is only ever called server-side
- `preview-session.ts` module uses `import 'server-only'` guard to prevent client import
- Token verification, admin gating, and actor-binding all happen in one server-side flow before any client code runs

### Finding P1.2 — Actor-token binding enforced — CLOSED

**Root cause:** Token payload included `actorId` but plan did not require matching it to the current authenticated session, allowing token replay by any authenticated user.

**Fix:**

Two-layer enforcement:

1. **Token creation:** `POST /api/admin/views/preview-session` stamps `actorEmail` (not just `actorId`) into the token payload. Email is used because `getServerSession()` always has email but may not have a stable UUID.

2. **Token verification:** Preview page server component checks `payload.actorEmail === session.user.email` before rendering (shown in P1.1 code above, step 4).

3. **Hard Rule update:**
   ```
   HR-6: Preview tokens are actor-bound — payload.actorEmail MUST match the
         authenticated session email. Reject mismatches with safe error state.
   ```

### Finding P1.3 — Admin gating uses isTrueAdmin, not requireRole — CLOSED

**Root cause:** Plan used `requireRole(ROLES.ADMIN)` which includes `operations_admin` via role mapping, conflicting with the established See-As policy that explicitly excludes `operations_admin`.

**Fix:**

1. **Extract `isTrueAdmin` to shared utility:**

   ```typescript
   // src/lib/auth/admin-access.ts (add to existing file)
   export function isTrueAdmin(staffRole: string | null, email: string): boolean {
     if (isAdminEmail(email)) return true
     return staffRole === 'admin'
   }
   ```

   Currently `isTrueAdmin` is defined inline in `viewer-context/route.ts`. Extract it to `admin-access.ts` (which already exports `isAdminEmail`) so both viewer-context and preview routes import from the same source.

2. **All preview endpoints use `isTrueAdmin`:**
   - `POST /api/admin/views/preview-session` — gate with `isTrueAdmin`
   - `GET /api/admin/views/[viewId]/preview-context` — gate with `isTrueAdmin`
   - Preview page server component — gate with `isTrueAdmin` (shown in P1.1 code)

3. **Viewer-context route updated** to import from shared location (removes inline duplicate).

4. **Hard Rule update:**
   ```
   HR-7: Preview impersonation uses isTrueAdmin gate (staffRole === 'admin' OR
         ADMIN_EMAILS). operations_admin is excluded — matches See-As policy exactly.
   ```

---

### Finding P2.1 — Module reorder endpoint added — CLOSED

**Root cause:** VB17 (module ordering) depended on a PATCH flow that didn't exist in the declared reused route. The existing modules route only has GET, POST, DELETE.

**Fix:**

Add a dedicated reorder endpoint:

**`PATCH /api/admin/views/[viewId]/modules/reorder`** (new file: `route.ts`)

```typescript
// Request body:
const ReorderSchema = z.object({
  order: z.array(z.object({
    module_id: z.string().uuid(),
    sort_order: z.number().int().min(0),
  })),
})

// Handler:
export async function PATCH(request, { params }) {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response
  if (!isTrueAdmin(auth.user.staffRole, auth.user.email)) {
    return ApiErrors.forbidden('Preview management is restricted to full admins')
  }

  const { viewId } = await params
  const body = await request.json()
  const validation = ReorderSchema.safeParse(body)
  if (!validation.success) return apiValidationError(validation.error)

  // Batch update sort_order values in a single transaction
  for (const item of validation.data.order) {
    await supabase
      .from('view_profile_modules')
      .update({ sort_order: item.sort_order })
      .eq('view_id', viewId)
      .eq('module_id', item.module_id)
  }

  logAdminAudit({
    action: 'module.reorder',
    actorId: auth.user.id,
    actorEmail: auth.user.email,
    details: { view_id: viewId, new_order: validation.data.order },
  })

  return new Response(null, { status: 204 })
}
```

**Task matrix update:** VB17 now depends on this new endpoint. Added to file manifest.

### Finding P2.2 — Search params corrected to match existing APIs — CLOSED

**Root cause:** Plan referenced `?q=...` for staff/partner search, but existing APIs use `?search=...`.

**Fix:**

1. **Audience selector** (`src/components/views/audience-selector.tsx`) uses `?search=` for both:
   - Staff search: `GET /api/staff?search=${term}`
   - Partner search: `GET /api/partners?search=${term}`

2. **Debounce:** 300ms debounce on search input to prevent rapid-fire API calls.

3. **Result window:** API calls include `&limit=20` to cap result size. The existing APIs already support `limit` parameter.

4. **Plan text corrected:** VB12 description updated to reference `?search=` not `?q=`.

### Finding P2.3 — Token payload minimized, PII removed — CLOSED

**Root cause:** Token payload contained `actorEmail`, `subjectLabel`, and other PII that would appear in URL query strings, browser history, and network logs.

**Fix: Opaque session ID approach.**

Instead of encoding the full payload in the token, use a server-side session store:

1. **`POST /api/admin/views/preview-session`** creates a DB row:
   ```sql
   -- Using existing admin_audit_log or a lightweight in-memory store
   -- For v1: use a simple Map with TTL (same pattern as nav caching)
   ```

   Actually, for simplicity and to avoid a new table, use an **encrypted opaque token** approach:

   **Revised token structure:**
   ```typescript
   interface PreviewTokenPayload {
     sid: string          // random session ID (crypto.randomUUID())
     vid: string          // view ID (UUID)
     sub: string          // subject type shortcode ('s'|'p'|'r'|'pt'|'d')
     tid: string | null   // target ID (UUID or role slug — not PII)
     rol: string          // resolved role shortcode
     dm: 's' | 'l'        // data mode
     act: string          // actor user ID (UUID — not email)
     exp: number          // expiry epoch
   }
   ```

   **What was removed:**
   - `actorEmail` → replaced with `act` (UUID). Actor-binding check uses `act === auth.user.id` instead of email comparison.
   - `subjectLabel` → removed entirely. Resolved server-side when preview loads.
   - `issuedAt` → removed (redundant with `exp`).

   **What stays:**
   - View ID, subject type, target ID, resolved role, data mode — all required for rendering.
   - Target IDs are UUIDs (opaque), not names. Role slugs are system constants, not PII.

2. **Actor-binding updated** (P1.2 amendment): Check `payload.act === auth.user.id` instead of email.

3. **Token transport:** Still via URL query param `?token=`, but now the payload contains only UUIDs and shortcodes — no human-readable PII.

---

## Open Questions Answered

### Q1: Single-use vs renewable preview sessions?

**Decision: Renewable within actor-bound window.**

Rationale: Frequent audience switching is the primary workflow. Requiring a new token for every switch would add latency and API calls. Instead:
- Tokens are **renewable** — changing audience creates a new token (old one expires naturally at TTL).
- Each token is **actor-bound** — only the admin who created it can use it.
- TTL is 15 minutes — short enough to limit replay window.
- The builder page manages token lifecycle: creates on mount, refreshes on audience switch.

### Q2: Live mode requires concrete target?

**Decision: Yes — live mode hard-requires a concrete entity target.**

Rationale: Prevents accidental broad reads.
- `live` mode + `subjectType === 'role'` or `'partner_type'` → error: "Select a specific partner or staff member for live data"
- `live` mode + `subjectType === 'partner'` with `targetId` → allowed (fetch that partner's data)
- `live` mode + `subjectType === 'staff'` with `targetId` → allowed
- `snapshot` mode → always allowed regardless of target specificity

Implementation: preview context provider checks `dataMode === 'live' && !targetId` and shows a guidance banner instead of fetching.

---

## Updated Hard Rules

| ID | Rule |
|----|------|
| HR-1 | Preview subject NEVER affects write permissions — actor-derived auth is always authoritative |
| HR-2 | Preview tokens are HMAC-signed, short-TTL (15 min), admin-only issuance |
| HR-3 | Preview shell MUST reuse shared layout components — no parallel maintenance of sidebar/nav |
| HR-4 | All module composition mutations audit-logged via `logAdminAudit()` |
| HR-5 | Non-admin requests to preview endpoints return 403, no information leak |
| HR-6 | **[NEW]** Preview tokens are actor-bound — `payload.act` MUST match authenticated user ID. Reject mismatches with safe error state. |
| HR-7 | **[NEW]** Preview impersonation uses `isTrueAdmin` gate (`staffRole === 'admin'` OR `ADMIN_EMAILS`). `operations_admin` excluded — matches See-As policy. |
| HR-8 | **[NEW]** Token payloads contain only UUIDs, shortcodes, and timestamps — no emails, names, or human-readable PII. |
| HR-9 | **[NEW]** Live data mode requires a concrete entity target (specific partner ID or staff ID). Role/type-level targets use snapshot mode only. |

---

## Updated File Manifest

### New Files (additions from revision)

| File | Wave | Owner | Purpose |
|------|------|-------|---------|
| `src/app/api/admin/views/[viewId]/modules/reorder/route.ts` | 2 | api-flow | Module sort_order batch update (P2.1) |

### Modified Files (changes from revision)

| File | Wave | Change |
|------|------|--------|
| `src/lib/auth/admin-access.ts` | 1 | Add `isTrueAdmin()` export (P1.3) |
| `src/app/api/viewer-context/route.ts` | 1 | Import `isTrueAdmin` from shared location, remove inline definition (P1.3) |
| `src/app/(preview)/preview/page.tsx` | 1 | Server component, not client — server-side token verification + admin gate + actor binding (P1.1, P1.2, P1.3) |
| `src/lib/views/preview-session.ts` | 1 | Add `import 'server-only'` guard; minimized token payload (P1.1, P2.3) |
| `src/components/views/audience-selector.tsx` | 2 | Use `?search=` not `?q=`, 300ms debounce, `limit=20` (P2.2) |
| `src/lib/views/preview-bridge.ts` | 2 | `audienceChanged` message carries new token (opaque, no PII) (P2.3) |

---

## Updated Task Matrix (Deltas Only)

| ID | Change |
|----|--------|
| VB2 | Token payload minimized: `sid`, `vid`, `sub`, `tid`, `rol`, `dm`, `act`, `exp` — no PII. Add `import 'server-only'`. |
| VB3 | Gate with `isTrueAdmin()` not `requireRole(ROLES.ADMIN)`. Actor stamped as UUID not email. |
| VB4 | Gate with `isTrueAdmin()`. |
| VB5 | Preview page is server component. Token verified server-side. Actor-binding check added. Admin gate added. |
| VB12 | Search uses `?search=` with 300ms debounce and `&limit=20`. |
| VB17 | Now depends on new `PATCH .../modules/reorder` endpoint (P2.1). |
| VB17a | **[NEW]** Build `PATCH /api/admin/views/[viewId]/modules/reorder` with Zod schema + audit logging. |

---

## Verification Evidence

### Finding Closure

| Finding | Fix | Verification |
|---------|-----|-------------|
| P1.1 Token verification server-only | Preview page is server component; `preview-session.ts` has `import 'server-only'` | `npm run build` — client bundle will error if accidentally imported client-side |
| P1.2 Actor-token binding | `payload.act === auth.user.id` check in preview page | Unit test: token with different actor ID → rejected |
| P1.3 isTrueAdmin gate | Extracted to `admin-access.ts`, used in all 3 preview endpoints | Unit test: `operations_admin` role → 403 on preview-session API |
| P2.1 Reorder endpoint | New `PATCH .../modules/reorder` with Zod schema | API test: reorder 3 modules, verify DB sort_order values |
| P2.2 Search params | `?search=` with debounce + limit | Manual: type in audience selector, verify API calls use correct param |
| P2.3 Token PII minimized | Payload uses only UUIDs/shortcodes | Inspect token payload in tests — no emails, names, or labels present |

### Open Questions

| Question | Decision | Rationale |
|----------|----------|-----------|
| Q1: Single-use vs renewable? | Renewable within actor-bound window | Frequent audience switching is primary workflow; TTL + actor-binding provides sufficient security |
| Q2: Live mode requires target? | Yes — concrete partner/staff ID required | Prevents accidental broad data reads; role/type targets use snapshot only |

---

## Acceptance Check Summary

- [x] All 3 P1 findings closed with concrete plan deltas
- [x] All 3 P2 findings closed with concrete plan deltas
- [x] Both open questions answered with decisions + rationale
- [x] Hard Rules updated (HR-6 through HR-9 added)
- [x] File manifest updated with new/modified files
- [x] Task matrix updated with deltas
- [x] Verification evidence defined for each finding
- [ ] `npm run build` — pending (no code written yet, this is a plan revision)
- [ ] Implementation — pending approval of this revision
