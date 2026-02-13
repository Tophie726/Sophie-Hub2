# Security Documentation

For the current security baseline, risk register, and rollout roadmap, start here:
- `src/docs/SECURITY-INDEX.md`
- `src/docs/SECURITY-FOUNDATION-ANALYSIS.md`
- `docs/SECURITY-STATUS-SHARE-2026-02-11.md`

## Current Security Measures

### Authentication & Authorization
- **NextAuth.js** with Google OAuth provider
- **JWT sessions** with secure token handling
- **Dashboard routes protected** via layout-level auth check
- **Role-based access control** via `src/lib/auth/roles.ts`
- **Permission-based API protection** via `requirePermission()` helper
- **CSRF protection** handled by NextAuth
- **Email domain restriction** configurable via `ALLOWED_EMAIL_DOMAINS`

### Role-Based Access Control (Implemented)
| Role | Access Level |
|------|-------------|
| `admin` | Full access - all features, data enrichment, settings |
| `pod_leader` | Assigned partners, their own profile |
| `staff` | Assigned partners, own profile |
| `partner` | Own data only (future - partner portal) |

**Key files:**
- `src/lib/auth/roles.ts` - ROLES, PERMISSIONS, hasPermission()
- `src/lib/auth/api-auth.ts` - requirePermission(), requireRole(), canAccessPartner()
- `src/app/api/me/route.ts` - Returns current user's role and permissions

### Security Headers (next.config.mjs)
| Header | Value | Protection |
|--------|-------|------------|
| X-Frame-Options | SAMEORIGIN | Clickjacking |
| X-Content-Type-Options | nosniff | MIME sniffing |
| Referrer-Policy | strict-origin-when-cross-origin | Data leakage |
| Permissions-Policy | camera=(), microphone=(), geolocation=() | Feature abuse |
| X-DNS-Prefetch-Control | on | Performance |
| poweredByHeader | false | Server info disclosure |

### Data Protection
- **Supabase** with Row Level Security (RLS) capable
- **Parameterized queries** prevent SQL injection
- **React's default escaping** prevents XSS
- **Environment variables** for all secrets (not hardcoded)

### Recent Security Hardening (2026-02 to 2026-02-11)
- **Admin auth bypass fixed** in BigQuery admin routes (`requireRole` result handling corrected)
- **Feedback XSS vector removed** (`document.write` screenshot path replaced with safe DOM API)
- **Attachment URL validation centralized** in `src/lib/security/attachment-url.ts`
- **Attachment allowlist enforced**: `http`, `https`, `data:image/*`, `data:application/pdf`
- **API error detail leakage reduced**: `ApiErrors.internal/database` now return generic client messages
- **CSP tightened in production**: removed `unsafe-eval` from production `script-src`
- **Slack sync race condition fixed**: partial unique index + atomic `create_sync_run_atomic()` RPC for single active run
- **BigQuery hardening expanded**: strict rate limits, capped `partner_ids`, and widget config size/depth validation
- **Cron auth hardened**: cron endpoints fail closed when `CRON_SECRET` is missing

### Sensitive Files Protection
| File/Path | Status | Notes |
|-----------|--------|-------|
| `.env.local` | Protected | In .gitignore, never committed |
| `.git/` | Protected | Not exposed via Next.js |
| `package.json` | Protected | Not directly accessible |
| `node_modules/` | Protected | Not exposed |

### Secrets Management
- `.env.local` excluded from git via `.gitignore`
- `NEXTAUTH_SECRET` - 32-byte cryptographically random
- `SUPABASE_SERVICE_ROLE_KEY` - admin access, server-side only
- `GOOGLE_CLIENT_SECRET` - OAuth credentials

---

## Full Security Checklist

