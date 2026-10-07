# frameworks module

Pass 05 implements published framework-template browsing and company framework enrollment.

Locked rules:

- Framework versions are immutable after publication; editing must create a new version in a later admin tool.
- A company may have multiple active framework families, but only one active enrollment per company plus framework family.
- Upgrade/reconciliation is intentionally not implemented here; duplicate active same-family enrollment returns `409`.
- Enrollment creates `CompanyControl` records from template controls.
