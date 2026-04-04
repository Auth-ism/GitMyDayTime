CREATE TABLE sprints (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  goal        TEXT,
  start_date  DATE,
  end_date    DATE,
  status      TEXT NOT NULL DEFAULT 'planning'
                CHECK (status IN ('planning', 'active', 'completed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_sprints_project ON sprints(project_id);
CREATE INDEX idx_sprints_status  ON sprints(project_id, status);

-- Add FK (sprint_id was nullable UUID with no FK constraint)
ALTER TABLE issues
  ADD CONSTRAINT fk_issues_sprint_id
  FOREIGN KEY (sprint_id) REFERENCES sprints(id) ON DELETE SET NULL;
