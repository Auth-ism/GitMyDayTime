CREATE TABLE user_notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  project_id  UUID REFERENCES projects(id) ON DELETE CASCADE,
  issue_id    UUID REFERENCES issues(id) ON DELETE SET NULL,
  actor_name  TEXT,
  message     TEXT NOT NULL,
  url         TEXT,
  read        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_notifications_user
  ON user_notifications(user_id, read, created_at DESC);
