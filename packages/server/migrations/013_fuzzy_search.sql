CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_plan_items_desc_trgm ON plan_items USING GIN (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_tasks_desc_trgm ON tasks USING GIN (description gin_trgm_ops);
