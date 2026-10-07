# Mappings Module

Pass 08 implements manual evidence-to-control/evidence-requirement mappings.

Locked behavior:

- Manual mappings are created as `PENDING_REVIEW`.
- A mapping does not count toward readiness until it is `APPROVED` by an authorized human reviewer.
- Mapping approval is separate from evidence approval.
- Duplicate approved mappings for the same `evidence_version_id + requirement_id` are blocked by a partial unique index.
- AI mapping suggestions remain future scope and may only create `SUGGESTED` records later.
