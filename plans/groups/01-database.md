# 01 — Veritabanı Şeması

## Migration Planı

| Migration | İçerik | Faz |
|-----------|--------|-----|
| 020 | Temel: projects, project_members, project_invitations, workflow_statuses, issues (MVP), comments, issue_history, project_issue_counters | 1 |
| 021 | Issue linking, labels, issue_labels (veya issues.labels TEXT[]) | 2 |
| 022 | Sprints, sprint_issues | 2–3 |
| 023 | Attachments | 3 |
| 024 | Custom field definitions | 3 |
| 025 | Saved views | 3 |
| 026 | Webhooks, api_keys | 4 |

---

## Phase 1 — Migration 020 (MVP)

```sql
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Projeler (eski adı: groups)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE projects (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT    NOT NULL CHECK (char_length(name) BETWEEN 1 AND 64),
  description TEXT    CHECK (description IS NULL OR char_length(description) <= 256),
  project_key TEXT    NOT NULL CHECK (project_key ~ '^[A-Z][A-Z0-9]{1,9}$'),  -- "ALPHA", "GMD2"
  board_type  TEXT    NOT NULL DEFAULT 'kanban' CHECK (board_type IN ('kanban', 'scrum')),
  created_by  UUID    NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_key)
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Üye numaralandırma — proje başına atomik issue counter
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Üyeler
-- Roller: owner > admin > developer > reporter > viewer
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE project_members (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'developer'
               CHECK (role IN ('owner', 'admin', 'developer', 'reporter', 'viewer')),
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, user_id)
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Davetiyeler
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE project_invitations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  invited_by    UUID NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  invited_role  TEXT NOT NULL DEFAULT 'developer'
                  CHECK (invited_role IN ('admin', 'developer', 'reporter', 'viewer')),
  token_hash    TEXT NOT NULL UNIQUE,            -- SHA-256; raw token sadece e-postada
  expires_at    TIMESTAMPTZ NOT NULL,            -- 7 gün TTL
  accepted_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, invited_email)
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Workflow Durumları (proje başına)
-- Phase 1: proje oluşturunca 4 varsayılan durum otomatik eklenir.
-- Phase 2: kullanıcı özelleştirebilir.
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE workflow_statuses (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID    NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL CHECK (char_length(name) BETWEEN 1 AND 64),
  color       TEXT    NOT NULL DEFAULT '#6b7280'
                CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  category    TEXT    NOT NULL DEFAULT 'todo'
                CHECK (category IN ('todo', 'in_progress', 'done')),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,   -- yeni issue'lar buradan başlar
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Her proje oluştuğunda storage/projects.ts'de seed edilen varsayılan durumlar:
-- { name:"Yapılacak",    category:"todo",        is_default:true,  sort:0, color:"#6b7280" }
-- { name:"Devam Ediyor", category:"in_progress",                   sort:1, color:"#3b82f6" }
-- { name:"İnceleme",     category:"in_progress",                   sort:2, color:"#f59e0b" }
-- { name:"Tamamlandı",   category:"done",                          sort:3, color:"#10b981" }

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Issues (Görev/Bug/Story/Epic merkezi tablosu)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE issues (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID    NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  issue_number    INTEGER NOT NULL,             -- proje bazlı artan; next_issue_number() ile alınır
  issue_key       TEXT    NOT NULL,             -- "ALPHA-1" — stored, denormalized for speed

  title           TEXT    NOT NULL
                    CHECK (char_length(title) BETWEEN 1 AND 500),
  description     TEXT    CHECK (description IS NULL OR char_length(description) <= 51200),  -- Markdown, 50KB

  -- Sınıflandırma
  issue_type      TEXT    NOT NULL DEFAULT 'task'
                    CHECK (issue_type IN ('epic', 'story', 'task', 'bug', 'sub_task')),
  status_id       UUID    NOT NULL REFERENCES workflow_statuses(id) ON DELETE RESTRICT,
  priority        TEXT    NOT NULL DEFAULT 'medium'
                    CHECK (priority IN ('critical', 'high', 'medium', 'low', 'none')),
  labels          TEXT[]  NOT NULL DEFAULT '{}',

  -- Hiyerarşi (Phase 2 için alan şimdiden var; Phase 1'de NULL kalır)
  parent_id       UUID    REFERENCES issues(id) ON DELETE SET NULL,  -- sub_task → task
  epic_id         UUID    REFERENCES issues(id) ON DELETE SET NULL,  -- task/story → epic

  -- Atama
  assignee_id     UUID    REFERENCES users(id) ON DELETE SET NULL,
  reporter_id     UUID    NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  -- Zaman & efor
  due_date        DATE,
  estimated_hours NUMERIC(6,2) CHECK (estimated_hours IS NULL OR estimated_hours >= 0),
  logged_hours    NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (logged_hours >= 0),

  -- Sprint bağlantısı (Phase 2 — sprints tablosu oluşunca FK eklenir via 022 migration)
  sprint_id       UUID,                         -- Phase 2: REFERENCES sprints(id) SET NULL

  -- Özel alanlar (Phase 3 — şimdiden JSONB ile hazır; schema: custom_field_definitions ile kontrol edilir)
  custom_fields   JSONB   NOT NULL DEFAULT '{}',

  -- Sıralama (board kolonundaki pozisyon için)
  sort_order      INTEGER NOT NULL DEFAULT 0,

  -- Kişisel plan bağlantısı ("Planıma Ekle")
  plan_item_id    UUID    REFERENCES plan_items(id) ON DELETE SET NULL,

  -- Bildirim durumu
  notification_sent BOOLEAN NOT NULL DEFAULT FALSE,

  -- Çözüm & arşiv
  resolved_at     TIMESTAMPTZ,
  archived        BOOLEAN NOT NULL DEFAULT FALSE,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (project_id, issue_number),
  UNIQUE (issue_key)
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Yorumlar
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE issue_comments (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id    UUID    NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  author_id   UUID    NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  content     TEXT    NOT NULL CHECK (char_length(content) BETWEEN 1 AND 10000),  -- Markdown
  mentions    UUID[]  NOT NULL DEFAULT '{}',   -- @mention edilen user ID'leri
  edited_at   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Issue Değişiklik Geçmişi
-- Mevcut audit.ts pattern birebir uygulanır.
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE issue_history (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id    UUID    NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  changed_by  UUID    NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  field_name  TEXT    NOT NULL,                -- "status", "assignee", "priority", "title"
  old_value   TEXT,                            -- JSON string veya düz metin
  new_value   TEXT,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Phase 1 İndeksleri
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE INDEX idx_project_members_user       ON project_members(user_id);
CREATE INDEX idx_issues_project_status      ON issues(project_id, status_id);
CREATE INDEX idx_issues_assignee            ON issues(assignee_id) WHERE assignee_id IS NOT NULL;
CREATE INDEX idx_issues_reporter            ON issues(reporter_id);
CREATE INDEX idx_issues_project_type        ON issues(project_id, issue_type);
CREATE INDEX idx_issues_sprint              ON issues(sprint_id) WHERE sprint_id IS NOT NULL;
CREATE INDEX idx_issues_plan_item           ON issues(plan_item_id) WHERE plan_item_id IS NOT NULL;
CREATE INDEX idx_issues_parent              ON issues(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_issues_epic                ON issues(epic_id) WHERE epic_id IS NOT NULL;
CREATE INDEX idx_issues_updated_at          ON issues(project_id, updated_at DESC);
CREATE INDEX idx_issues_notification        ON issues(notification_sent) WHERE notification_sent = FALSE;
CREATE INDEX idx_issue_comments_issue       ON issue_comments(issue_id);
CREATE INDEX idx_issue_history_issue        ON issue_history(issue_id, changed_at DESC);
CREATE INDEX idx_invitations_token          ON project_invitations(token_hash);
CREATE INDEX idx_invitations_email          ON project_invitations(invited_email);
-- Full-text search (mevcut pg_trgm extension'ı var)
CREATE INDEX idx_issues_title_trgm          ON issues USING gin(title gin_trgm_ops);
CREATE INDEX idx_issues_description_trgm    ON issues USING gin(description gin_trgm_ops) WHERE description IS NOT NULL;
```

