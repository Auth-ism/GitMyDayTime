-- ═══════════════════════════════════════════════════════════════════
-- Migration 020: Project Management — Phase 1 MVP
-- ═══════════════════════════════════════════════════════════════════

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Projects
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE projects (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT    NOT NULL CHECK (char_length(name) BETWEEN 1 AND 64),
  description TEXT    CHECK (description IS NULL OR char_length(description) <= 256),
  project_key TEXT    NOT NULL CHECK (project_key ~ '^[A-Z][A-Z0-9]{1,9}$'),
  board_type  TEXT    NOT NULL DEFAULT 'kanban' CHECK (board_type IN ('kanban', 'scrum')),
  created_by  UUID    NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_key)
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Issue counter — atomically increments per project
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE project_issue_counters (
  project_id  UUID    PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  next_number INTEGER NOT NULL DEFAULT 1
);

CREATE OR REPLACE FUNCTION next_issue_number(p_project_id UUID) RETURNS INTEGER AS $$
DECLARE v_num INTEGER;
BEGIN
  INSERT INTO project_issue_counters (project_id, next_number)
    VALUES (p_project_id, 2)
  ON CONFLICT (project_id) DO UPDATE
    SET next_number = project_issue_counters.next_number + 1
  RETURNING next_number - 1 INTO v_num;
  RETURN v_num;
END;
$$ LANGUAGE plpgsql;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Project Members
-- Roles: owner > admin > developer > reporter > viewer
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE project_members (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'developer'
               CHECK (role IN ('owner', 'admin', 'developer', 'reporter', 'viewer')),
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, user_id)
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Invitations
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE project_invitations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  invited_by    UUID NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  invited_role  TEXT NOT NULL DEFAULT 'developer'
                  CHECK (invited_role IN ('admin', 'developer', 'reporter', 'viewer')),
  token_hash    TEXT NOT NULL UNIQUE,
  expires_at    TIMESTAMPTZ NOT NULL,
  accepted_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, invited_email)
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Workflow Statuses (per project)
-- Phase 1: 4 default statuses seeded on project creation
-- Phase 2: user can customise
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE workflow_statuses (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID    NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL CHECK (char_length(name) BETWEEN 1 AND 64),
  color       TEXT    NOT NULL DEFAULT '#6b7280'
                CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  category    TEXT    NOT NULL DEFAULT 'todo'
                CHECK (category IN ('todo', 'in_progress', 'done')),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Issues
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE issues (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID    NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  issue_number    INTEGER NOT NULL,
  issue_key       TEXT    NOT NULL,

  title           TEXT    NOT NULL CHECK (char_length(title) BETWEEN 1 AND 500),
  description     TEXT    CHECK (description IS NULL OR char_length(description) <= 51200),

  issue_type      TEXT    NOT NULL DEFAULT 'task'
                    CHECK (issue_type IN ('epic', 'story', 'task', 'bug', 'sub_task')),
  status_id       UUID    NOT NULL REFERENCES workflow_statuses(id) ON DELETE RESTRICT,
  priority        TEXT    NOT NULL DEFAULT 'medium'
                    CHECK (priority IN ('critical', 'high', 'medium', 'low', 'none')),
  labels          TEXT[]  NOT NULL DEFAULT '{}',

  -- Hierarchy (Phase 2; NULL in Phase 1)
  parent_id       UUID    REFERENCES issues(id) ON DELETE SET NULL,
  epic_id         UUID    REFERENCES issues(id) ON DELETE SET NULL,

  assignee_id     UUID    REFERENCES users(id) ON DELETE SET NULL,
  reporter_id     UUID    NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  due_date        DATE,
  estimated_hours NUMERIC(6,2) CHECK (estimated_hours IS NULL OR estimated_hours >= 0),
  logged_hours    NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (logged_hours >= 0),

  sprint_id       UUID,

  custom_fields   JSONB   NOT NULL DEFAULT '{}',
  sort_order      INTEGER NOT NULL DEFAULT 0,

  plan_item_id    TEXT    REFERENCES plan_items(id) ON DELETE SET NULL,
  notification_sent BOOLEAN NOT NULL DEFAULT FALSE,

  resolved_at     TIMESTAMPTZ,
  archived        BOOLEAN NOT NULL DEFAULT FALSE,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (project_id, issue_number),
  UNIQUE (issue_key)
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Issue Comments
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE issue_comments (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id    UUID    NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  author_id   UUID    NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  content     TEXT    NOT NULL CHECK (char_length(content) BETWEEN 1 AND 10000),
  mentions    UUID[]  NOT NULL DEFAULT '{}',
  edited_at   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Issue Change History
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE issue_history (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id    UUID    NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  changed_by  UUID    NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  field_name  TEXT    NOT NULL,
  old_value   TEXT,
  new_value   TEXT,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Indexes
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE INDEX idx_project_members_user       ON project_members(user_id);
CREATE INDEX idx_workflow_statuses_project  ON workflow_statuses(project_id, sort_order);
CREATE INDEX idx_issues_project_status      ON issues(project_id, status_id) WHERE archived = FALSE;
CREATE INDEX idx_issues_assignee            ON issues(assignee_id) WHERE assignee_id IS NOT NULL;
CREATE INDEX idx_issues_reporter            ON issues(reporter_id);
CREATE INDEX idx_issues_project_type        ON issues(project_id, issue_type);
CREATE INDEX idx_issues_sprint              ON issues(sprint_id) WHERE sprint_id IS NOT NULL;
CREATE INDEX idx_issues_plan_item           ON issues(plan_item_id) WHERE plan_item_id IS NOT NULL;
CREATE INDEX idx_issues_updated_at          ON issues(project_id, updated_at DESC);
CREATE INDEX idx_issues_notification        ON issues(notification_sent) WHERE notification_sent = FALSE AND archived = FALSE;
CREATE INDEX idx_issue_comments_issue       ON issue_comments(issue_id);
CREATE INDEX idx_issue_history_issue        ON issue_history(issue_id, changed_at DESC);
CREATE INDEX idx_invitations_token          ON project_invitations(token_hash);
CREATE INDEX idx_invitations_email          ON project_invitations(invited_email);
CREATE INDEX idx_issues_title_trgm          ON issues USING gin(title gin_trgm_ops);
