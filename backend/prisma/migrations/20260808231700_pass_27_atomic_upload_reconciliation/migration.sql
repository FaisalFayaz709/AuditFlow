-- Pass 27: Atomic upload finalization and storage reconciliation.
-- v2.1 requires upload intent -> temporary private object -> validation/security scan
-- -> DB transaction -> final immutable object -> reconciliation/cleanup on partial failure.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'storage_reconciliation_status') THEN
    CREATE TYPE "storage_reconciliation_status" AS ENUM ('NOT_REQUIRED', 'REQUIRED', 'RETRYING', 'RECONCILED', 'FAILED');
  END IF;
END $$;

ALTER TYPE "upload_intent_status" ADD VALUE IF NOT EXISTS 'CREATED';
ALTER TYPE "upload_intent_status" ADD VALUE IF NOT EXISTS 'UPLOADED';
ALTER TYPE "upload_intent_status" ADD VALUE IF NOT EXISTS 'VALIDATING';

ALTER TABLE "upload_intents"
  ALTER COLUMN "status" DROP DEFAULT;

UPDATE "upload_intents"
  SET "status" = 'CREATED'
  WHERE "status" = 'PENDING';

ALTER TABLE "upload_intents"
  ALTER COLUMN "status" SET DEFAULT 'CREATED';

ALTER TABLE "upload_intents"
  ADD COLUMN IF NOT EXISTS "uploaded_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "validating_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "finalizing_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "failed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "temp_deleted_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "evidence_version_id" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'upload_intents_evidence_version_id_fkey'
      AND table_name = 'upload_intents'
  ) THEN
    ALTER TABLE "upload_intents"
      ADD CONSTRAINT "upload_intents_evidence_version_id_fkey"
      FOREIGN KEY ("evidence_version_id") REFERENCES "evidence_versions"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "evidence_versions"
  ADD COLUMN IF NOT EXISTS "storage_reconciliation_status" "storage_reconciliation_status" NOT NULL DEFAULT 'NOT_REQUIRED',
  ADD COLUMN IF NOT EXISTS "storage_reconciliation_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "storage_reconciliation_last_error" TEXT;

UPDATE "evidence_versions"
  SET "storage_reconciliation_status" = CASE
    WHEN "storage_reconciliation_required" = TRUE THEN 'REQUIRED'::"storage_reconciliation_status"
    ELSE 'NOT_REQUIRED'::"storage_reconciliation_status"
  END;

CREATE INDEX IF NOT EXISTS "upload_intents_company_status_expiry_idx"
  ON "upload_intents"("company_id", "status", "expires_at");

CREATE INDEX IF NOT EXISTS "upload_intents_company_evidence_version_idx"
  ON "upload_intents"("company_id", "evidence_version_id");

CREATE INDEX IF NOT EXISTS "evidence_versions_storage_reconciliation_idx"
  ON "evidence_versions"("storage_reconciliation_required", "storage_reconciliation_status", "updated_at");

COMMENT ON COLUMN "upload_intents"."status" IS
  'AuditFlow v2.1/pass 27 state machine: CREATED -> UPLOADED -> VALIDATING -> FINALIZING -> FINALIZED, with FAILED/EXPIRED recovery.';

COMMENT ON COLUMN "evidence_versions"."storage_reconciliation_status" IS
  'AuditFlow v2.1/pass 27 storage/DB consistency recovery state.';