### HTTPS & Transport Security
| Item | Status | Notes |
|------|--------|-------|
| HTTPS enforcement | ✅ Done (on Vercel) | Platform edge enforces HTTPS for deployed app |
| SSL certificate validity | ⏳ Production | Use auto-renewing certs (Vercel/Let's Encrypt) |
| Secure cookies | ⚠️ Verify in deploy env | NextAuth uses secure cookie defaults on HTTPS deployments |

### Security Headers
| Item | Status | Notes |
|------|--------|-------|
| X-Frame-Options | ✅ Done | SAMEORIGIN |
| X-Content-Type-Options | ✅ Done | nosniff |
| Referrer-Policy | ✅ Done | strict-origin-when-cross-origin |
| Permissions-Policy | ✅ Done | Disabled camera/mic/geo |
| HSTS | ✅ Done (Vercel deploys) | Set conditionally in `next.config.mjs` when `VERCEL` is present |
| CSP (Content-Security-Policy) | ✅ Done | Implemented with accepted-risk note for `unsafe-inline` |

### Server/Info Disclosure
| Item | Status | Notes |
|------|--------|-------|
| X-Powered-By hidden | ✅ Done | `poweredByHeader: false` |
| Stack traces hidden | ⏳ Production | Next.js hides in production mode |
| Error messages sanitized | ✅ Done | Generic `ApiErrors.internal/database` messages |
| Server version hidden | ✅ Done | No version headers |

### Authentication & Sessions
| Item | Status | Notes |
|------|--------|-------|
| Strong session secret | ✅ Done | 32-byte random |
| Session timeout | ✅ Done | NextAuth `session.maxAge` configured (7 days) |
| Secure cookie flags | ⏳ Production | httpOnly, secure, sameSite |
| Domain restriction | ✅ Done | `ALLOWED_EMAIL_DOMAINS` configurable |

### API Security
| Item | Status | Notes |
|------|--------|-------|
| All routes authenticated | ✅ Done | `requireAuth()` on all routes |
| Permission-based access | ✅ Done | `requirePermission()` on admin routes |
| Rate limiting | ⚠️ Partial | In-memory limiter active; distributed limiter still planned |
| Input validation | ⚠️ Partial | Zod is implemented on many critical routes; expand coverage |
| CORS configuration | ✅ OK | Next.js defaults are secure |

### Sensitive File Exposure
| Item | Status | Notes |
|------|--------|-------|
| .env files | ✅ Protected | In .gitignore |
| .git directory | ✅ Protected | Not exposed by Next.js |
| package.json | ✅ Protected | Returns 404, not file |
| Source maps | ⏳ Production | Disable in production build |

### Database Security
| Item | Status | Notes |
|------|--------|-------|
| SQL injection | ✅ Protected | Supabase parameterized queries |
| Row Level Security | ⚠️ Partial | Enabled on multiple security-critical tables; full coverage review pending |
| Connection encryption | ✅ Done | Supabase uses SSL |
| Service key protection | ✅ Done | Server-side only |

### Client-Side Security
| Item | Status | Notes |
|------|--------|-------|
| XSS prevention | ✅ Done | React escaping |
| External CDN resources | ✅ None | No untrusted CDNs |
| Google Fonts/GDPR | ✅ None | Fonts are local |
| Password autocomplete | N/A | Using OAuth only |

### Dependency Security
| Item | Status | Notes |
|------|--------|-------|
| npm audit | ⚠️ 3 high | eslint-config-next (non-exploitable in our use) |
| Dependabot | ⏳ Recommended | Enable on GitHub |
| Lock file | ✅ Done | package-lock.json committed |

### Admin/Debug Exposure
| Item | Status | Notes |
|------|--------|-------|
| Admin panel protected | ✅ Done | Auth required |
| Debug endpoints | ✅ None | No debug routes |
| Documentation endpoints | ✅ None | No exposed docs |

---

## Production Deployment Checklist

Before deploying to production, complete these items:

### 🔴 Critical (Must Do Before Launch)

#### Environment & Secrets
- [ ] **Generate new NEXTAUTH_SECRET** - `openssl rand -base64 32`
- [ ] **Set ALLOWED_EMAIL_DOMAINS** - `sophiesociety.com`
- [ ] **Review all env vars** - No dev/test values in production
- [ ] **Rotate any exposed secrets** - If ever committed to git

#### HTTPS & Cookies
- [ ] **Verify HSTS header on deployed environment** - Already configured conditionally for Vercel
- [ ] **Set secure cookie options** in NextAuth:
  ```typescript
  cookies: {
    sessionToken: {
      name: `__Secure-next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: true,
      },
    },
  },
  ```
- [ ] **Force HTTPS redirects** - Configure in hosting (Vercel does this)

#### Access Control
- [ ] **Complete RLS coverage review** - Confirm all production tables have intended policies
- [ ] **Test permission checks** - Verify non-admins can't access admin routes
- [ ] **Remove test accounts** - Clean up any dev users

#### Config Cleanup
- [ ] **Remove allowedDevOrigins** - Delete Tailscale URL from next.config.mjs
- [ ] **Disable source maps** - Add `productionBrowserSourceMaps: false`
- [ ] **Remove /test.html** - Delete test pages from public/

### 🟡 Important (Should Do)

#### Security Headers
- [ ] **Validate CSP policy against current UI behavior** - Keep accepted-risk docs current
- [ ] **Re-test CSP after major frontend changes** - Especially around script execution

#### API Security
- [ ] **Migrate heavy-route rate limits to distributed backend** - Redis/DB-backed implementation
- [ ] **Expand input validation coverage** - Ensure all mutable/expensive routes have Zod
- [ ] **Add request size limits** - Prevent large payload attacks
- [ ] **Review session timeout policy target** - Current config is 7 days; align with agreed risk posture

#### Monitoring
- [ ] **Set up error monitoring** - Sentry (sanitize PII in reports)
- [ ] **Expand audit logging coverage** - Ensure all sensitive admin flows are logged
- [ ] **Set up uptime monitoring** - Get alerts if app goes down

#### Dependencies
- [ ] **Review npm vulnerabilities** - `npm audit fix`
- [ ] **Enable Dependabot** - Automated security updates on GitHub
- [ ] **Lock Node.js version** - Specify in package.json engines

### 🟢 Recommended (Nice to Have)

- [ ] **Add 2FA option** - For admin users (TOTP via authenticator app)
- [ ] **IP allowlisting** - Restrict admin by IP/VPN
- [ ] **Penetration testing** - Professional security test before public launch
- [ ] **Security audit** - Third-party code review
- [ ] **Bug bounty program** - If public-facing

### 📋 Pre-Launch Verification

Run these checks before going live:

```bash
# 1. Check for secrets in code
git log --all -p | grep -i "password\|secret\|api_key" | head -20

