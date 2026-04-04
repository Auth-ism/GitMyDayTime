-- Migration 022: Spaces
-- Spaces are containers for projects (workspace/team-level grouping).
-- space_id on projects is nullable — existing projects work without a space.
-- UI integration is deferred; schema is added now to avoid future breaking migrations.

CREATE TABLE IF NOT EXISTS spaces (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  slug        VARCHAR(50)  NOT NULL UNIQUE,
  description TEXT,
  icon        TEXT,
  color       VARCHAR(20)  NOT NULL DEFAULT '#6b7280',
  owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  settings    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS space_members (
  space_id  UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role      VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (space_id, user_id)
);

-- Link projects to spaces (nullable — existing projects have no space)
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS space_id UUID REFERENCES spaces(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_spaces_owner    ON spaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_spaces_slug     ON spaces(slug);
CREATE INDEX IF NOT EXISTS idx_space_members   ON space_members(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_space  ON projects(space_id);
