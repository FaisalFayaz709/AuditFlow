# Auditor Access Module

Pass 17 implements time-bounded AuditorAccessGrant records for selected framework enrollments, company controls, approved evidence items/versions, and completed reports.

Auditors remain read-only. A tenant membership with role `AUDITOR` is not sufficient to see evidence or reports; an active, unrevoked, non-expired grant must cover the requested scope.