# 2. Check npm vulnerabilities
npm audit

# 3. Verify env vars are set (run in production)
echo $NEXTAUTH_SECRET | wc -c  # Should be 44+ chars

# 4. Test auth redirect
curl -I https://yourapp.com/dashboard  # Should redirect to login

# 5. Test API auth
curl https://yourapp.com/api/data-sources  # Should return 401
```

### 🔄 Post-Launch

- [ ] **Monitor error rates** - First 24-48 hours closely
- [ ] **Check auth logs** - Any failed login attempts
- [ ] **Review Supabase logs** - Any unusual queries
- [ ] **Test from mobile** - Verify auth flow works

---

## Content Security Policy (CSP)

Current implementation in `next.config.mjs`:
- **Production**: `script-src` excludes `unsafe-eval`
- **Development**: `script-src` includes `unsafe-eval` for local tooling/HMR compatibility

```javascript
{
  key: 'Content-Security-Policy',
  value: process.env.NODE_ENV === 'production'
    ? "default-src 'self'; script-src 'self' 'unsafe-inline' https://us.i.posthog.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.googleusercontent.com; connect-src 'self' https://us.i.posthog.com https://*.supabase.co https://oauth2.googleapis.com; font-src 'self'; frame-ancestors 'none'"
    : "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://us.i.posthog.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.googleusercontent.com; connect-src 'self' https://us.i.posthog.com https://*.supabase.co https://oauth2.googleapis.com; font-src 'self'; frame-ancestors 'none'"
}
```

**Note:** `unsafe-inline` remains for compatibility; if stricter CSP is needed later, move to nonce/hash-based script strategy.

---

## Input Validation Example

Add Zod validation to API routes:

```typescript
import { z } from 'zod'

const CreateSourceSchema = z.object({
  name: z.string().min(1).max(255),
  spreadsheet_id: z.string().min(1),
  spreadsheet_url: z.string().url().optional(),
})

export async function POST(request: Request) {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  const body = await request.json()
  const result = CreateSourceSchema.safeParse(body)

  if (!result.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: result.error.flatten() },
      { status: 400 }
    )
  }

  // Use result.data (validated & typed)
}
```

---

## Rate Limiting Example

Using Upstash Redis:

```typescript
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '10 s'), // 10 requests per 10 seconds
})

