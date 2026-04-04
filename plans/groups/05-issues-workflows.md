# 05 — Issues & Workflow Sistemi

## Issue Tipleri Hiyerarşisi

```
Epic                              ← büyük özellik bloğu (sprint'leri aşabilir)
  └─ Story                        ← kullanıcı hikayesi, iş değeri birimi
       ├─ Task                    ← somut iş kalemi
       ├─ Bug                     ← hata raporu
       └─ Sub-task                ← task/bug'ın alt adımı
```

**Hiyerarşi Kuralları:**
- Epic, parent_id alamaz (en üst seviye)
- Story → parent_id = Epic (opsiyonel)
- Task/Bug → parent_id = Story (opsiyonel), epic_id = Epic (opsiyonel)
- Sub-task → parent_id = Task veya Bug (zorunlu)
- Sub-task, başka sub-task'a parent olamaz (max 1 seviye derinlik)

**Phase 1 Uygulaması:** Sadece `task` ve `bug` tiplerini zorunlu uygula. Epic/Story/Sub-task alanlar DB'de var ama UI'da gösterilmeyebilir.

---

## Issue Key Sistemi

`PROJECT_KEY-N` formatı. Örnekler: `ALPHA-1`, `GMD-42`, `WEBAPP-100`

```typescript
// storage/projects.ts
export async function createIssue(projectId: string, data: AssignIssueInput, reporterId: string): Promise<Issue> {
  // 1. Atomik numara al
  const { rows: [{ num }] } = await pool.query(
    "SELECT next_issue_number($1) AS num", [projectId]
  );
  // 2. Project key'i çek
  const { rows: [project] } = await pool.query(
    "SELECT project_key FROM projects WHERE id=$1", [projectId]
  );
  const issueKey = `${project.project_key}-${num}`;

  // 3. Default status al
  const { rows: [defaultStatus] } = await pool.query(
    "SELECT id FROM workflow_statuses WHERE project_id=$1 AND is_default=TRUE LIMIT 1", [projectId]
  );

  // 4. Insert
  const { rows: [issue] } = await pool.query(`
    INSERT INTO issues (project_id, issue_number, issue_key, title, description,
                        issue_type, status_id, priority, assignee_id, reporter_id,
                        due_date, estimated_hours, labels, sort_order)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
            (SELECT COALESCE(MAX(sort_order),0)+1 FROM issues WHERE project_id=$1 AND status_id=$7))
    RETURNING *
  `, [projectId, num, issueKey, data.title, data.description ?? null,
      data.issueType ?? "task", defaultStatus.id, data.priority ?? "medium",
      data.assigneeId ?? null, reporterId,
      data.dueDate ?? null, data.estimatedHours ?? null, data.labels ?? []]);

  return toIssueDTO(issue);
}
```

---

## Workflow State Machine

### Phase 1: Basit Durum Geçişi

```
Herhangi durum → herhangi durum
(Phase 1'de kısıtlama yok — kullanıcı istediği duruma geçebilir)
```

```typescript
// routes/projects.ts — status güncelleme
router.patch("/:id/issues/:issueId/status", isDev, wrap(async (req, res) => {
  const { statusId } = req.body;
  // Phase 1: sadece statusId'nin proje'ye ait olduğunu doğrula
  const { rows: [status] } = await pool.query(
    "SELECT * FROM workflow_statuses WHERE id=$1 AND project_id=$2", [statusId, req.params.id]
  );
  if (!status) return res.status(404).json({ error: "Geçersiz durum" });

  const oldIssue = await getIssue(req.params.issueId);
  const newIssue = await updateIssueStatus(req.params.issueId, statusId, status.category);

  // Geçmiş kaydı
  await logIssueHistory(req.params.issueId, req.userId!, "status",
    oldIssue.statusName, status.name);

  // 'done' kategorisine geçince resolved_at set et
  if (status.category === "done" && !oldIssue.resolvedAt) {
    await pool.query("UPDATE issues SET resolved_at=NOW() WHERE id=$1", [req.params.issueId]);
  }
  // 'done'dan geri dönünce resolved_at temizle
  if (status.category !== "done" && oldIssue.resolvedAt) {
    await pool.query("UPDATE issues SET resolved_at=NULL WHERE id=$1", [req.params.issueId]);
  }

  await invalidateIssueCache(req.params.issueId);
  await invalidateBoardCache(req.params.id);
  await publishProjectEvent(req.params.id, { type: "issue_status_changed",
    issueId: req.params.issueId, fromStatus: oldIssue.statusName, toStatus: status.name });

  res.json(newIssue);
}));
```

