# Security Documentation

## Current Security Measures

### Authentication & Authorization
- **NextAuth.js** with Google OAuth provider
- **JWT sessions** with secure token handling
- **Dashboard routes protected** via layout-level auth check
- **All API routes protected** via `requireAuth()` helper
- **CSRF protection** handled by NextAuth
- **Email domain restriction** configurable via `ALLOWED_EMAIL_DOMAINS`

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
| All routes authenticated | ✅ Done | `requireAuth()` on all 14 routes |
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

## Production Checklist

Before deploying to production, complete these items:

### Critical (Must Do)
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
- [ ] **Set ALLOWED_EMAIL_DOMAINS** - `sophiesociety.com`
- [ ] **Generate new NEXTAUTH_SECRET** - `openssl rand -base64 32`
- [ ] **Enable Supabase RLS** - Row-level security policies
- [ ] **Remove allowedDevOrigins** - Only for local dev
- [ ] **Disable source maps** - `productionBrowserSourceMaps: false`

### Important (Should Do)
- [ ] **Add CSP header** - See CSP section below
- [ ] **Add rate limiting** - Vercel Edge or Upstash
- [ ] **Add input validation** - Zod schemas on all API routes
- [ ] **Set up error monitoring** - Sentry (sanitize PII)
- [ ] **Enable audit logging** - Track admin actions
- [ ] **Review npm vulnerabilities** - `npm audit fix`
- [ ] **Enable Dependabot** - Automated security updates
- [ ] **Add session timeout** - `maxAge: 24 * 60 * 60` (24 hours)

### Recommended (Nice to Have)
- [ ] **Add 2FA option** - For admin users
- [ ] **IP allowlisting** - Restrict admin by IP/VPN
- [ ] **Penetration testing** - Before public launch
- [ ] **Security audit** - Third-party review

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

## API Route Protection

All API routes use the `requireAuth()` helper:

```typescript
import { requireAuth } from '@/lib/auth/api-auth'

export async function GET() {
  const auth = await requireAuth()
  if (!auth.authenticated) return auth.response

  // ... protected code
}
```

Returns 401 Unauthorized if no valid session.

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

## Audit History

| Date | Scope | Findings | Status |
|------|-------|----------|--------|
| 2025-01-24 | Full audit | Auth bypass, weak secret, unprotected APIs, missing headers | Fixed |

**Next Review:** Before production deployment
