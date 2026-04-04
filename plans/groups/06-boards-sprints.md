# 06 — Boards & Sprint Yönetimi

## Kanban Board (Phase 1)

### Veri Modeli

```typescript
// BoardData response tipi
interface BoardData {
  statuses: WorkflowStatus[];
  columns: Record<string, {        // statusId → column
    status: WorkflowStatus;
    issues: Issue[];               // sort_order ile sıralı
  }>;
  members: ProjectMember[];        // filter autocomplete için
  sprint?: Sprint;                 // scrum board ise aktif sprint
}
```

**DB Sorgusu (getBoardDataFromDB):**
```sql
SELECT
  i.*,
  u_a.username  AS assignee_name,
  u_a.avatar_url AS assignee_avatar,
  u_r.username  AS reporter_name,
  ws.name       AS status_name,
  ws.color      AS status_color,
  ws.category   AS status_category,
  ws.sort_order AS status_sort
FROM issues i
JOIN workflow_statuses ws ON ws.id = i.status_id
LEFT JOIN users u_a ON u_a.id = i.assignee_id
LEFT JOIN users u_r ON u_r.id = i.reporter_id
WHERE i.project_id = $1
  AND i.archived   = FALSE
  AND ($2::uuid IS NULL OR i.sprint_id = $2)  -- scrum: sprint_id; kanban: NULL
ORDER BY ws.sort_order, i.sort_order
```

### Filtreleme (Client-side, Phase 1)

Board filtresi: mevcut BoardData üzerinden client-side filter (büyük projeler için Phase 2'de server-side'a geç):

```typescript
// useBoard.ts
const filtered = useMemo(() => {
  if (!board) return board;
  return {
    ...board,
    columns: Object.fromEntries(
      Object.entries(board.columns).map(([sid, col]) => [
        sid,
        {
          ...col,
          issues: col.issues.filter((i) =>
            (!filters.assignee || i.assigneeId === filters.assignee) &&
            (!filters.priority || i.priority === filters.priority) &&
            (!filters.type     || i.issueType === filters.type) &&
            (!filters.label    || i.labels.includes(filters.label))
          ),
        },
      ])
    ),
  };
}, [board, filters]);
```

### Issue Sıralama (sort_order)

Yeni issue ekleme: `MAX(sort_order) + 1` olan kolona eklenir.

Phase 3'te drag-and-drop: `PATCH /api/projects/:id/issues/reorder` ile sort_order güncellenir.

---

## Drag-and-Drop (Phase 3)

Mevcut `plan.ts` sıralama pattern'ı (`reorderPlan`) Kanban'a uyarlanır:

```typescript
// Phase 3: Framer Motion Reorder veya @dnd-kit/core
// Mevcut WeekView sürükleme altyapısı referans alınır

// Optimistic update:
onMutate: async ({ issueId, toStatusId, newOrder }) => {
  await qc.cancelQueries({ queryKey: ["board", projectId] });
  const prev = qc.getQueryData(["board", projectId]);
  qc.setQueryData(["board", projectId], (old) =>
    moveIssueToColumn(old, issueId, toStatusId, newOrder)
  );
  return { prev };
},
onError: (_, __, ctx) => qc.setQueryData(["board", projectId], ctx!.prev),
onSettled: () => qc.invalidateQueries({ queryKey: ["board", projectId] }),
```

**Taşıma Kuralı:** Issue farklı sütuna taşındığında `status_id` de otomatik güncellenir.

---

## Scrum Board (Phase 3)

Kanban Board'dan farkı:
1. Üstte aktif sprint bilgisi (ad, tarih, kalan gün, tamamlanma %)
2. Sadece aktif sprint'teki issue'lar gösterilir
3. "Backlog" butonu → BacklogPage'e gider
4. Sprint başlat/bitir aksiyonları

```tsx
// ScrumBoard.tsx
function SprintHeader({ sprint }: { sprint: Sprint }) {
  const daysLeft = differenceInDays(new Date(sprint.endDate), new Date());
  const totalIssues = Object.values(columns).flatMap(c => c.issues).length;
  const doneIssues = columns["done"]?.issues.length ?? 0;

  return (
    <div className="card flex items-center gap-4 mb-4">
      <div className="flex-1">
        <span className="font-semibold">{sprint.name}</span>
        <span className="text-xs text-text-tertiary ml-2">
          {daysLeft > 0 ? `${daysLeft} gün kaldı` : "Süre doldu"}
        </span>
      </div>
      <ProgressBar value={doneIssues} max={totalIssues} />
      <span className="text-sm">{doneIssues}/{totalIssues}</span>
      <button onClick={completeSprint} className="btn-secondary text-xs">Sprint Bitir</button>
    </div>
  );
}
```

---

## Sprint Lifecycle