### Phase 2: Özelleştirilebilir Workflow Durumları

UI'dan yeni durum ekleme, renk değiştirme, sıra değiştirme:

```typescript
// Proje oluşturunca seed edilen varsayılan durumlar:
async function seedDefaultStatuses(projectId: string): Promise<void> {
  const defaults = [
    { name: "Yapılacak",    category: "todo",        color: "#6b7280", sort: 0, isDefault: true  },
    { name: "Devam Ediyor", category: "in_progress", color: "#3b82f6", sort: 1, isDefault: false },
    { name: "İnceleme",     category: "in_progress", color: "#f59e0b", sort: 2, isDefault: false },
    { name: "Tamamlandı",   category: "done",        color: "#10b981", sort: 3, isDefault: false },
  ];
  await pool.query(`
    INSERT INTO workflow_statuses (project_id, name, category, color, sort_order, is_default)
    SELECT $1, u.name, u.category, u.color, u.sort_order, u.is_default
    FROM unnest($2::text[], $3::text[], $4::text[], $5::int[], $6::bool[])
      AS u(name, category, color, sort_order, is_default)
  `, [projectId,
      defaults.map(d => d.name), defaults.map(d => d.category),
      defaults.map(d => d.color), defaults.map(d => d.sort),
      defaults.map(d => d.isDefault)]);
}
```

### Phase 4: Validasyon & Tetikleyiciler

*Post-MVP. Referans için tasarım:*

```typescript
// workflow_transitions tablosu (Phase 4):
CREATE TABLE workflow_transitions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  from_status UUID NOT NULL REFERENCES workflow_statuses(id),
  to_status   UUID NOT NULL REFERENCES workflow_statuses(id),
  required_fields TEXT[],   -- ["resolution_note"] — geçiş için zorunlu doldurulacak alanlar
  allowed_roles   TEXT[]    -- boşsa herkes geçirebilir
);

-- Durum geçişi öncesi:
// 1. Geçiş izin var mı? (from → to transition kaydı var mı?)
// 2. Zorunlu alanlar dolu mu?
// 3. Kullanıcı rolü uygun mu?
```

---

## Issue Linking (Phase 2)

### Link Tipleri ve Karşılıkları

| Tip | Ters |
|-----|------|
| `blocks` | `is_blocked_by` |
| `duplicates` | `is_duplicated_by` |
| `clones` | `is_cloned_by` |
| `relates_to` | `relates_to` (simetrik) |

```typescript
// storage/projects.ts
export async function createIssueLink(sourceId: string, targetId: string,
    linkType: LinkType, createdBy: string): Promise<void> {
  const inverse: Record<LinkType, LinkType> = {
    blocks:          "is_blocked_by",
    is_blocked_by:   "blocks",
    duplicates:      "is_duplicated_by",
    is_duplicated_by:"duplicates",
    clones:          "is_cloned_by",
    is_cloned_by:    "clones",
    relates_to:      "relates_to",
  };

  await pool.query(`
    INSERT INTO issue_links (source_id, target_id, link_type, created_by)
    VALUES ($1,$2,$3,$4), ($2,$1,$5,$4)
    ON CONFLICT (source_id, target_id, link_type) DO NOTHING
  `, [sourceId, targetId, linkType, createdBy, inverse[linkType]]);
}
```

**UI Gösterimi (IssueSidebar):**
- "Blokluyor" → kırmızı ikon + ALPHA-X bağlantısı
- "Bloklanıyor" → turuncu ikon + ALPHA-X
- "İlgili" → mavi ikon
- "Kopya" → gri ikon + üzeri çizili

---

## Labels & Etiketleme

Phase 1'de basit TEXT[] kolonu:

```sql
-- issues.labels TEXT[] DEFAULT '{}'
-- Proje bazlı etiket listesi: mevcut issue'lardan DISTINCT alınır, önceden tanımlama yok
```

```typescript
// Proje bazlı tüm etiketler (autocomplete için)
const { rows } = await pool.query(`
  SELECT DISTINCT unnest(labels) AS label
  FROM issues WHERE project_id=$1
  ORDER BY label
