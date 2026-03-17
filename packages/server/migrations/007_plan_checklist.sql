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
