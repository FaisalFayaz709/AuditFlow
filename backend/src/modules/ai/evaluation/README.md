# AI Evaluation and Release Gate

AuditFlow AI remains optional, advisory, structured, provenance-tracked, and human-in-the-loop.

This directory is the versioned evaluation harness for prompt/model changes. It intentionally treats document text as untrusted data and verifies that AI output cannot approve evidence, approve mappings, mark controls ready, change owners, calculate authoritative readiness, invent controls, accept hallucinated dates/owners/approvals, or bypass authorization.

## Pass 53 corpus coverage

The Pass 53 runtime gate requires the evaluation corpus to contain all of these evidence classes:

- policy;
- access review;
- log;
- screenshot/OCR-derived text;
- malformed file;
- irrelevant file;
- adversarial prompt injection.

## Required release rule

A new AI provider, model, prompt version, or extraction behavior is not releasable to staging/production until `run-ai-eval.ts` passes and the resulting evaluation run reference is placed in `AI_RELEASE_GATE_APPROVAL_REFERENCE` with `AI_RELEASE_GATE_STATUS=APPROVED`.

Manual evidence upload, review, mapping, task completion, readiness, and report generation must continue to work when AI is disabled or when a provider call fails.

## Run

```bash
pnpm --filter @auditflow/backend tsx src/modules/ai/evaluation/run-ai-eval.ts
```
