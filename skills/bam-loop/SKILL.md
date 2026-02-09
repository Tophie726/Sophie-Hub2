---
name: bam-loop
description: Shortcut trigger for Sophie Hub feature delivery. Use when the user says "BAM" to run the closed Codex<->Claude loop defined in feature-rollout-review-loop.
---

# BAM Loop

## Trigger

If the user says `BAM` (or asks for the closed-loop flow), run this skill.

## Purpose

This is a thin alias/orchestration skill for frequent feature delivery loops.

It does not define full process details itself.  
The single source of truth is:

- `skills/feature-rollout-review-loop/SKILL.md`

## What To Do On BAM

When triggered:

1. Resolve `{feature-slug}` and create:
   - `src/docs/features/{feature-slug}/`
2. Execute the full loop from `feature-rollout-review-loop`:
   - plan -> Claude agent plan -> Codex review -> Claude revision -> repeat
3. Do not implement until:
   - `FINAL-APPROVED-PLAN.md` exists.
4. During execution, enforce wave gates:
   - build/test -> smoke tests (happy + failure + security edge) -> Codex review -> patch -> next wave.

## Smoke Test Rule

Smoke tests are mandatory in BAM before sign-off.

- Include at least:
  - happy-path flow,
  - failure-path flow,
  - one abuse/security-edge check.
- Record evidence in markdown (commands, API responses, screenshots, or logs).
- Do not mark a wave complete without smoke evidence.

## Score Rule

Never accept score jumps as facts unless evidence is attached.

Require baseline and post scores using the core rubric:

- `skills/feature-rollout-review-loop/references/scorecard-rubric.md`

Each category must include evidence links and residual risks.

## References

Delegate all detailed process/templates to:

- `skills/feature-rollout-review-loop/SKILL.md`
- `skills/feature-rollout-review-loop/references/feature-plan-template.md`
- `skills/feature-rollout-review-loop/references/review-loop-template.md`
- `skills/feature-rollout-review-loop/references/claude-execution-prompt.md`
- `skills/feature-rollout-review-loop/references/scorecard-rubric.md`
