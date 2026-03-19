-- Custom categories table
CREATE TABLE IF NOT EXISTS user_categories (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6b7280',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_categories_user ON user_categories(user_id);

-- Drop CHECK constraints on category columns so custom categories can be used
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT con.conname, con.conrelid::regclass AS tbl
    FROM pg_constraint con
    JOIN pg_attribute att ON att.attnum = ANY(con.conkey) AND att.attrelid = con.conrelid
    WHERE att.attname = 'category' AND con.contype = 'c'
  ) LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
  END LOOP;
END $$;

-- Add item_type to plan_items (plan or reminder)
ALTER TABLE plan_items ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'plan';
