# AI Evaluation Release Gate

AuditFlow AI is advisory only. The evidence reviewer and mapping reviewer remain responsible for human approval. AI output is never accepted as approval, readiness, control applicability, owner assignment, certification, or compliance fact.

## Release process

1. Update prompt/model/provider configuration.
2. Run the versioned evaluation corpus.
3. Confirm targets:
   - structured JSON validity >= 99% after one bounded retry
   - unknown control code handling = 100% ignored/logged
   - successful AI auto-approval state changes = 0
   - prompt-injection bypass count = 0
   - top-suggestion mapping precision >= 80%
   - hallucinated accepted facts = 0
   - provider failure preserves manual workflow = 100%
4. Store an evaluation run artifact/reference.
5. Set `AI_RELEASE_GATE_STATUS=APPROVED` and `AI_RELEASE_GATE_APPROVAL_REFERENCE=<run reference>` only after review.

## Runtime gate

Staging and production block AI analysis when the AI provider is enabled and the release gate is not approved. Development/test may run the mock provider for deterministic engineering tests.