```
[Yeni Sprint Oluştur] → status: "planning"
         ↓
[Backlog'dan Issue Ekle] → sprint_id = sprintId
         ↓
[Sprint Başlat] → status: "active", start_date = NOW()
         ↓
[Sprint Süresi Boyunca Çalış]
         ↓
[Sprint Bitir] → status: "completed", completed_at = NOW()
               → Tamamlanmamış issue'lar:
                 a) Backlog'a geri dön (sprint_id = NULL)
                 b) Yeni sprint'e taşı (sprint_id = newSprintId)
```

**Kural:** Proje başına en fazla 1 aktif sprint (DB EXCLUDE constraint ile garantilenir).

### Sprint Başlatma (routes/projects.ts)

```typescript
router.post("/:id/sprints/:sprintId/start", isAdmin, wrap(async (req, res) => {
  // Aktif sprint var mı?
  const { rows: [active] } = await pool.query(
    "SELECT id FROM sprints WHERE project_id=$1 AND status='active'", [req.params.id]
  );
  if (active) return res.status(409).json({ error: "Zaten aktif bir sprint var" });

  const { rows: [sprint] } = await pool.query(`
    UPDATE sprints SET status='active', start_date=COALESCE(start_date, CURRENT_DATE)
    WHERE id=$1 AND project_id=$2 AND status='planning'
    RETURNING *
  `, [req.params.sprintId, req.params.id]);

  if (!sprint) return res.status(404).json({ error: "Sprint bulunamadı" });

  await invalidateBoardCache(req.params.id);
  await publishProjectEvent(req.params.id, { type: "sprint_started", sprint });
  res.json(sprint);
}));
```

### Sprint Bitirme

```typescript
router.post("/:id/sprints/:sprintId/complete", isAdmin, wrap(async (req, res) => {
  const { moveUnfinishedTo } = req.body;  // "backlog" | sprintId

  // Tamamlanmamış issue'ları taşı
  const doneCategoryStatuses = await pool.query(
    "SELECT id FROM workflow_statuses WHERE project_id=$1 AND category='done'", [req.params.id]
  );
  const doneIds = doneCategoryStatuses.rows.map(r => r.id);

  const newSprintId = moveUnfinishedTo === "backlog" ? null : moveUnfinishedTo;
  await pool.query(`
    UPDATE issues SET sprint_id=$1
    WHERE sprint_id=$2 AND status_id != ALL($3::uuid[])
  `, [newSprintId, req.params.sprintId, doneIds]);

  const { rows: [sprint] } = await pool.query(`
    UPDATE sprints SET status='completed', completed_at=NOW()
    WHERE id=$1 RETURNING *
  `, [req.params.sprintId]);

  await invalidateBoardCache(req.params.id, req.params.sprintId);
  await publishProjectEvent(req.params.id, { type: "sprint_completed", sprint });
  res.json(sprint);
}));
```

---

## Backlog (Phase 2–3)

BacklogPage'de iki panel:
1. **Sprint listesi** (sol) — planning/active/completed sprint'ler
2. **Issue listesi** (sağ) — seçilen sprint veya backlog issue'ları

```tsx
// BacklogPage.tsx
function BacklogPage() {
  const { data: sprints } = useSprints(projectId);
  const [selected, setSelected] = useState<string | "backlog">("backlog");
  const { data: issues } = useIssues(projectId, { sprint: selected });

  return (
    <div className="flex gap-4">
      <div className="w-64 space-y-2">
        <button onClick={() => setSelected("backlog")} className={cn("w-full card text-left", selected === "backlog" && "border-accent")}>
          Backlog ({backlogCount})
        </button>
        {sprints?.map(s => (
          <SprintPanel key={s.id} sprint={s} selected={selected === s.id} onSelect={() => setSelected(s.id)} />
        ))}
        <button className="btn-secondary w-full">+ Sprint Oluştur</button>
      </div>
      <div className="flex-1">
        <IssueList issues={issues ?? []} />
      </div>
    </div>
  );
}
```

---

## Burndown & Velocity (Phase 4)

*Post-MVP. Referans için:*

**Burndown:** Her gün için kalan story point toplamı. `sprint_daily_snapshots` tablosu ile günlük snapshot alınabilir veya issue_history'den hesaplanabilir.

**Velocity:** Son N sprint'teki tamamlanan story point ortalaması. `sprints.completed_at` + issue geçmişi sorgusu ile hesaplanır.

```sql
-- Velocity hesabı (Phase 4):
SELECT
  s.name,
  SUM((i.custom_fields->>'story_points')::int) AS completed_points
FROM sprints s
JOIN issues i ON i.sprint_id = s.id
JOIN workflow_statuses ws ON ws.id = i.status_id AND ws.category = 'done'
WHERE s.project_id = $1 AND s.status = 'completed'
GROUP BY s.id, s.name
ORDER BY s.completed_at DESC
LIMIT 5;
```
