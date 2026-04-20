-- ═══════════════════════════════════════════════════════════════════
-- Migration 029: Calendar subscribe tokens (iCal feed)
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_calendar_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_calendar_tokens_user
    ON user_calendar_tokens(user_id) WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_calendar_tokens_hash
    ON user_calendar_tokens(token_hash) WHERE revoked_at IS NULL;
