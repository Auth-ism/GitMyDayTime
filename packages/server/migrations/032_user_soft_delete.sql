-- Soft delete for user accounts.
-- Hard delete is destructive; we keep the row + all related data and just flag deleted_at.
-- Email/username uniqueness is relaxed to "active accounts only" so a deleted user's
-- email can be reused for a fresh registration with a brand-new id.

ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Drop the original UNIQUE constraints (if they exist) — pg auto-named them.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key;

-- Partial unique indexes — only enforce uniqueness for non-deleted rows.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_active_unique
  ON users (email) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_username_active_unique
  ON users (username) WHERE deleted_at IS NULL;

-- Useful for filtering deleted users out of queries.
CREATE INDEX IF NOT EXISTS users_deleted_at_idx ON users (deleted_at) WHERE deleted_at IS NOT NULL;
