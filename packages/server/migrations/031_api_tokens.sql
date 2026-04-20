-- ═══════════════════════════════════════════════════════════════════
-- Migration 031: User API tokens (Personal Access Tokens)
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_api_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 64),
    token_hash TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_api_tokens_user
    ON user_api_tokens(user_id) WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_api_tokens_hash
    ON user_api_tokens(token_hash) WHERE revoked_at IS NULL;
