-- Keep checklist schema aligned to canonical table used by the app.
CREATE TABLE IF NOT EXISTS plan_checklist (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES plan_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plan_checklist_plan ON plan_checklist(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_checklist_user ON plan_checklist(user_id);

-- Compatibility for older environments that may still have checklist_items.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'checklist_items'
  ) THEN
    INSERT INTO plan_checklist (id, plan_id, user_id, description, completed, sort_order, created_at)
    SELECT
      c.id::text,
      c.plan_item_id,
      p.user_id,
      c.content,
      COALESCE(c.is_completed, false),
      COALESCE(c.sort_order, 0),
      COALESCE(c.created_at::timestamptz, NOW())
    FROM checklist_items c
    JOIN plan_items p ON p.id = c.plan_item_id
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

