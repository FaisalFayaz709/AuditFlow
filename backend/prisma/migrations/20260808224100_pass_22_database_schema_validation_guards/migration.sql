-- Pass 22: Database schema validation guards.
-- This migration intentionally does not introduce a new product feature.
-- It makes v2.1 critical indexes explicit and recoverable if a previous branch
-- generated the schema without the partial-index SQL that Prisma cannot model.

CREATE UNIQUE INDEX IF NOT EXISTS "company_frameworks_one_active_per_company_family_idx"
  ON "company_frameworks"("company_id", "framework_id")
  WHERE "status" = 'ACTIVE';

CREATE UNIQUE INDEX IF NOT EXISTS "evidence_control_mappings_approved_version_requirement_uidx"
  ON "evidence_control_mappings"("evidence_version_id", "requirement_id")
  WHERE "status" = 'APPROVED' AND "requirement_id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "auditor_access_grants_one_active_scope_per_auditor_idx"
  ON "auditor_access_grants"("company_id", "auditor_member_id", "scope_type", "scope_id")
  WHERE "revoked_at" IS NULL;

CREATE INDEX IF NOT EXISTS "evidence_versions_status_expiry_date_idx"
  ON "evidence_versions"("status", "expiry_date");

CREATE INDEX IF NOT EXISTS "tasks_company_id_status_due_date_idx"
  ON "tasks"("company_id", "status", "due_date");

CREATE INDEX IF NOT EXISTS "audit_logs_company_id_created_at_idx"
  ON "audit_logs"("company_id", "created_at" DESC);

COMMENT ON INDEX "company_frameworks_one_active_per_company_family_idx" IS
  'AuditFlow v2.1: only one ACTIVE enrollment per company plus framework family.';

COMMENT ON INDEX "evidence_control_mappings_approved_version_requirement_uidx" IS
  'AuditFlow v2.1: duplicate approved mapping for the same evidence version plus requirement is forbidden.';

COMMENT ON INDEX "auditor_access_grants_one_active_scope_per_auditor_idx" IS
  'AuditFlow v2.1: one non-revoked auditor grant per company/auditor/scope.';
