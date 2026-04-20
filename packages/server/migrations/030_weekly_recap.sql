-- ═══════════════════════════════════════════════════════════════════
-- Migration 030: Weekly recap email opt-in
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS weekly_recap_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS weekly_recap_last_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_weekly_recap
  ON users(weekly_recap_enabled)
  WHERE weekly_recap_enabled = TRUE;
