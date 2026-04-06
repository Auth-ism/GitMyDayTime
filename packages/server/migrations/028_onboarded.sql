ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarded BOOLEAN NOT NULL DEFAULT FALSE;
-- Backfill existing users — they've already seen the onboarding
UPDATE users SET onboarded = TRUE;
