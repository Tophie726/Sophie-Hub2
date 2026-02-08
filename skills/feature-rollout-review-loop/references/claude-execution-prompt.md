Use `feature-rollout-review-loop` for this feature.

Inputs:
- Feature: {FEATURE_NAME}
- Goal: {GOAL}
- Scope constraints: {SCOPE}
- Risks to avoid: {RISKS}
- Release constraints: {TIMELINE}

Instructions:
1. Create/update `src/docs/features/{feature-slug}/` using the required file sequence.
2. Produce an agent team plan with wave dependencies and clear ownership.
3. Do not start coding until `FINAL-APPROVED-PLAN.md` exists.
4. During implementation, log file-level changes and validation evidence.
5. Produce a post-execution scorecard using `references/scorecard-rubric.md`.
6. Separate measurable facts from assumptions.

Required output:
- `src/docs/features/{feature-slug}/FINAL-APPROVED-PLAN.md`
- implementation summary with tests and residual risk notes
