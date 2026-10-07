-- Pass 17 - Auditor Access Grants
CREATE TYPE "auditor_scope_type" AS ENUM ('FRAMEWORK', 'CONTROL', 'EVIDENCE_ITEM', 'EVIDENCE_VERSION', 'REPORT');

CREATE TABLE "auditor_access_grants" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "auditor_member_id" TEXT NOT NULL,
  "scope_type" "auditor_scope_type" NOT NULL,
  "scope_id" TEXT NOT NULL,
  "starts_at" TIMESTAMP(3) NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "download_allowed" BOOLEAN NOT NULL DEFAULT true,
  "granted_by_user_id" TEXT NOT NULL,
  "revoked_by_user_id" TEXT,
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "auditor_access_grants_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "auditor_access_grants" ADD CONSTRAINT "auditor_access_grants_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "auditor_access_grants" ADD CONSTRAINT "auditor_access_grants_auditor_member_id_fkey" FOREIGN KEY ("auditor_member_id") REFERENCES "company_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "auditor_access_grants" ADD CONSTRAINT "auditor_access_grants_granted_by_user_id_fkey" FOREIGN KEY ("granted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "auditor_access_grants" ADD CONSTRAINT "auditor_access_grants_revoked_by_user_id_fkey" FOREIGN KEY ("revoked_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "auditor_access_grants_company_auditor_active_idx" ON "auditor_access_grants"("company_id", "auditor_member_id", "revoked_at", "expires_at");
CREATE INDEX "auditor_access_grants_scope_active_idx" ON "auditor_access_grants"("company_id", "scope_type", "scope_id", "revoked_at", "expires_at");
CREATE INDEX "auditor_access_grants_granted_by_idx" ON "auditor_access_grants"("granted_by_user_id", "created_at" DESC);
CREATE UNIQUE INDEX "auditor_access_grants_one_active_scope_per_auditor_idx" ON "auditor_access_grants"("company_id", "auditor_member_id", "scope_type", "scope_id") WHERE "revoked_at" IS NULL;
