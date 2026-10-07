-- Pass 03 canonical browser-auth migration.
-- v2.1 requires opaque server-side sessions in an HttpOnly cookie, hashed tokens only,
-- independent CSRF validation, session revocation, and password-reset session revocation.

ALTER TABLE "sessions"
  ADD COLUMN "idle_expires_at" TIMESTAMP(3),
  ADD COLUMN "absolute_expires_at" TIMESTAMP(3),
  ADD COLUMN "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "csrf_token_hash" TEXT,
  ADD COLUMN "csrf_token_issued_at" TIMESTAMP(3),
  ADD COLUMN "revoked_reason" TEXT;

UPDATE "sessions"
SET
  "idle_expires_at" = "expires_at",
  "absolute_expires_at" = "expires_at"
WHERE "idle_expires_at" IS NULL OR "absolute_expires_at" IS NULL;

ALTER TABLE "sessions"
  ALTER COLUMN "idle_expires_at" SET NOT NULL,
  ALTER COLUMN "absolute_expires_at" SET NOT NULL;

CREATE INDEX "sessions_user_id_revoked_at_idle_expires_at_idx"
  ON "sessions"("user_id", "revoked_at", "idle_expires_at");

CREATE INDEX "sessions_user_id_revoked_at_absolute_expires_at_idx"
  ON "sessions"("user_id", "revoked_at", "absolute_expires_at");

CREATE TABLE "password_reset_tokens" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key"
  ON "password_reset_tokens"("token_hash");

CREATE INDEX "password_reset_tokens_user_id_expires_at_used_at_idx"
  ON "password_reset_tokens"("user_id", "expires_at", "used_at");

ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "email_verification_tokens" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "email_verification_tokens_token_hash_key"
  ON "email_verification_tokens"("token_hash");

CREATE INDEX "email_verification_tokens_user_id_expires_at_used_at_idx"
  ON "email_verification_tokens"("user_id", "expires_at", "used_at");

ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
