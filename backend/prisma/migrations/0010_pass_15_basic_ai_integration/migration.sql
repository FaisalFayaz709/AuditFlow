-- Pass 15: Basic AI integration remains optional/advisory and human-in-the-loop.
CREATE TYPE "ai_analysis_status" AS ENUM ('REQUESTED', 'PROCESSING', 'COMPLETED', 'FAILED');

CREATE TABLE "ai_analyses" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "evidence_version_id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "model_name" TEXT NOT NULL,
  "prompt_version" TEXT NOT NULL,
  "schema_version" TEXT NOT NULL DEFAULT 'v1',
  "input_hash" TEXT NOT NULL,
  "status" "ai_analysis_status" NOT NULL DEFAULT 'REQUESTED',
  "document_type" TEXT,
  "structured_result_json" JSONB NOT NULL DEFAULT '{}',
  "summary" TEXT,
  "error_code" TEXT,
  "error_message" TEXT,
  "latency_ms" INTEGER,
  "token_usage_json" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),

  CONSTRAINT "ai_analyses_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_evidence_version_id_fkey"
  FOREIGN KEY ("evidence_version_id") REFERENCES "evidence_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "ai_analyses_company_id_created_at_idx" ON "ai_analyses"("company_id", "created_at" DESC);
CREATE INDEX "ai_analyses_evidence_version_id_created_at_idx" ON "ai_analyses"("evidence_version_id", "created_at" DESC);
CREATE INDEX "ai_analyses_status_created_at_idx" ON "ai_analyses"("status", "created_at");
