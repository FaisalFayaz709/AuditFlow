# ADR-008: AI Is Advisory and Human-in-the-Loop

Status: Accepted

## Decision

AI is optional, advisory, structured, provenance-tracked, and human-in-the-loop.

## AI May

- summarize evidence
- classify document type
- suggest controls/requirements
- flag missing information
- provide advisory confidence
- draft auditor-facing summaries for human review

## AI Must Never

- approve evidence
- approve mappings
- approve applicability
- set readiness
- claim certification
- claim legal compliance
- create controls
- invent missing evidence or facts
- follow document-embedded instructions
- override authorization

## Persistence

Every AI analysis stores:

- provider
- model name/version
- prompt version
- input hash
- structured result
- status
- timestamps
- error code when applicable
