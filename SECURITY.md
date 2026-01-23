# Security Documentation

## Current Security Measures

### Authentication & Authorization
- **NextAuth.js** with Google OAuth provider
- **JWT sessions** with secure token handling
- **Dashboard routes protected** via layout-level auth check
- **All API routes protected** via `requireAuth()` helper
- **CSRF protection** handled by NextAuth

### Security Headers (next.config.mjs)
| Header | Value | Protection |
|--------|-------|------------|
| X-Frame-Options | SAMEORIGIN | Clickjacking |
| X-Content-Type-Options | nosniff | MIME sniffing |
| Referrer-Policy | strict-origin-when-cross-origin | Data leakage |
| Permissions-Policy | camera=(), microphone=(), geolocation=() | Feature abuse |

### Data Protection
- **Supabase** with Row Level Security (RLS) capable
- **Parameterized queries** prevent SQL injection
- **React's default escaping** prevents XSS
- **Environment variables** for all secrets (not hardcoded)

### Secrets Management
- `.env.local` excluded from git via `.gitignore`
- `NEXTAUTH_SECRET` - 32-byte cryptographically random
- `SUPABASE_SERVICE_ROLE_KEY` - admin access, server-side only
- `GOOGLE_CLIENT_SECRET` - OAuth credentials

---

## Production Checklist

Before deploying to production, complete these items:

### Must Do
- [ ] **Enable HSTS** - Uncomment in next.config.mjs (requires HTTPS)
- [ ] **Set secure cookie options** - Add to NextAuth config:
  ```typescript
  cookies: {
    sessionToken: {
      name: `__Secure-next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: true, // HTTPS only
      },
    },
  },
  ```
- [ ] **Generate new NEXTAUTH_SECRET** - `openssl rand -base64 32`
- [ ] **Add CSP header** - Content Security Policy for script sources
- [ ] **Enable Supabase RLS** - Row-level security policies
- [ ] **Restrict Google OAuth** - Limit to @sophiesociety.com domain
- [ ] **Remove allowedDevOrigins** - Only needed for local dev

### Should Do
- [ ] **Add rate limiting** - Use Vercel's or implement with upstash/redis
- [ ] **Set up error monitoring** - Sentry or similar (sanitize PII)
- [ ] **Enable audit logging** - Track admin actions
- [ ] **Review npm dependencies** - `npm audit fix`
- [ ] **Add request validation** - Zod schemas for API inputs

### Nice to Have
- [ ] **Add 2FA option** - For admin users
- [ ] **Session timeout** - Auto-logout after inactivity
- [ ] **IP allowlisting** - Restrict admin access by IP

---

## API Route Protection

All API routes use the `requireAuth()` helper from `@/lib/auth/api-auth`:

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

## Sensitive Files

These files contain secrets and must NEVER be committed:

| File | Contains |
|------|----------|
| `.env.local` | All environment secrets |
| `.env*.local` | Any local env overrides |
| `*.pem` | SSL/TLS certificates |

Verify with: `git status` before committing.

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

## Last Security Audit

**Date**: 2025-01-24
**Scope**: Authentication, API routes, headers, secrets
**Status**: Development environment secured
**Next Review**: Before production deployment