`, [projectId]);
```

Phase 3: `project_labels` ayrı tablo + renk + açıklama.

---

## @Mention Sistemi (Phase 2)

**Backend — comment oluşturmada:**

```typescript
// Markdown içindeki @username'leri parse et
const MENTION_RE = /@([a-zA-Z0-9_]+)/g;
const mentioned: string[] = [];
let match;
while ((match = MENTION_RE.exec(content)) !== null) {
  mentioned.push(match[1]);
}

// Username'leri UUID'ye çevir (sadece proje üyeleri)
const { rows: users } = await pool.query(`
  SELECT u.id, u.username
  FROM users u
  JOIN project_members pm ON pm.user_id = u.id
  WHERE pm.project_id=$1 AND u.username = ANY($2)
`, [projectId, mentioned]);

const mentionIds = users.map(u => u.id);

// Her mention için bildirim kuyruğuna at
for (const user of users) {
  if (user.id !== req.userId) {  // kendi kendinizi etiketleme
    await enqueueProjectNotification({
      type: "comment_mention",
      issueId,
      mentionedId: user.id,
      authorName: req.user.username,
      projectName: project.name,
      issueKey: issue.issue_key,
      commentPreview: content.slice(0, 120),
    });
  }
}
```

**Frontend — Phase 2:**
- Yorum yazarken `@` yazdığında üye listesi dropdown'ı açılır
- `useProjectMembers` hook + client-side filter

---

## Issue Geçmişi

Mevcut `audit.ts` pattern'ı ile aynı:

```typescript
// storage/projects.ts
export async function logIssueHistory(issueId: string, changedBy: string,
    fieldName: string, oldValue: string | null, newValue: string | null): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO issue_history (issue_id, changed_by, field_name, old_value, new_value)
       VALUES ($1, $2, $3, $4, $5)`,
      [issueId, changedBy, fieldName, oldValue, newValue]
    );
  } catch { /* audit failure asla uygulamayı kırmamalı */ }
}
```

**Ne zaman log atılır:**

| Alan | old_value | new_value |
|------|-----------|-----------|
| status | "Yapılacak" | "Devam Ediyor" |
| assignee | "@alice" | "@bob" |
| priority | "medium" | "critical" |
| title | "eski başlık" | "yeni başlık" |
| due_date | "2025-04-15" | "2025-04-20" |
| sprint | "Sprint 1" | "Sprint 2" |
| description | "(değişti)" | null (uzun metin diff için özel işlem) |

**Frontend (IssueHistory.tsx):**
```tsx
function HistoryEntry({ entry }: { entry: IssueHistoryEntry }) {
  return (
    <div className="flex items-start gap-2 text-xs text-text-tertiary">
      <span className="font-medium text-text-secondary">{entry.changedByName}</span>
      <span>{fieldLabel(entry.fieldName)}</span>
      {entry.oldValue && <><span className="line-through">{entry.oldValue}</span><span>→</span></>}
      <span className="text-text-primary">{entry.newValue}</span>
      <span className="ml-auto">{formatRelativeTime(entry.changedAt)}</span>
    </div>
  );
}
```

---

## Custom Fields (Phase 3)

Proje yöneticisi UI'dan alan tanımlar. Değerler `issues.custom_fields JSONB` içinde:

```typescript
// Örnek custom_fields verisi:
{
  "story_points": 5,
  "environment": "production",
  "affected_version": "2.6.x",
  "regression": true
}
```

**custom_field_definitions tablosundaki bir örnek:**
```json
{
  "field_key": "story_points",
  "field_type": "number",
  "name": "Story Puanı",
  "required": false,
  "options": null
}
```

**Validation (route handler'da):**
```typescript
// Issue oluşturma/güncelleme sırasında:
const fieldDefs = await getCustomFieldDefinitions(projectId);
for (const def of fieldDefs.filter(f => f.required)) {
  if (!customFields[def.fieldKey]) {
    return res.status(422).json({ error: `${def.name} zorunlu bir alandır` });
  }
}
```

**Kanban Kartında custom field gösterimi (Phase 3):**
- ProjectSettings'de hangi custom field'ların kart üzerinde görüneceği seçilebilir
- `IssueCard.tsx` → `visibleFields.map(f => <span>{customFields[f.key]}</span>)`
