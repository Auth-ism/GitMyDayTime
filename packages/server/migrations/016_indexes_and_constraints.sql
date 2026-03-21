-- Missing indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_daily_journals_user_date ON daily_journals(user_id, date);
CREATE INDEX IF NOT EXISTS idx_template_items_template ON template_items(template_id);
CREATE INDEX IF NOT EXISTS idx_plan_items_user_category ON plan_items(user_id, category);
CREATE INDEX IF NOT EXISTS idx_plan_items_completed_type ON plan_items(user_id, completed, item_type, date);
CREATE INDEX IF NOT EXISTS idx_recurring_instances_task_date ON recurring_task_instances(recurring_task_id, date);

-- Partial index for pending notifications (scheduler polls every minute)
CREATE INDEX IF NOT EXISTS idx_plan_items_pending_notifications ON plan_items(date, scheduled_time)
  WHERE notification_sent = FALSE AND scheduled_time IS NOT NULL;

-- CASCADE delete for template items when template is deleted
DO $$
BEGIN
  -- Drop existing FK if any, then re-add with CASCADE
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'template_items_template_id_fkey' AND table_name = 'template_items'
  ) THEN
    ALTER TABLE template_items DROP CONSTRAINT template_items_template_id_fkey;
  END IF;

  ALTER TABLE template_items
    ADD CONSTRAINT template_items_template_id_fkey
    FOREIGN KEY (template_id) REFERENCES plan_templates(id) ON DELETE CASCADE;
END $$;

-- Priority CHECK constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'plan_items_priority_check'
  ) THEN
    ALTER TABLE plan_items ADD CONSTRAINT plan_items_priority_check
      CHECK (priority IS NULL OR priority IN ('urgent', 'high', 'normal'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'template_items_priority_check'
  ) THEN
    ALTER TABLE template_items ADD CONSTRAINT template_items_priority_check
      CHECK (priority IS NULL OR priority IN ('urgent', 'high', 'normal'));
  END IF;
END $$;
