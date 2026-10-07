# Production Gate — Performance and Load Test Results

## Gate status

Status: `PENDING_HUMAN_EVIDENCE`

## Required performance evidence

This record must include a representative load test for the agreed dataset and traffic model.


The v2.1 initial production target is typical list/detail API p95 <= 500ms for an agreed representative dataset.

| Scenario | Dataset | Target | Measured p95 | Evidence reference | Status |
|---|---|---:|---:|---|---|
| Login/current user | TODO | <= 500ms | TODO | TODO | PENDING |
| Dashboard/readiness | TODO | <= 500ms | TODO | TODO | PENDING |
| Evidence list/detail | TODO | <= 500ms | TODO | TODO | PENDING |
| Controls list/detail | TODO | <= 500ms | TODO | TODO | PENDING |
| Reports metadata list | TODO | <= 500ms | TODO | TODO | PENDING |
| Auditor selected view | TODO | <= 500ms | TODO | TODO | PENDING |

## Required load-test record

- Test tool:
- Environment:
- Dataset size:
- Concurrent users:
- Duration:
- Build/release ID:
- Commit SHA:
- Result artifact:

## Acceptance

If a scenario misses target, document whether the release is blocked, optimized, or narrowed before customer evidence is allowed.
