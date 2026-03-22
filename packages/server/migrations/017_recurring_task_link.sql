-- Link plan_items to their source recurring task
ALTER TABLE plan_items ADD COLUMN IF NOT EXISTS recurring_task_id TEXT REFERENCES recurring_tasks(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_plan_items_recurring ON plan_items(recurring_task_id) WHERE recurring_task_id IS NOT NULL;

-- Backfill: link existing injected items to their recurring tasks
UPDATE plan_items pi
SET recurring_task_id = sub.recurring_task_id
FROM (
  SELECT DISTINCT ON (pi2.id) pi2.id AS plan_item_id, rti.recurring_task_id
  FROM plan_items pi2
  JOIN recurring_task_instances rti ON rti.date = pi2.date
  JOIN recurring_tasks rt ON rt.id = rti.recurring_task_id AND rt.user_id = pi2.user_id
  WHERE pi2.description = rt.description
    AND pi2.category = rt.category
    AND pi2.recurring_task_id IS NULL
) sub
WHERE pi.id = sub.plan_item_id;
