# 08 — Arama & Audit Log

## Arama Sistemi

### Phase 1: Basit Filtre + Full-text

Mevcut `search.ts` + `pg_trgm` altyapısı issue'lara genişletilir:

```typescript
// storage/projects.ts
export interface IssueFilters {
  q?:        string;     // full-text arama
  type?:     string;     // epic|story|task|bug|sub_task
  status?:   string;     // status ID
  priority?: string;     // critical|high|medium|low
  assignee?: string;     // user ID
  reporter?: string;     // user ID
  label?:    string;     // etiket adı
  sprint?:   string;     // sprint ID | "backlog" | "all"
  from?:     string;     // due_date >= (YYYY-MM-DD)
  to?:       string;     // due_date <= (YYYY-MM-DD)
  archived?: boolean;    // varsayılan: false
  page?:     number;
  limit?:    number;     // max 100
}

export async function searchIssues(projectId: string, filters: IssueFilters) {
  const conditions: string[] = ["i.project_id = $1"];
  const params: any[] = [projectId];
  let p = 2;

  if (!filters.archived) {
    conditions.push("i.archived = FALSE");
  }

  if (filters.q) {
    conditions.push(`(i.title ILIKE $${p} OR i.description ILIKE $${p})`);
    params.push(`%${filters.q}%`);
    p++;
  }

  if (filters.type)     { conditions.push(`i.issue_type = $${p++}`);   params.push(filters.type); }
  if (filters.status)   { conditions.push(`i.status_id = $${p++}`);    params.push(filters.status); }
  if (filters.priority) { conditions.push(`i.priority = $${p++}`);     params.push(filters.priority); }
  if (filters.assignee) { conditions.push(`i.assignee_id = $${p++}`);  params.push(filters.assignee); }
  if (filters.reporter) { conditions.push(`i.reporter_id = $${p++}`);  params.push(filters.reporter); }
  if (filters.label)    { conditions.push(`$${p++} = ANY(i.labels)`);  params.push(filters.label); }
  if (filters.from)     { conditions.push(`i.due_date >= $${p++}`);    params.push(filters.from); }
  if (filters.to)       { conditions.push(`i.due_date <= $${p++}`);    params.push(filters.to); }

  if (filters.sprint === "backlog") {
    conditions.push("i.sprint_id IS NULL");
  } else if (filters.sprint && filters.sprint !== "all") {
    conditions.push(`i.sprint_id = $${p++}`);
    params.push(filters.sprint);
  }

  const limit  = Math.min(filters.limit ?? 50, 100);
  const offset = ((filters.page ?? 1) - 1) * limit;

  const sql = `
    SELECT i.*, ws.name AS status_name, ws.color AS status_color,
           u_a.username AS assignee_name, u_a.avatar_url AS assignee_avatar,
           COUNT(*) OVER() AS total_count
    FROM issues i
    JOIN workflow_statuses ws ON ws.id = i.status_id
    LEFT JOIN users u_a ON u_a.id = i.assignee_id
    WHERE ${conditions.join(" AND ")}
    ORDER BY i.updated_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const { rows } = await pool.query(sql, params);
  const total = rows[0]?.total_count ?? 0;
  return { issues: rows.map(toIssueDTO), total: parseInt(total), page: filters.page ?? 1, limit };
}
```

### Mevcut /api/search Genişletmesi

```typescript
// routes/search.ts — mevcut endpoint'e issue sonuçları eklenir
router.get("/", authMiddleware, wrap(async (req, res) => {
  const { q } = req.query as { q?: string };
  if (!q || q.trim().length < 2) return res.json({ plans: [], tasks: [], issues: [] });

  const [{ plans, tasks }, issues] = await Promise.all([
    searchItems(req.userId!, q.trim()),           // mevcut fonksiyon
    searchAllProjectIssues(req.userId!, q.trim()), // yeni: üyesi olduğu tüm projelerde ara
  ]);

  res.json({ plans, tasks, issues });
}));
```

### SearchPage.tsx Güncellemesi

```tsx
// Mevcut SearchPage'e issue sonuçları eklenir:
const results = useMemo(() => {
  if (!data) return [];
  return [
    ...data.plans.map(p => ({ type: "plan" as const, date: p.date, data: p })),
    ...data.tasks.map(t => ({ type: "task" as const, date: t.date, data: t })),
    ...data.issues.map(i => ({ type: "issue" as const, date: i.updatedAt, data: i })),
  ].sort((a, b) => b.date.localeCompare(a.date));
}, [data]);
```

---

### Phase 2: Gelişmiş Filtre Builder

Frontend'de `BoardFilterBar.tsx` ile çoklu filtre kombinasyonu:

```tsx
// BoardFilterBar state:
interface BoardFilters {
  assignees:  string[];    // multi-select
  priorities: string[];
  types:      string[];
  labels:     string[];
  sprint:     string;
  q:          string;
}

