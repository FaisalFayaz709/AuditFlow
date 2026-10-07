-- Pass 06: Secure evidence upload, staged object finalization, immutable evidence versions.
CREATE TYPE "evidence_sensitivity_level" AS ENUM ('INTERNAL', 'CONFIDENTIAL', 'RESTRICTED');
CREATE TYPE "evidence_source" AS ENUM ('MANUAL_UPLOAD', 'TASK_SUBMISSION', 'INTEGRATION');
CREATE TYPE "evidence_version_status" AS ENUM (
  'UPLOADED', 'QUARANTINED', 'SECURITY_REJECTED', 'PROCESSING', 'PROCESSING_FAILED',
  'NEEDS_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED', 'SUPERSEDED', 'ARCHIVED'
);
CREATE TYPE "security_scan_status" AS ENUM ('NOT_REQUIRED', 'PENDING', 'CLEAN', 'MALICIOUS', 'FAILED');
CREATE TYPE "upload_intent_status" AS ENUM ('PENDING', 'CREATED', 'UPLOADED', 'VALIDATING', 'FINALIZING', 'FINALIZED', 'FAILED', 'EXPIRED');

CREATE TABLE "evidence_items" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "sensitivity_level" "evidence_sensitivity_level" NOT NULL DEFAULT 'INTERNAL',
  "latest_version_id" TEXT,
  "current_approved_version_id" TEXT,
  "created_by_user_id" TEXT NOT NULL,
  "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "evidence_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "evidence_versions" (
  "id" TEXT NOT NULL,
  "evidence_item_id" TEXT NOT NULL,
  "version_no" INTEGER NOT NULL,
  "storage_key" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "file_size" INTEGER NOT NULL,
  "sha256_checksum" TEXT NOT NULL,
  "extracted_text" TEXT,
  "status" "evidence_version_status" NOT NULL DEFAULT 'UPLOADED',
  "security_scan_status" "security_scan_status" NOT NULL DEFAULT 'PENDING',
  "security_scan_completed_at" TIMESTAMP(3),
  "quarantine_reason" TEXT,
  "object_finalized_at" TIMESTAMP(3),
  "storage_reconciliation_required" BOOLEAN NOT NULL DEFAULT false,
  "effective_from" TIMESTAMP(3),
  "effective_until" TIMESTAMP(3),
  "expiry_date" TIMESTAMP(3),
  "uploaded_by_user_id" TEXT NOT NULL,
  "source" "evidence_source" NOT NULL DEFAULT 'MANUAL_UPLOAD',
  "supersedes_version_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "evidence_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "upload_intents" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "evidence_item_id" TEXT,
  "idempotency_key" TEXT,
  "temporary_storage_key" TEXT NOT NULL,
  "final_storage_key" TEXT NOT NULL,
  "original_file_name" TEXT NOT NULL,
  "mime_type" TEXT,
  "expected_sha256" TEXT,
  "status" "upload_intent_status" NOT NULL DEFAULT 'PENDING',
  "expires_at" TIMESTAMP(3) NOT NULL,
  "finalized_at" TIMESTAMP(3),
  "failure_code" TEXT,
  "created_by_user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "upload_intents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "evidence_versions_storage_key_key" ON "evidence_versions"("storage_key");
CREATE UNIQUE INDEX "evidence_versions_evidence_item_id_version_no_key" ON "evidence_versions"("evidence_item_id", "version_no");
CREATE UNIQUE INDEX "upload_intents_company_id_idempotency_key_key" ON "upload_intents"("company_id", "idempotency_key");
CREATE INDEX "evidence_items_company_id_archived_at_created_at_idx" ON "evidence_items"("company_id", "archived_at", "created_at" DESC);
CREATE INDEX "evidence_items_latest_version_id_idx" ON "evidence_items"("latest_version_id");
CREATE INDEX "evidence_items_current_approved_version_id_idx" ON "evidence_items"("current_approved_version_id");
CREATE INDEX "evidence_versions_evidence_item_id_version_no_idx" ON "evidence_versions"("evidence_item_id", "version_no" DESC);
CREATE INDEX "evidence_versions_status_expiry_date_idx" ON "evidence_versions"("status", "expiry_date");
CREATE INDEX "evidence_versions_sha256_checksum_idx" ON "evidence_versions"("sha256_checksum");
CREATE INDEX "evidence_versions_uploaded_by_user_id_idx" ON "evidence_versions"("uploaded_by_user_id");
CREATE INDEX "upload_intents_company_id_status_expires_at_idx" ON "upload_intents"("company_id", "status", "expires_at");
CREATE INDEX "upload_intents_created_by_user_id_created_at_idx" ON "upload_intents"("created_by_user_id", "created_at" DESC);

ALTER TABLE "evidence_items" ADD CONSTRAINT "evidence_items_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "evidence_items" ADD CONSTRAINT "evidence_items_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "evidence_items" ADD CONSTRAINT "evidence_items_latest_version_id_fkey" FOREIGN KEY ("latest_version_id") REFERENCES "evidence_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "evidence_items" ADD CONSTRAINT "evidence_items_current_approved_version_id_fkey" FOREIGN KEY ("current_approved_version_id") REFERENCES "evidence_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "evidence_versions" ADD CONSTRAINT "evidence_versions_evidence_item_id_fkey" FOREIGN KEY ("evidence_item_id") REFERENCES "evidence_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "evidence_versions" ADD CONSTRAINT "evidence_versions_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "evidence_versions" ADD CONSTRAINT "evidence_versions_supersedes_version_id_fkey" FOREIGN KEY ("supersedes_version_id") REFERENCES "evidence_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "upload_intents" ADD CONSTRAINT "upload_intents_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "upload_intents" ADD CONSTRAINT "upload_intents_evidence_item_id_fkey" FOREIGN KEY ("evidence_item_id") REFERENCES "evidence_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "upload_intents" ADD CONSTRAINT "upload_intents_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