export async function GET(request: Request) {
  const ip = request.headers.get('x-forwarded-for') ?? 'anonymous'
  const { success } = await ratelimit.limit(ip)

  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429 }
    )
  }

  // ... handle request
}
```

---

## Error Handling Best Practices

**Don't leak internal details:**

```typescript
// BAD - exposes internal error
catch (error) {
  return NextResponse.json({ error: error.message }, { status: 500 })
}

// GOOD - generic message, log internally
catch (error) {
  console.error('API Error:', error) // Log for debugging
  return NextResponse.json(
    { error: 'An unexpected error occurred' },
    { status: 500 }
  )
}
```

---

## Logging & Monitoring

### What to Log
- Authentication attempts (success/failure)
- Admin actions (data modifications)
- API errors (sanitized)
- Rate limit hits

### What NOT to Log
- Passwords or tokens
- Full request bodies with PII
- Session contents
- Credit card numbers

### Example Audit Log
```typescript
async function logAuditEvent(event: {
  action: string
  userId: string
  resource: string
  details?: Record<string, unknown>
}) {
  await supabase.from('audit_logs').insert({
    ...event,
    timestamp: new Date().toISOString(),
    ip_address: request.headers.get('x-forwarded-for'),
  })
}
```

---

## Multi-Tenant Authorization

For role-based access control (Pod Leaders seeing only their partners, Partners seeing only their data), see:

**[docs/AUTHORIZATION.md](docs/AUTHORIZATION.md)**

Covers:
- User roles & permissions
- API-level authorization
- Supabase Row Level Security (RLS)
- Frontend guards
- Partner portal architecture
- Common vulnerabilities (IDOR, mass assignment, privilege escalation)

---

## Future Security Features (Planned)

### Admin Role Management UI
Admin will need a UI to:
- View all users and their roles
- Assign/change user roles
- View staff table and manage permissions

**Security considerations:**
- Only admins can access role management
- Cannot demote yourself (prevent lockout)
- Audit log all role changes
- Require confirmation for sensitive changes

### Partner Portal (Automatic Access)
Partners will access their own dashboard via email matching:

```
Partner logs in with partner@theirbrand.com
  ↓
System checks partner_users table for that email
  ↓
If found → grants access to that partner's data only
If not found → access denied
```

**Security considerations:**
- Partners added to `partner_users` table by admin
- Email must be verified (magic link or OAuth with their domain)
- RLS ensures they can ONLY see their own partner's data
- Separate auth provider or same OAuth with domain check
- Consider: should partner see all data or curated view?

### Sidebar/Tab Visibility
Different roles see different navigation items:

| Feature | Admin | Pod Leader | Staff | Partner |
|---------|-------|------------|-------|---------|
| Data Enrichment | ✅ | ❌ | ❌ | ❌ |
| All Partners | ✅ | ❌ | ❌ | ❌ |
| My Partners | ✅ | ✅ | ✅ | ❌ |
| My Dashboard | ❌ | ❌ | ❌ | ✅ |
| Settings | ✅ | ❌ | ❌ | ❌ |
| User Management | ✅ | ❌ | ❌ | ❌ |

**Implementation:** Frontend `<RequireRole>` component hides UI, but API + RLS enforce actual access.

---

## API Route Protection

### Basic Authentication
All API routes require authentication:

```typescript
import { requireAuth } from '@/lib/auth/api-auth'

export async function GET() {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  // auth.user contains { id, email, name, role }
}
```

### Permission-Based Access (Admin Routes)
Admin-only routes use permission checks:

```typescript
import { requirePermission } from '@/lib/auth/api-auth'

