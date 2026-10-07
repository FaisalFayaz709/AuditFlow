# ADR-005: Canonical Readiness Calculation

Status: Accepted

## Decision

Readiness is a deterministic, explainable, risk-weighted percentage of satisfied required evidence requirements across eligible controls.

Eligible controls:

```txt
company_control.applicability = APPLICABLE
AND control.control_type = EVIDENCE_BASED
```

Formula:

```txt
coverage(c) = satisfied_count(c) / required_count(c)
risk_weight(c) = CRITICAL:4, HIGH:3, MEDIUM:2, LOW:1

overall readiness =
100 * SUM(coverage(c) * risk_weight(c)) / SUM(risk_weight(c))
```

## Satisfaction Rule

A required evidence requirement is satisfied only when at least one current valid evidence version exists with:

- evidence version approved
- mapping approved
- evidence not expired
- evidence not superseded
- evidence not archived
- evidence security-cleared where required

## Edge Cases

- No eligible controls: `readinessPercent = null`, `readinessStatus = NOT_CALCULABLE`.
- Optional requirements do not reduce readiness.
- Multiple valid files for one requirement count once.
- AI confidence is never an input.
- Suggested mappings do not count.
