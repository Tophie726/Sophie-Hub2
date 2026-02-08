---
name: bam-loop
description: Fast trigger skill for Sophie Hub feature work. Use when the user says "BAM" to start a closed Codex<->Claude loop: plan, agents, build, Codex review, revise, repeat until approved.
---

# BAM Loop

## Trigger

If the user says `BAM` (or asks for the closed-loop flow), run this skill.

## Purpose

This is the shortcut/orchestration skill for frequent feature delivery loops.

It does not replace detailed planning templates; it routes execution into the standard loop with minimal friction.

## Closed Loop

Run this sequence in order:

1. **Plan**
   - Create feature folder: `src/docs/features/{feature-slug}/`
   - Create/update:
     - `00-context.md`
     - `01-codex-proposal.md`
2. **Agent Team Plan**
   - Ask Claude to produce `02-claude-agent-plan.md` with wave dependencies and task ownership.
3. **Codex Review**
   - Codex writes `03-codex-review.md` with `P1/P2/P3` findings and precise fixes.
4. **Claude Revision**
   - Claude writes `04-claude-revision.md` and maps each finding to `fixed/partial/deferred`.
5. **Repeat**
   - Continue rounds (`05-*`, `06-*`) until no blocking findings remain.
6. **Approve**
   - Merge into `FINAL-APPROVED-PLAN.md`.
7. **Build + Review Cycle**
   - Execute in waves.
   - After each wave: build/test -> Codex review -> patch -> re-check.

## Score Rule

Never accept score jumps as facts unless evidence is attached.

Require baseline and post scores using:

- `skills/feature-rollout-review-loop/references/scorecard-rubric.md`

Each category must include evidence links and residual risks.

## Required Artifacts

- Feature loop files in `src/docs/features/{feature-slug}/`
- Evidence-backed scorecard in results doc
- Final paste-ready handoff message for the next actor (Codex or Claude)

## References

Use detailed templates and rubric from:

- `skills/feature-rollout-review-loop/SKILL.md`
- `skills/feature-rollout-review-loop/references/feature-plan-template.md`
- `skills/feature-rollout-review-loop/references/review-loop-template.md`
- `skills/feature-rollout-review-loop/references/claude-execution-prompt.md`
- `skills/feature-rollout-review-loop/references/scorecard-rubric.md`
