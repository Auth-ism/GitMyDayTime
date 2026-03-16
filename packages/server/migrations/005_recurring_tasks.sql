CREATE TABLE recurring_tasks (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('dev','meeting','review','ops','learning','personal','other')),
    estimated_duration INTEGER,
    scheduled_time TIME,
    recurrence TEXT NOT NULL CHECK (recurrence IN ('daily','weekdays','weekly','custom')),
    week_day INTEGER CHECK (week_day BETWEEN 0 AND 6),
    custom_days INTEGER[] DEFAULT '{}',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE recurring_task_instances (
    recurring_task_id TEXT NOT NULL REFERENCES recurring_tasks(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    PRIMARY KEY (recurring_task_id, date)
);

CREATE INDEX idx_recurring_tasks_user ON recurring_tasks(user_id);
CREATE INDEX idx_recurring_instances_date ON recurring_task_instances(date);
