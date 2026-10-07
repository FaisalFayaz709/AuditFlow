-- Pass 05: Framework families/versions, controls, evidence requirements, company enrollments, and company controls.
-- Locked spec constraints:
-- - Published framework versions are immutable at service layer; edits require new versions.
-- - Only one ACTIVE enrollment per company + framework family.
-- - Informational controls are excluded from readiness and may have zero required requirements.
-- - Evidence-based controls must have at least one required EvidenceRequirement before publication.

CREATE TYPE "framework_version_status" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "company_framework_status" AS ENUM ('DRAFT_RECONCILIATION', 'ACTIVE', 'ENDED');
CREATE TYPE "control_risk_level" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');
CREATE TYPE "control_type" AS ENUM ('EVIDENCE_BASED', 'INFORMATIONAL');
CREATE TYPE "company_control_applicability" AS ENUM ('APPLICABLE', 'NOT_APPLICABLE');
CREATE TYPE "evidence_requirement_type" AS ENUM ('DOCUMENT', 'SCREENSHOT', 'REPORT', 'LOG', 'EXPORT', 'ATTESTATION', 'OTHER');

CREATE TABLE "frameworks" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "is_template" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "frameworks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "framework_versions" (
  "id" TEXT NOT NULL,
  "framework_id" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "status" "framework_version_status" NOT NULL DEFAULT 'DRAFT',
  "published_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "framework_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "control_categories" (
  "id" TEXT NOT NULL,
  "framework_version_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "control_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "controls" (
  "id" TEXT NOT NULL,
  "framework_version_id" TEXT NOT NULL,
  "category_id" TEXT,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "risk_level" "control_risk_level" NOT NULL,
  "control_type" "control_type" NOT NULL DEFAULT 'EVIDENCE_BASED',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "controls_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "evidence_requirements" (
  "id" TEXT NOT NULL,
  "control_id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "requirement_type" "evidence_requirement_type" NOT NULL DEFAULT 'DOCUMENT',
  "required" BOOLEAN NOT NULL DEFAULT true,
  "validity_days" INTEGER,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "evidence_requirements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "company_frameworks" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "framework_id" TEXT NOT NULL,
  "framework_version_id" TEXT NOT NULL,
  "status" "company_framework_status" NOT NULL DEFAULT 'ACTIVE',
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "target_audit_date" TIMESTAMP(3),
  "ended_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "company_frameworks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "company_controls" (
  "id" TEXT NOT NULL,
  "company_framework_id" TEXT NOT NULL,
  "control_id" TEXT NOT NULL,
  "applicability" "company_control_applicability" NOT NULL DEFAULT 'APPLICABLE',
  "not_applicable_reason" TEXT,
  "not_applicable_approved_by" TEXT,
  "owner_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "company_controls_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "frameworks_name_key" ON "frameworks"("name");
CREATE UNIQUE INDEX "framework_versions_framework_id_version_key" ON "framework_versions"("framework_id", "version");
CREATE INDEX "framework_versions_status_published_at_idx" ON "framework_versions"("status", "published_at");
CREATE UNIQUE INDEX "control_categories_framework_version_id_name_key" ON "control_categories"("framework_version_id", "name");
CREATE UNIQUE INDEX "control_categories_framework_version_id_sort_order_key" ON "control_categories"("framework_version_id", "sort_order");
CREATE UNIQUE INDEX "controls_framework_version_id_code_key" ON "controls"("framework_version_id", "code");
CREATE UNIQUE INDEX "controls_framework_version_id_sort_order_key" ON "controls"("framework_version_id", "sort_order");
CREATE INDEX "controls_framework_version_id_control_type_idx" ON "controls"("framework_version_id", "control_type");
CREATE INDEX "controls_framework_version_id_risk_level_idx" ON "controls"("framework_version_id", "risk_level");
CREATE UNIQUE INDEX "evidence_requirements_control_id_code_key" ON "evidence_requirements"("control_id", "code");
CREATE UNIQUE INDEX "evidence_requirements_control_id_sort_order_key" ON "evidence_requirements"("control_id", "sort_order");
CREATE INDEX "evidence_requirements_control_id_required_idx" ON "evidence_requirements"("control_id", "required");
CREATE INDEX "company_frameworks_company_id_status_idx" ON "company_frameworks"("company_id", "status");
CREATE INDEX "company_frameworks_company_id_framework_id_status_idx" ON "company_frameworks"("company_id", "framework_id", "status");
CREATE INDEX "company_frameworks_framework_version_id_idx" ON "company_frameworks"("framework_version_id");
CREATE UNIQUE INDEX "company_frameworks_one_active_per_company_family_idx" ON "company_frameworks"("company_id", "framework_id") WHERE "status" = 'ACTIVE';
CREATE UNIQUE INDEX "company_controls_company_framework_id_control_id_key" ON "company_controls"("company_framework_id", "control_id");
CREATE INDEX "company_controls_company_framework_id_applicability_idx" ON "company_controls"("company_framework_id", "applicability");
CREATE INDEX "company_controls_owner_user_id_idx" ON "company_controls"("owner_user_id");

ALTER TABLE "framework_versions" ADD CONSTRAINT "framework_versions_framework_id_fkey"
  FOREIGN KEY ("framework_id") REFERENCES "frameworks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "control_categories" ADD CONSTRAINT "control_categories_framework_version_id_fkey"
  FOREIGN KEY ("framework_version_id") REFERENCES "framework_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "controls" ADD CONSTRAINT "controls_framework_version_id_fkey"
  FOREIGN KEY ("framework_version_id") REFERENCES "framework_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "controls" ADD CONSTRAINT "controls_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "control_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "evidence_requirements" ADD CONSTRAINT "evidence_requirements_control_id_fkey"
  FOREIGN KEY ("control_id") REFERENCES "controls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "company_frameworks" ADD CONSTRAINT "company_frameworks_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "company_frameworks" ADD CONSTRAINT "company_frameworks_framework_id_fkey"
  FOREIGN KEY ("framework_id") REFERENCES "frameworks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "company_frameworks" ADD CONSTRAINT "company_frameworks_framework_version_id_fkey"
  FOREIGN KEY ("framework_version_id") REFERENCES "framework_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "company_controls" ADD CONSTRAINT "company_controls_company_framework_id_fkey"
  FOREIGN KEY ("company_framework_id") REFERENCES "company_frameworks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "company_controls" ADD CONSTRAINT "company_controls_control_id_fkey"
  FOREIGN KEY ("control_id") REFERENCES "controls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "company_controls" ADD CONSTRAINT "company_controls_owner_user_id_fkey"
  FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "company_controls" ADD CONSTRAINT "company_controls_not_applicable_approved_by_fkey"
  FOREIGN KEY ("not_applicable_approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Check constraints Prisma cannot model cleanly.
ALTER TABLE "evidence_requirements" ADD CONSTRAINT "evidence_requirements_validity_days_positive_chk"
  CHECK ("validity_days" IS NULL OR "validity_days" > 0);
ALTER TABLE "company_controls" ADD CONSTRAINT "company_controls_na_reason_chk"
  CHECK (
    ("applicability" = 'APPLICABLE' AND "not_applicable_reason" IS NULL AND "not_applicable_approved_by" IS NULL)
    OR
    ("applicability" = 'NOT_APPLICABLE' AND "not_applicable_reason" IS NOT NULL AND length(trim("not_applicable_reason")) > 0 AND "not_applicable_approved_by" IS NOT NULL)
  );
