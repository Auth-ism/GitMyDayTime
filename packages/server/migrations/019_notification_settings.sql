-- Advance notification: how many minutes before scheduledTime to send a "heads-up" push
-- 0 = disabled (default)
ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_before_minutes INTEGER NOT NULL DEFAULT 0;

-- Silent hours: don't send notifications between these times
ALTER TABLE users ADD COLUMN IF NOT EXISTS silent_hours_start TIME;
ALTER TABLE users ADD COLUMN IF NOT EXISTS silent_hours_end TIME;

-- Track whether the advance notification was already sent for a plan item
ALTER TABLE plan_items ADD COLUMN IF NOT EXISTS advance_notification_sent BOOLEAN NOT NULL DEFAULT FALSE;
