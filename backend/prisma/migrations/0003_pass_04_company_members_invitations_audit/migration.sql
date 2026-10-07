-- Pass 04: Company member administration, invitation lifecycle, and audit-log reads.

CREATE TYPE "invitation_status" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

CREATE TABLE "company_invitations" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" "membership_role" NOT NULL,
  "token_hash" TEXT NOT NULL,
  "status" "invitation_status" NOT NULL DEFAULT 'PENDING',
  "invited_by_user_id" TEXT NOT NULL,
  "accepted_by_user_id" TEXT,
  "revoked_by_user_id" TEXT,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "accepted_at" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "company_invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "company_invitations_token_hash_key" ON "company_invitations"("token_hash");
CREATE INDEX "company_invitations_company_id_email_status_idx" ON "company_invitations"("company_id", "email", "status");
CREATE INDEX "company_invitations_company_id_status_expires_at_idx" ON "company_invitations"("company_id", "status", "expires_at");
CREATE INDEX "company_invitations_expires_at_status_idx" ON "company_invitations"("expires_at", "status");

ALTER TABLE "company_invitations" ADD CONSTRAINT "company_invitations_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "company_invitations" ADD CONSTRAINT "company_invitations_invited_by_user_id_fkey"
  FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "company_invitations" ADD CONSTRAINT "company_invitations_accepted_by_user_id_fkey"
  FOREIGN KEY ("accepted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "company_invitations" ADD CONSTRAINT "company_invitations_revoked_by_user_id_fkey"
  FOREIGN KEY ("revoked_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
