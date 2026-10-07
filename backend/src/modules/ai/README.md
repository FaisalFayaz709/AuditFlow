# AI Module — Pass 15

Pass 15 adds the first AI integration while preserving the locked product rules:

- AI is optional and company-controlled.
- AI is advisory only.
- AI returns structured JSON that is validated before persistence.
- AI may create `SUGGESTED` mappings only.
- AI never approves evidence, mappings, control applicability, readiness, legal compliance, or certification.
- Extracted evidence text is labeled as untrusted document content.
- Provider, model, prompt version, input hash, structured output, status, and timestamps are persisted as provenance.

The implementation uses a local deterministic mock provider. Real providers remain behind the `AiProvider` interface and must pass the same contract tests before use.
