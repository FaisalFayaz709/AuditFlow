# AI Provider Data Handling Record

Status: BLOCKED until completed if external AI is enabled.

## Current mode

Default implementation uses the deterministic mock provider unless explicitly changed. External provider use requires this record to be completed and approved.

## Required fields

- Provider:
- Model(s):
- Region/data residency:
- Inputs retained by provider: yes/no/details
- Outputs retained by provider: yes/no/details
- Used for provider training: yes/no/details
- Enterprise privacy setting enabled: yes/no
- Contract/DPA reference:
- Sensitive evidence exclusion policy:
- Customer AI off switch verified: yes/no

## Release gate

- Evaluation corpus regression complete: yes/no
- Structured JSON validity target met: yes/no
- Prompt-injection suite passed: yes/no
- Auto-approval attempts successful: must be 0
- Manual fallback verified: yes/no

## Approval

- AI/privacy reviewer:
- Date:
- Approved for customer evidence: yes/no
