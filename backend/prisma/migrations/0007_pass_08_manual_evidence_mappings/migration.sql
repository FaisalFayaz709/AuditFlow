-- Pass 08: Manual evidence-to-control/requirement mappings.
-- This pass creates manual mappings as PENDING_REVIEW and requires human approval before readiness can count them.
CREATE TYPE "mapping_source" AS ENUM ('AI_SUGGESTED', 'MANUAL');
CREATE TYPE "mapping_status" AS ENUM ('SUGGESTED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED');

CREATE TABLE "evidence_control_mappings" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "evidence_version_id" TEXT NOT NULL,
  "control_id" TEXT NOT NULL,
  "requirement_id" TEXT,
  "source" "mapping_source" NOT NULL DEFAULT 'MANUAL',
  "status" "mapping_status" NOT NULL DEFAULT 'PENDING_REVIEW',
  "ai_confidence" DECIMAL(5,4),
  "reason" TEXT,
  "rejection_reason" TEXT,
  "mapped_by_user_id" TEXT,
  "reviewed_by_user_id" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "evidence_control_mappings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "evidence_control_mappings_company_id_control_id_status_idx" ON "evidence_control_mappings"("company_id", "control_id", "status");
CREATE INDEX "evidence_control_mappings_requirement_id_status_idx" ON "evidence_control_mappings"("requirement_id", "status");
CREATE INDEX "evidence_control_mappings_evidence_version_id_status_idx" ON "evidence_control_mappings"("evidence_version_id", "status");
CREATE INDEX "evidence_control_mappings_mapped_by_user_id_created_at_idx" ON "evidence_control_mappings"("mapped_by_user_id", "created_at" DESC);
CREATE INDEX "evidence_control_mappings_reviewed_by_user_id_reviewed_at_idx" ON "evidence_control_mappings"("reviewed_by_user_id", "reviewed_at");

-- Canonical v2.1 guard: duplicate active approved mappings for the same evidence version + requirement are prohibited.
CREATE UNIQUE INDEX "evidence_control_mappings_approved_version_requirement_uidx"
  ON "evidence_control_mappings"("evidence_version_id", "requirement_id")
  WHERE "status" = 'APPROVED' AND "requirement_id" IS NOT NULL;

ALTER TABLE "evidence_control_mappings" ADD CONSTRAINT "evidence_control_mappings_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "evidence_control_mappings" ADD CONSTRAINT "evidence_control_mappings_evidence_version_id_fkey"
  FOREIGN KEY ("evidence_version_id") REFERENCES "evidence_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "evidence_control_mappings" ADD CONSTRAINT "evidence_control_mappings_control_id_fkey"
  FOREIGN KEY ("control_id") REFERENCES "controls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "evidence_control_mappings" ADD CONSTRAINT "evidence_control_mappings_requirement_id_fkey"
  FOREIGN KEY ("requirement_id") REFERENCES "evidence_requirements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "evidence_control_mappings" ADD CONSTRAINT "evidence_control_mappings_mapped_by_user_id_fkey"
  FOREIGN KEY ("mapped_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "evidence_control_mappings" ADD CONSTRAINT "evidence_control_mappings_reviewed_by_user_id_fkey"
  FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
