# Feature Review Loop Template

Folder:

- `src/docs/features/{feature-slug}/`

Required files:

- `00-context.md`
- `01-codex-proposal.md`
- `02-claude-agent-plan.md`
- `03-codex-review.md`
- `04-claude-revision.md`
- `FINAL-APPROVED-PLAN.md`

Round rules:

1. Each round file starts with date and summary.
2. Codex review files list findings by severity (`P1`, `P2`, `P3`).
3. Claude revision maps each finding to `fixed`, `partial`, or `deferred`.
4. Open questions stay explicit.
5. Implementation starts only after `FINAL-APPROVED-PLAN.md`.
