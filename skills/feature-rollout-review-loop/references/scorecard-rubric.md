# Feature Scorecard Rubric

Use this rubric for both baseline and post scores.  
Scores without evidence are estimates, not facts.

## Categories and Weights

- Security: 30%
- Scalability: 20%
- Performance: 20%
- Reliability: 20%
- Operability: 10%

Overall score:

`overall = sum(category_score * weight)`

## Scoring Rules (0-10 per category)

- 0-3: high unmanaged risk, no reliable controls
- 4-6: partial controls, notable gaps
- 7-8: solid controls, minor gaps
- 9-10: strong controls, evidence-backed, low residual risk

## Required Evidence Per Category

Security:
- authz/authn checks, injection defenses, secrets boundaries
- test evidence and/or exploit attempt logs

Scalability:
- batch strategy, queue/lock behavior, contention handling
- measured behavior under expected scale

Performance:
- before/after latency/size/runtime metrics
- regression thresholds or budgets

Reliability:
- failure handling, retries, idempotency, recovery flows
- known failure mode tests

Operability:
- runbooks/docs, alerting, dashboards, rollback clarity
- ownership for follow-ups

## Mandatory Scorecard Fields

For each category provide:

1. Baseline score
2. Post score
3. Delta
4. Evidence links (files/tests/logs)
5. Residual risk statement

Do not claim "10/10" unless residual risk is trivial and evidence is comprehensive.
