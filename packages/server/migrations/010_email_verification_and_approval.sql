ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS email_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS approval_token_hash TEXT;

-- Auto-approve and verify existing users so they are not blocked
UPDATE users SET approved = TRUE, email_verified = TRUE;
