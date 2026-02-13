# Agent Workflow (Sophie Hub v2)

## Branch Policy

- Default branch for all day-to-day work is `staging`.
- Pushes, PRs, and merges should target `staging` unless explicitly instructed otherwise.
- Treat `main` as release-only.

## Deploy Policy

- Staging validation happens from `staging` in Vercel.
- Only promote to `main` after staging validation is complete.

## Safety Checks Before Push

Run in this repository before pushing:

```bash
npm run build
```
