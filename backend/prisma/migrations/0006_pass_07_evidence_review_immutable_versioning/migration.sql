-- Pass 07: Human evidence review, immutable approved versioning, and archive-first behavior.
CREATE TYPE "evidence_review_decision" AS ENUM ('APPROVED', 'REJECTED');

CREATE TABLE "evidence_reviews" (
  "id" TEXT NOT NULL,
  "evidence_version_id" TEXT NOT NULL,
  "reviewer_user_id" TEXT NOT NULL,
  "decision" "evidence_review_decision" NOT NULL,
  "reason" TEXT,
  "review_note" TEXT,
  "checklist_json" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "evidence_reviews_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "evidence_reviews_evidence_version_id_created_at_idx" ON "evidence_reviews"("evidence_version_id", "created_at" DESC);
CREATE INDEX "evidence_reviews_reviewer_user_id_created_at_idx" ON "evidence_reviews"("reviewer_user_id", "created_at" DESC);

ALTER TABLE "evidence_reviews" ADD CONSTRAINT "evidence_reviews_evidence_version_id_fkey"
  FOREIGN KEY ("evidence_version_id") REFERENCES "evidence_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "evidence_reviews" ADD CONSTRAINT "evidence_reviews_reviewer_user_id_fkey"
  FOREIGN KEY ("reviewer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