export async function POST(request: Request) {
  const auth = await requirePermission('data-enrichment:write')
  if (!auth.authenticated) return auth.response

  // Only admins reach here
}
```

### Protected Routes Summary
| Route | Protection |
|-------|-----------|
| `/api/me` | `requireAuth()` - any authenticated user |
| `/api/data-sources/*` | `requirePermission('data-enrichment:read/write')` |
| `/api/mappings/*` | `requirePermission('data-enrichment:read/write')` |
| `/api/tab-mappings/*` | `requirePermission('data-enrichment:read/write')` |

Returns:
- 401 Unauthorized - no valid session
- 403 Forbidden - valid session but insufficient permissions

---

## Reporting Security Issues

If you discover a security vulnerability:

1. **Do NOT** open a public GitHub issue
2. Contact the development team directly
3. Provide details of the vulnerability
4. Allow reasonable time for a fix before disclosure

---

## Security Contacts

- **Lead Developer**: [Add contact]
- **Security Review**: [Add contact]

---

## Current Development Stage Considerations

At this stage (foundation building), these are the active security measures:

### What's Protected Now
- ✅ All API routes require authentication
- ✅ Admin routes (data-enrichment) require admin permission
- ✅ Security headers in place
- ✅ Role system implemented and in use
- ✅ User role lookup from staff table
- ✅ Audit logging infrastructure for core admin/config flows
- ✅ Rate limiting exists for key expensive routes

### What's Deferred (Build When Needed)
- ⏳ Frontend role-based UI components (`<RequireRole>`, `useUserRole`)
- ⏳ Admin UI for role management
- ⏳ Supabase RLS policies (enable when multi-tenant features built)
- ⏳ Partner portal authentication
- ⏳ Distributed rate limiting (multi-instance safe)

### Development-Only Risks (OK for now)
- `allowedDevOrigins` in next.config.mjs - for Tailscale testing
- HTTP access - using Tailscale, not public HTTPS yet
- In-memory rate limiting is process-local (partial protection)

---

## Audit History

| Date | Scope | Findings | Status |
|------|-------|----------|--------|
| 2025-01-24 | Full audit | Auth bypass, weak secret, unprotected APIs, missing headers | Fixed |
| 2025-01-24 | RBAC implementation | Added role-based permissions, protected admin routes | Done |
| 2025-01-24 | Deep code audit | Open redirect, query injection, ReDoS risk, IDOR | Core fixes shipped; low-risk notes tracked |
| 2026-02-07 | Reactor security sweep (baseline) | P1/P2/P3 reliability + security issues identified | Completed |
| 2026-02-08 | Reactor security sweep (remediation) | Search hardening, Slack race fix, payload minimization, rate-limit hardening | Completed |
| 2026-02-11 | Security status consolidation | Unified status-share + roadmap + checklist refresh | Completed |

**Next Review:** Before production deployment

---

## Vulnerabilities Found & Fixed (Deep Audit)

### 1. Open Redirect (HIGH) - FIXED ✅

**Location:** `src/app/(auth)/signin/page.tsx` and `public/login.html`

**Issue:** `callbackUrl` from URL params was used directly without validation.

**Attack:** `https://app.com/signin?callbackUrl=https://evil.com` → user signs in → redirected to phishing site

**Fix:** Added `getSafeCallbackUrl()` validation:
- Only allows relative paths starting with `/`
- Blocks `//`, `javascript:`, and absolute URLs
- Falls back to `/dashboard` for invalid URLs

```typescript
function getSafeCallbackUrl(url: string | null): string {
  if (!url) return '/dashboard'
  if (url.startsWith('/') && !url.startsWith('//') &&
      !url.toLowerCase().includes('javascript:')) {
    return url
  }
  return '/dashboard'
}
```

---

### 2. Google Drive Query Injection (MEDIUM) - FIXED ✅

**Location:** `src/lib/google/sheets.ts:searchSheets()`

**Issue:** User search query interpolated directly into Drive API query string.

**Attack:** Input `' or name contains '` could manipulate query behavior.

**Fix:** Added `escapeQueryString()` to escape quotes and backslashes:

```typescript
function escapeQueryString(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}
```

---

### 3. Potential ReDoS (LOW) - NOTED ⚠️

**Location:** `src/types/enrichment.ts:337`

**Issue:** `new RegExp(config.matches_regex)` with admin-configurable pattern.

**Risk:** Malicious regex like `(a+)+$` could freeze server.

**Current Status:** Low risk - only admin can configure, wrapped in try/catch.

**Future Fix:** Add regex complexity limits or use RE2 library.

---

### 4. IDOR in Tab Mapping (LOW) - NOTED ⚠️

**Location:** `src/app/api/tab-mappings/[id]/status/route.ts`

**Issue:** Any authenticated user can update any tab mapping by ID.

**Current Status:** Low risk - internal admin tool with trusted users.

**Future Fix:** Add ownership check when multi-user editing is needed.

---

### 5. localStorage Draft Persistence (INFO)

**Location:** `src/components/data-enrichment/smart-mapper.tsx`

**Issue:** Draft data persists in browser localStorage.

**Risk:** Shared computer could expose draft data.

**Status:** Acceptable for internal tool. Add clear-on-logout if needed.
