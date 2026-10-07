-- Pass 10: Tasks using COMPLETED semantics, comments, and overdue dashboard metrics.
-- v2.1 supersedes task APPROVED wording with COMPLETED; no task transition approves evidence or mappings.

CREATE TYPE "task_status" AS ENUM ('TODO', 'IN_PROGRESS', 'SUBMITTED', 'COMPLETED', 'REJECTED', 'CANCELLED');
CREATE TYPE "task_priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "comment_entity_type" AS ENUM ('TASK', 'COMPANY_CONTROL', 'EVIDENCE_ITEM', 'EVIDENCE_VERSION');
CREATE TYPE "comment_visibility" AS ENUM ('INTERNAL', 'AUDITOR_VISIBLE');

CREATE TABLE "tasks" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "company_control_id" TEXT NOT NULL,
  "requirement_id" TEXT,
  "assigned_to_user_id" TEXT,
  "created_by_user_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "priority" "task_priority" NOT NULL DEFAULT 'MEDIUM',
  "status" "task_status" NOT NULL DEFAULT 'TODO',
  "due_date" TIMESTAMP(3),
  "cancelled_reason" TEXT,
  "administrative_only" BOOLEAN NOT NULL DEFAULT false,
  "completed_at" TIMESTAMP(3),
  "rejected_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "task_evidence" (
  "id" TEXT NOT NULL,
  "task_id" TEXT NOT NULL,
  "evidence_version_id" TEXT NOT NULL,
  "submitted_by_user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "task_evidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "comments" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "entity_type" "comment_entity_type" NOT NULL,
  "entity_id" TEXT NOT NULL,
  "visibility" "comment_visibility" NOT NULL DEFAULT 'INTERNAL',
  "body" TEXT NOT NULL,
  "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "task_evidence_task_id_evidence_version_id_key" ON "task_evidence"("task_id", "evidence_version_id");
CREATE INDEX "tasks_company_id_status_due_date_idx" ON "tasks"("company_id", "status", "due_date");
CREATE INDEX "tasks_assigned_to_user_id_status_due_date_idx" ON "tasks"("assigned_to_user_id", "status", "due_date");
CREATE INDEX "tasks_company_control_id_status_idx" ON "tasks"("company_control_id", "status");
CREATE INDEX "tasks_requirement_id_status_idx" ON "tasks"("requirement_id", "status");
CREATE INDEX "task_evidence_evidence_version_id_idx" ON "task_evidence"("evidence_version_id");
CREATE INDEX "task_evidence_submitted_by_user_id_created_at_idx" ON "task_evidence"("submitted_by_user_id", "created_at" DESC);
CREATE INDEX "comments_company_id_entity_type_entity_id_archived_at_created_at_idx" ON "comments"("company_id", "entity_type", "entity_id", "archived_at", "created_at");
CREATE INDEX "comments_user_id_created_at_idx" ON "comments"("user_id", "created_at" DESC);

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_company_control_id_fkey" FOREIGN KEY ("company_control_id") REFERENCES "company_controls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "evidence_requirements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "task_evidence" ADD CONSTRAINT "task_evidence_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "task_evidence" ADD CONSTRAINT "task_evidence_evidence_version_id_fkey" FOREIGN KEY ("evidence_version_id") REFERENCES "evidence_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "task_evidence" ADD CONSTRAINT "task_evidence_submitted_by_user_id_fkey" FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "comments" ADD CONSTRAINT "comments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
