-- Pass 12: Basic JSON/CSV reports and exports.
-- Reports are versioned readiness/evidence-coverage artifacts, not certification or legal compliance claims.

CREATE TYPE "report_type" AS ENUM ('AUDIT_READINESS', 'MISSING_EVIDENCE', 'CONTROL_COVERAGE', 'EVIDENCE_INVENTORY');
CREATE TYPE "report_status" AS ENUM ('QUEUED', 'GENERATING', 'COMPLETED', 'FAILED', 'EXPIRED');
CREATE TYPE "report_format" AS ENUM ('JSON', 'CSV');

CREATE TABLE "reports" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "generated_by_user_id" TEXT NOT NULL,
  "type" "report_type" NOT NULL,
  "format" "report_format" NOT NULL DEFAULT 'JSON',
  "idempotency_key" TEXT,
  "schema_version" TEXT NOT NULL DEFAULT 'v1',
  "parameters_json" JSONB NOT NULL DEFAULT '{}',
  "framework_enrollment_id" TEXT,
  "framework_version_id" TEXT,
  "calculated_at" TIMESTAMP(3),
  "status" "report_status" NOT NULL DEFAULT 'QUEUED',
  "storage_key" TEXT,
  "content_json" JSONB,
  "content_text" TEXT,
  "content_type" TEXT,
  "file_name" TEXT,
  "error_code" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3),
  CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "reports_company_id_created_at_idx" ON "reports"("company_id", "created_at" DESC);
CREATE INDEX "reports_company_id_status_created_at_idx" ON "reports"("company_id", "status", "created_at" DESC);
CREATE UNIQUE INDEX "reports_company_id_generated_by_user_id_idempotency_key_key" ON "reports"("company_id", "generated_by_user_id", "idempotency_key");
CREATE INDEX "reports_company_id_type_created_at_idx" ON "reports"("company_id", "type", "created_at" DESC);

ALTER TABLE "reports" ADD CONSTRAINT "reports_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reports" ADD CONSTRAINT "reports_generated_by_user_id_fkey"
  FOREIGN KEY ("generated_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
