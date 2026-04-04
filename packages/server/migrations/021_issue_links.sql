-- Migration 021: Issue Links + pg_trgm index on issues

-- Issue links (blocking, relates_to, duplicates, is_cloned_by, etc.)
CREATE TABLE IF NOT EXISTS issue_links (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_id   UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  target_id   UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  link_type   VARCHAR(32) NOT NULL DEFAULT 'relates_to',
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_id, target_id, link_type)
);

CREATE INDEX IF NOT EXISTS idx_issue_links_source ON issue_links(source_id);
CREATE INDEX IF NOT EXISTS idx_issue_links_target ON issue_links(target_id);
CREATE INDEX IF NOT EXISTS idx_issue_links_project ON issue_links(project_id);

-- Fuzzy search index on issues.title (uses pg_trgm from migration 013)
CREATE INDEX IF NOT EXISTS idx_issues_title_trgm ON issues USING gin(LOWER(title) gin_trgm_ops);
