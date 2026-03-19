-- Priority on plan items
ALTER TABLE plan_items ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal';

-- Daily journal
CREATE TABLE IF NOT EXISTS daily_journals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Plan templates
CREATE TABLE IF NOT EXISTS plan_templates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS template_items (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES plan_templates(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  estimated_duration INT,
  scheduled_time TIME,
  priority TEXT NOT NULL DEFAULT 'normal',
  sort_order INT NOT NULL DEFAULT 0
);

-- Web push subscriptions
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_subscription JSONB;
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_notifications BOOLEAN NOT NULL DEFAULT FALSE;
