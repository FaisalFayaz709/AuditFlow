-- Pass 16: background jobs, notifications, and bounded delivery attempts.
-- BullMQ stores queue internals in Redis; PostgreSQL stores durable notification/delivery metadata only.

CREATE TYPE notification_type AS ENUM (
  'MEMBER_INVITED',
  'TASK_ASSIGNED',
  'TASK_DUE_SOON',
  'TASK_OVERDUE',
  'EVIDENCE_SUBMITTED',
  'EVIDENCE_REJECTED',
  'EVIDENCE_EXPIRING',
  'AI_ANALYSIS_COMPLETED',
  'REPORT_READY'
);

CREATE TYPE notification_channel AS ENUM ('EMAIL');
CREATE TYPE notification_status AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELLED', 'SUPPRESSED');
CREATE TYPE notification_delivery_status AS ENUM ('PENDING', 'SENT', 'FAILED', 'PERMANENT_FAILURE');

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  type notification_type NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  channel notification_channel NOT NULL DEFAULT 'EMAIL',
  status notification_status NOT NULL DEFAULT 'PENDING',
  dedup_key TEXT,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX notifications_company_user_dedup_key_unique
  ON notifications(company_id, user_id, dedup_key)
  WHERE dedup_key IS NOT NULL;
CREATE INDEX notifications_company_user_status_created_idx
  ON notifications(company_id, user_id, status, created_at DESC);
CREATE INDEX notifications_company_type_entity_idx
  ON notifications(company_id, type, entity_type, entity_id);

CREATE TABLE notification_deliveries (
  id TEXT PRIMARY KEY,
  notification_id TEXT NOT NULL REFERENCES notifications(id) ON DELETE RESTRICT,
  attempt_no INTEGER NOT NULL,
  provider_message_id TEXT,
  status notification_delivery_status NOT NULL DEFAULT 'PENDING',
  last_error TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT notification_deliveries_notification_attempt_unique UNIQUE(notification_id, attempt_no)
);

CREATE INDEX notification_deliveries_notification_attempted_idx
  ON notification_deliveries(notification_id, attempted_at DESC);
CREATE INDEX notification_deliveries_status_attempted_idx
  ON notification_deliveries(status, attempted_at);
