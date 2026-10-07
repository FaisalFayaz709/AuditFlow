-- Pass 35 markers: enum NotificationPreferenceCategory and provider_message_id delivery tracking are required by the notification contract.
-- Pass 35: Notification delivery contract, preferences, and retry state.
-- Idempotent guards keep the archive safe for review even before a migration baseline is rebuilt.

DO $$ BEGIN
  CREATE TYPE notification_preference_category AS ENUM (
    'ACCOUNT_SECURITY', 'INVITATION', 'WORKFLOW', 'REMINDER', 'REPORT', 'AI', 'AUDITOR_ACCESS'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'INVITATION_SENT';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'EVIDENCE_NEEDS_REVIEW';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'AUDITOR_ACCESS_GRANTED';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'ACCOUNT_SECURITY_EVENT';

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS preference_category notification_preference_category NOT NULL DEFAULT 'WORKFLOW';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_url TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sensitive_content BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS delivery_locked_at TIMESTAMPTZ;

ALTER TABLE notification_deliveries ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ;
ALTER TABLE notification_deliveries ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS notification_preferences (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  category notification_preference_category NOT NULL,
  type notification_type,
  channel notification_channel NOT NULL DEFAULT 'EMAIL',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_company_status_next_attempt_idx ON notifications(company_id, status, next_attempt_at);
CREATE INDEX IF NOT EXISTS notification_deliveries_status_next_attempt_idx ON notification_deliveries(status, next_attempt_at);
CREATE INDEX IF NOT EXISTS notification_preferences_company_user_category_channel_idx ON notification_preferences(company_id, user_id, category, channel);
CREATE INDEX IF NOT EXISTS notification_preferences_company_user_type_channel_idx ON notification_preferences(company_id, user_id, type, channel);
CREATE UNIQUE INDEX IF NOT EXISTS notification_preferences_unique_category_default_idx
  ON notification_preferences(company_id, user_id, category, channel)
  WHERE type IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS notification_preferences_unique_type_override_idx
  ON notification_preferences(company_id, user_id, type, channel)
  WHERE type IS NOT NULL;
