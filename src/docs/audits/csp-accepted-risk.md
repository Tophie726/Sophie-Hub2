# CSP `unsafe-inline` — Accepted Risk Documentation

**Status:** Accepted Risk
**Created:** 2026-02-08
**Finding:** P2 — Production CSP permits `unsafe-inline` scripts
**File:** `next.config.mjs:39-41`

---

## Current CSP (Production)

```
script-src 'self' 'unsafe-inline' https://us.i.posthog.com https://us-assets.i.posthog.com
```

---

## Why `unsafe-inline` Is Present

Next.js App Router (v14) injects inline scripts for:
- Hydration bootstrapping
- Route prefetching metadata
- Client component initialization

Removing `unsafe-inline` without a nonce/hash strategy breaks these built-in behaviors.

---

## Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Threat:** XSS via inline script injection | Mitigated by other controls |
| **Auth gate:** All routes behind Google OAuth | Yes — no unauthenticated access |
| **User base:** Internal staff only (~120 users) | Small, trusted audience |
| **Input sanitization:** React auto-escapes JSX | Yes — default XSS protection |
| **Content injection surface:** Admin-only data entry | Minimal user-generated content |

**Residual risk:** Low. An attacker who bypasses auth and finds an injection point could execute inline JS. This is the same residual risk as most Next.js applications in production.

---

## Why Not Fix Now

| Approach | Effort | Feasibility |
|----------|--------|-------------|
| Nonce-based CSP | High | Requires custom Next.js server, middleware nonce injection, all script tags updated |
| Hash-based CSP | High | Next.js generates different inline scripts per build, hashes break on deploy |
| Strict CSP without inline | Breaking | Next.js App Router cannot function without inline scripts |

The cost/benefit ratio does not justify the effort for an internal app behind auth.

---

## Mitigations In Place

1. Google OAuth authentication on all routes
2. RBAC (admin, pod_leader, staff, partner roles)
3. React's built-in XSS protection (JSX auto-escaping)
4. `frame-ancestors 'none'` prevents clickjacking
5. `Strict-Transport-Security` on Vercel (HSTS)
6. Input validation via Zod schemas on all API routes
7. PostgREST search input escaping (Fix 1 — security sweep)

---

## Review Schedule

Re-evaluate when:
- Next.js adds built-in nonce support for App Router
- The application becomes externally accessible
- A security incident involves inline script injection
