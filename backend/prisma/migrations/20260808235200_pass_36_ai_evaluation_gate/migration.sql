-- Pass 36: AI evaluation and production release gate persistence.
-- Prisma artifacts: enum AiEvaluationRunStatus, model AiEvaluationRun.
-- AI remains optional, advisory, structured, provenance-tracked, and human-in-the-loop.

CREATE TYPE "ai_evaluation_run_status" AS ENUM ('PASSED', 'FAILED');

CREATE TABLE "ai_evaluation_runs" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "model_name" TEXT NOT NULL,
  "prompt_version" TEXT NOT NULL,
  "schema_version" TEXT NOT NULL DEFAULT 'pass-36-ai-evaluation-baseline-v1',
  "corpus_version" TEXT NOT NULL,
  "status" "ai_evaluation_run_status" NOT NULL,
  "metrics_json" JSONB NOT NULL DEFAULT '{}',
  "approval_reference" TEXT,
  "created_by_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_evaluation_runs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ai_evaluation_runs"
  ADD CONSTRAINT "ai_evaluation_runs_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ai_evaluation_runs_provider_model_name_prompt_version_created_at_idx"
  ON "ai_evaluation_runs"("provider", "model_name", "prompt_version", "created_at" DESC);

CREATE INDEX "ai_evaluation_runs_status_created_at_idx"
  ON "ai_evaluation_runs"("status", "created_at" DESC);
