-- Pass 18 - Retention, Deletion, and Legal Hold Baseline
-- Permanent purge is policy-controlled and keeps audit/accountability records durable.

CREATE TYPE "deletion_request_status" AS ENUM ('REQUESTED', 'APPROVED', 'SCHEDULED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

CREATE TABLE "deletion_requests" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "requested_by_user_id" TEXT NOT NULL,
  "approved_by_user_id" TEXT,
  "cancelled_by_user_id" TEXT,
  "status" "deletion_request_status" NOT NULL DEFAULT 'REQUESTED',
  "execute_after" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "failure_code" TEXT,
  "failure_message" TEXT,
  "backup_limitation_acknowledged" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "deletion_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "legal_holds" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "entity_type" TEXT,
  "entity_id" TEXT,
  "reason" TEXT NOT NULL,
  "placed_by_user_id" TEXT NOT NULL,
  "released_by_user_id" TEXT,
  "released_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "legal_holds_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "deletion_requests" ADD CONSTRAINT "deletion_requests_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "deletion_requests" ADD CONSTRAINT "deletion_requests_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "deletion_requests" ADD CONSTRAINT "deletion_requests_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "deletion_requests" ADD CONSTRAINT "deletion_requests_cancelled_by_user_id_fkey" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "legal_holds" ADD CONSTRAINT "legal_holds_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "legal_holds" ADD CONSTRAINT "legal_holds_placed_by_user_id_fkey" FOREIGN KEY ("placed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "legal_holds" ADD CONSTRAINT "legal_holds_released_by_user_id_fkey" FOREIGN KEY ("released_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "deletion_requests_company_status_execute_idx" ON "deletion_requests"("company_id", "status", "execute_after");
CREATE INDEX "deletion_requests_company_entity_status_idx" ON "deletion_requests"("company_id", "entity_type", "entity_id", "status");
CREATE INDEX "deletion_requests_requested_by_idx" ON "deletion_requests"("requested_by_user_id", "created_at" DESC);
CREATE INDEX "legal_holds_company_entity_active_idx" ON "legal_holds"("company_id", "entity_type", "entity_id", "released_at");
CREATE INDEX "legal_holds_placed_by_idx" ON "legal_holds"("placed_by_user_id", "created_at" DESC);
CREATE UNIQUE INDEX "deletion_requests_one_open_per_entity_idx" ON "deletion_requests"("company_id", "entity_type", "entity_id") WHERE "status" IN ('REQUESTED', 'APPROVED', 'SCHEDULED', 'RUNNING');
