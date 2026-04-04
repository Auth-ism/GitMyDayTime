-- Migration 025: Password reset token columns
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_reset_token_hash text,
  ADD COLUMN IF NOT EXISTS password_reset_expires_at  timestamptz;
