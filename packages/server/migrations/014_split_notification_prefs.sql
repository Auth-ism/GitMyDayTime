-- Split notification preferences into plan vs reminder
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS plan_email_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS plan_sms_notifications BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS plan_push_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS reminder_email_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS reminder_sms_notifications BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reminder_push_notifications BOOLEAN NOT NULL DEFAULT TRUE;

-- Backfill from existing columns
UPDATE users SET
  plan_email_notifications = email_notifications,
  plan_sms_notifications = sms_notifications,
  plan_push_notifications = push_notifications,
  reminder_email_notifications = email_notifications,
  reminder_sms_notifications = sms_notifications,
  reminder_push_notifications = push_notifications;