// URL'de filtreler saklanır:
// /project/:id/board?assignee=uuid1,uuid2&priority=critical,high&type=bug
// Sayfa yenileme veya link paylaşımında filtreler korunur
```

---

### Phase 3: Kaydedilmiş Görünümler

```typescript
// saved_views tablosu (01-database.md'de tanımlı)
// Örnek kayıt:
{
  name: "Benim Kritik Bug'larım",
  filters: {
    assignee: "current_user",   // özel değer: giriş yapan kullanıcı
    type: "bug",
    priority: "critical",
    status_category: "todo,in_progress"
  },
  is_shared: false  // sadece benim görünümüm
}
```

**UI:** BoardPage'de `[Görünümler ▼]` dropdown → kayıtlı filtreleri listele + uygula.

---

### Phase 4: JQL-benzeri Sorgu Dili

*Post-MVP. Referans için:*

```
// GMD Query Language (GQL) örnekleri:
assignee = currentUser() AND status != Done AND priority IN (critical, high)
created >= -7d AND type = bug AND project = ALPHA
sprint IN openSprints() AND label = "backend"
```

**İmplementasyon yaklaşımı:**
- Parser: PEG.js veya hand-written recursive descent
- AST → SQL where clause dönüşümü
- Autocomplete: `project`, `assignee`, `status`, `sprint` değerleri dinamik
- Hata mesajları satır+sütun bazlı

---

## Audit Log & Issue Geçmişi

### Mevcut audit.ts Pattern

`audit.ts` mevcut kullanımı: auth event'leri (login, logout, register vb.).

Issue geçmişi için aynı pattern uygulanır ama ayrı `issue_history` tablosuna yazılır (üretim verisini audit logdan ayırmak için):

```typescript
// storage/projects.ts
export async function logIssueHistory(
  issueId:    string,
  changedBy:  string,
  fieldName:  string,
  oldValue:   string | null,
  newValue:   string | null
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO issue_history (issue_id, changed_by, field_name, old_value, new_value)
       VALUES ($1, $2, $3, $4, $5)`,
      [issueId, changedBy, fieldName, oldValue, newValue]
    );
  } catch {
    // Audit failure asla ana işlemi kırmamalı (audit.ts pattern'ı)
  }
}
```

### Ne Zaman Log Atılır

```typescript
// routes/projects.ts — issue güncelleme handler'ında
const TRACKED_FIELDS = ["title", "status_id", "assignee_id", "priority", "due_date",
                        "sprint_id", "estimated_hours", "issue_type"] as const;

async function trackChanges(issueId: string, userId: string,
    oldIssue: Issue, updates: UpdateIssueInput): Promise<void> {
  const promises: Promise<void>[] = [];

  if (updates.statusId && updates.statusId !== oldIssue.statusId) {
    promises.push(logIssueHistory(issueId, userId, "status",
      oldIssue.statusName, await getStatusName(updates.statusId)));
  }
  if (updates.assigneeId !== undefined && updates.assigneeId !== oldIssue.assigneeId) {
    promises.push(logIssueHistory(issueId, userId, "assignee",
      oldIssue.assigneeName, updates.assigneeId ? await getUserName(updates.assigneeId) : null));
  }
  if (updates.priority && updates.priority !== oldIssue.priority) {
    promises.push(logIssueHistory(issueId, userId, "priority", oldIssue.priority, updates.priority));
  }
  if (updates.title && updates.title !== oldIssue.title) {
    promises.push(logIssueHistory(issueId, userId, "title", oldIssue.title, updates.title));
  }
  if (updates.dueDate !== undefined && updates.dueDate !== oldIssue.dueDate) {
    promises.push(logIssueHistory(issueId, userId, "due_date",
      oldIssue.dueDate, updates.dueDate));
  }
  if (updates.sprintId !== undefined && updates.sprintId !== oldIssue.sprintId) {
    promises.push(logIssueHistory(issueId, userId, "sprint",
      oldIssue.sprintName, updates.sprintId ? await getSprintName(updates.sprintId) : "Backlog"));
  }

  await Promise.all(promises);
}
```

### Issue Geçmişi API

```
GET /api/projects/:id/issues/:issueId/history
  Auth: üye
  Resp: IssueHistoryEntry[]
  {
    id, fieldName, oldValue, newValue, changedAt,
    changedBy: { id, username, avatarUrl }
  }
```

### Frontend — IssueHistory.tsx

```tsx
function IssueHistory({ history }: { history: IssueHistoryEntry[] }) {
  return (
    <div className="space-y-2 mt-4">
      <h4 className="text-xs font-medium text-text-tertiary uppercase tracking-wide">Geçmiş</h4>
      {history.map(entry => (
        <div key={entry.id} className="flex items-start gap-2 text-xs">
          <UserAvatar user={entry.changedBy} size={20} />
          <div className="flex-1">
            <span className="font-medium">{entry.changedBy.username}</span>
            {" "}
            {entry.fieldName === "status" && (
              <>durumu değiştirdi: <span className="text-text-tertiary line-through">{entry.oldValue}</span> → <span className="font-medium">{entry.newValue}</span></>
            )}
            {entry.fieldName === "assignee" && (
              <>atamayı değiştirdi: <span>{entry.newValue ?? "Atanmamış"}</span></>
            )}
            {entry.fieldName === "priority" && (
              <>önceliği güncelledi: <PriorityBadge priority={entry.newValue as Priority} size="xs" /></>
            )}
            {/* diğer alanlar... */}
          </div>
          <span className="text-text-tertiary whitespace-nowrap">{formatRelativeTime(entry.changedAt)}</span>
        </div>
      ))}
    </div>
  );
}
```

---

## Özet: Arama & Audit Faz Dağılımı

| Özellik | Faz | Bağımlılık |
|---------|-----|-----------|
| Issue full-text arama (ILIKE) | 1 | pg_trgm (mevcut) |
| Board filtresi (assignee, priority, type) | 1 | — |
| Global search'e issue ekleme | 1 | mevcut search.ts |
| Issue geçmiş log (issue_history) | 1 | issue_history tablosu |
| Gelişmiş filtre URL state | 2 | — |
| @mention notification | 2 | issue_comments tablo |
| Kaydedilmiş görünümler | 3 | saved_views tablosu |
| JQL-benzeri sorgu dili | 4 | query parser |
