# Security Documentation

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
| HTTPS enforcement | ⏳ Production | Enable HSTS header |
| SSL certificate validity | ⏳ Production | Use auto-renewing certs (Vercel/Let's Encrypt) |
| Secure cookies | ⏳ Production | Set `secure: true` in NextAuth |

### Security Headers
| Item | Status | Notes |
|------|--------|-------|
| X-Frame-Options | ✅ Done | SAMEORIGIN |
| X-Content-Type-Options | ✅ Done | nosniff |
| Referrer-Policy | ✅ Done | strict-origin-when-cross-origin |
| Permissions-Policy | ✅ Done | Disabled camera/mic/geo |
| HSTS | ⏳ Production | Requires HTTPS |
| CSP (Content-Security-Policy) | ⏳ Production | See CSP section below |

### Server/Info Disclosure
| Item | Status | Notes |
|------|--------|-------|
| X-Powered-By hidden | ✅ Done | `poweredByHeader: false` |
| Stack traces hidden | ⏳ Production | Next.js hides in production mode |
| Error messages sanitized | ⏳ Review | Don't leak internal details |
| Server version hidden | ✅ Done | No version headers |

### Authentication & Sessions
| Item | Status | Notes |
|------|--------|-------|
| Strong session secret | ✅ Done | 32-byte random |
| Session timeout | ⏳ Production | Add `maxAge` to session config |
| Secure cookie flags | ⏳ Production | httpOnly, secure, sameSite |
| Domain restriction | ✅ Done | `ALLOWED_EMAIL_DOMAINS` configurable |

### API Security
| Item | Status | Notes |
|------|--------|-------|
| All routes authenticated | ✅ Done | `requireAuth()` on all routes |
| Permission-based access | ✅ Done | `requirePermission()` on admin routes |
| Rate limiting | ⏳ Production | Add Vercel/Upstash rate limiter |
| Input validation | ⏳ Recommended | Add Zod schemas |
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
| Row Level Security | ⏳ Production | Enable RLS policies |
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
- [ ] **Enable HSTS header** - Uncomment in next.config.mjs
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
- [ ] **Enable Supabase RLS** - Row-level security policies on all tables
- [ ] **Test permission checks** - Verify non-admins can't access admin routes
- [ ] **Remove test accounts** - Clean up any dev users

#### Config Cleanup
- [ ] **Remove allowedDevOrigins** - Delete Tailscale URL from next.config.mjs
- [ ] **Disable source maps** - Add `productionBrowserSourceMaps: false`
- [ ] **Remove /test.html** - Delete test pages from public/

### 🟡 Important (Should Do)

#### Security Headers
- [ ] **Add CSP header** - See CSP section below
- [ ] **Test CSP thoroughly** - Can break functionality if too strict

#### API Security
- [ ] **Add rate limiting** - Vercel Edge or Upstash Redis
- [ ] **Add input validation** - Zod schemas on all API routes
- [ ] **Add request size limits** - Prevent large payload attacks
- [ ] **Add session timeout** - `maxAge: 24 * 60 * 60` (24 hours)

#### Monitoring
- [ ] **Set up error monitoring** - Sentry (sanitize PII in reports)
- [ ] **Enable audit logging** - Track admin actions to DB
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

Add this to next.config.mjs headers for production:

```javascript
{
  key: 'Content-Security-Policy',
  value: [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js requires these
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self' https://*.supabase.co https://accounts.google.com https://oauth2.googleapis.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
}
```

**Note:** Test thoroughly - CSP can break functionality if too strict.

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

### What's Deferred (Build When Needed)
- ⏳ Frontend role-based UI components (`<RequireRole>`, `useUserRole`)
- ⏳ Admin UI for role management
- ⏳ Supabase RLS policies (enable when multi-tenant features built)
- ⏳ Partner portal authentication
- ⏳ Audit logging for sensitive actions

### Development-Only Risks (OK for now)
- `allowedDevOrigins` in next.config.mjs - for Tailscale testing
- HTTP access - using Tailscale, not public HTTPS yet
- No rate limiting - internal tool, trusted users

---

## Audit History

| Date | Scope | Findings | Status |
|------|-------|----------|--------|
| 2025-01-24 | Full audit | Auth bypass, weak secret, unprotected APIs, missing headers | Fixed |
| 2025-01-24 | RBAC implementation | Added role-based permissions, protected admin routes | Done |
| 2025-01-24 | Deep code audit | Open redirect, query injection, ReDoS risk, IDOR | Fixed |

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