---

## Phase 2 — Migration 021 (Issue Linking)

```sql
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Issue İlişkileri
-- blocks / is_blocked_by otomatik ters oluşturulur (storage katmanında).
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE issue_links (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id   UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  target_id   UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  link_type   TEXT NOT NULL CHECK (link_type IN (
                'blocks',           -- source, target'ı blokluyor
                'is_blocked_by',    -- source, target tarafından bloklanıyor (ters)
                'relates_to',       -- genel ilişki (simetrik)
                'duplicates',       -- source, target'ın kopyası
                'is_duplicated_by', -- ters
                'clones',           -- source, target'tan klonlandı
                'is_cloned_by'      -- ters
              )),
  created_by  UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_id, target_id, link_type),
  CHECK (source_id != target_id)
);

CREATE INDEX idx_issue_links_source ON issue_links(source_id);
CREATE INDEX idx_issue_links_target ON issue_links(target_id);
```

---

## Phase 2–3 — Migration 022 (Sprints)

```sql
CREATE TABLE sprints (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID    NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL CHECK (char_length(name) BETWEEN 1 AND 128),
  goal        TEXT    CHECK (goal IS NULL OR char_length(goal) <= 512),
  status      TEXT    NOT NULL DEFAULT 'planning'
                CHECK (status IN ('planning', 'active', 'completed')),
  start_date  DATE,
  end_date    DATE,
  completed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Proje başına en fazla 1 aktif sprint
  CONSTRAINT one_active_sprint EXCLUDE (project_id WITH =) WHERE (status = 'active')
);

-- Backlog ve sprint-issue ilişkisi
-- sprint_id = NULL → backlog
ALTER TABLE issues ADD CONSTRAINT fk_sprint
  FOREIGN KEY (sprint_id) REFERENCES sprints(id) ON DELETE SET NULL;

-- Board'daki sıralama (sprint veya backlog içinde)
CREATE TABLE sprint_issue_order (
  sprint_id   UUID    REFERENCES sprints(id) ON DELETE CASCADE,  -- NULL = backlog
  project_id  UUID    NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  issue_id    UUID    NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id, issue_id)
);
```

