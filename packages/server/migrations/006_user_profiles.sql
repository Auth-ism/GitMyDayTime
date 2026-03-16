-- 006: User profiles & preferences
-- Extends users table with profile info and settings
-- Prepares for future multi-user relational features

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Europe/Istanbul',
  ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'tr',
  ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'light',
  ADD COLUMN IF NOT EXISTS pomodoro_duration INTEGER NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS break_duration INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS daily_goal INTEGER,
  ADD COLUMN IF NOT EXISTS work_start_time TIME,
  ADD COLUMN IF NOT EXISTS work_end_time TIME,
  ADD COLUMN IF NOT EXISTS default_category TEXT NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notification_enabled BOOLEAN NOT NULL DEFAULT false;

-- Index for future social features (finding public profiles)
CREATE INDEX IF NOT EXISTS idx_users_is_public ON users (is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_users_username_lower ON users (LOWER(username));