---

## Phase 3 — Migration 023-025 (Attachments, Custom Fields, Saved Views)

```sql
-- ━━ Dosya Eklentileri ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- MVP: base64/blob DB'de (avatar gibi). Scale: S3/MinIO URL.
CREATE TABLE issue_attachments (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id    UUID    NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  uploader_id UUID    NOT NULL REFERENCES users(id)  ON DELETE RESTRICT,
  filename    TEXT    NOT NULL,
  file_url    TEXT    NOT NULL,        -- S3 URL veya "/api/attachments/:id" path
  file_size   INTEGER NOT NULL CHECK (file_size > 0 AND file_size <= 10485760),  -- max 10MB
  mime_type   TEXT    NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ━━ Özel Alan Tanımları (proje başına) ━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE custom_field_definitions (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID    NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL CHECK (char_length(name) BETWEEN 1 AND 64),
  field_key   TEXT    NOT NULL,        -- "story_points", "environment" — issues.custom_fields'ta anahtar
  field_type  TEXT    NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'select', 'multiselect', 'user')),
  options     JSONB   DEFAULT '[]',    -- select/multiselect için: [{ value, label, color }]
  required    BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  UNIQUE (project_id, field_key)
);
-- issues.custom_fields JSONB zaten var — yeni tanım eklenmesi için migration gerekmez.

-- ━━ Kaydedilmiş Görünümler ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE saved_views (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID    REFERENCES projects(id) ON DELETE CASCADE,   -- NULL = kişisel
  owner_id    UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL CHECK (char_length(name) BETWEEN 1 AND 64),
  filters     JSONB   NOT NULL DEFAULT '{}',  -- { type, status, assignee, priority, label, ... }
  columns     JSONB   NOT NULL DEFAULT '[]',  -- görüntülenecek sütunlar
  is_shared   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Phase 4 — Migration 026 (Webhooks, API Keys)

```sql
-- ━━ Webhook Tanımları ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE webhooks (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID    NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by  UUID    NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  url         TEXT    NOT NULL CHECK (url ~ '^https?://'),
  events      TEXT[]  NOT NULL,    -- ["issue.created", "issue.status_changed", "comment.added"]
  secret_hash TEXT,                -- HMAC-SHA256 imzası için; raw secret sadece oluşturma anında gösterilir
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  last_fired_at    TIMESTAMPTZ,
  failure_count    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ━━ Dış API Anahtarları ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE api_keys (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL CHECK (char_length(name) BETWEEN 1 AND 64),
  key_hash    TEXT    NOT NULL UNIQUE,   -- SHA-256; raw key sadece oluşturma anında gösterilir
  scopes      TEXT[]  NOT NULL DEFAULT '{"read"}',  -- ["read", "write", "admin"]
  last_used_at TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## plan_items: Değişiklik Yok

Mevcut `plan_items` tablosuna **sıfır kolon eklenmez**.
`issues.plan_item_id` FK ile bağlantı kurulur. Tüm mevcut storage.ts sorguları (`WHERE user_id = $1`) dokunulmadan çalışmaya devam eder.
