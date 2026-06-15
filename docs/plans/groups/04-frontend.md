# 04 — Frontend Mimarisi

## Route Yapısı (App.tsx)

```tsx
// Authenticated route'ların altına eklenir:
<Route path="/projects"                          element={<ProjectsPage />} />
<Route path="/project/:projectId"                element={<ProjectPage />} />        {/* board redirect */}
<Route path="/project/:projectId/board"          element={<BoardPage />} />          {/* kanban/scrum */}
<Route path="/project/:projectId/backlog"        element={<BacklogPage />} />        {/* sprint backlog */}
<Route path="/project/:projectId/issue/:key"     element={<IssuePage />} />          {/* ALPHA-1 */}
<Route path="/project/:projectId/settings"       element={<ProjectSettingsPage />} />
<Route path="/project/:projectId/members"        element={<ProjectMembersPage />} />
<Route path="/project/join/:token"               element={<ProjectJoinPage />} />
```

---

## Sayfa Listesi

| Sayfa | Yol | Açıklama |
|-------|-----|----------|
| `ProjectsPage` | `/projects` | Proje listesi + yeni proje oluştur |
| `ProjectPage` | `/project/:id` | Board'a redirect |
| `BoardPage` | `/project/:id/board` | Kanban (Phase 1) veya Scrum board (Phase 3) |
| `BacklogPage` | `/project/:id/backlog` | Sprint backlog + issue listesi (Phase 2-3) |
| `IssuePage` | `/project/:id/issue/:key` | Issue detay, yorumlar, geçmiş |
| `ProjectSettingsPage` | `/project/:id/settings` | Ad, key, board türü, workflow |
| `ProjectMembersPage` | `/project/:id/members` | Üye listesi, davet, rol değiştir |
| `ProjectJoinPage` | `/project/join/:token` | Davet kabul ekranı |

---

## Komponent Ağacı

```
pages/
  ProjectsPage.tsx          — grid: ProjectCard × N + "Yeni Proje" button
  ProjectPage.tsx           — SSE bağlantısı kurar, tab nav (Board/Backlog/Settings)
  BoardPage.tsx             — KanbanBoard veya ScrumBoard switch
  BacklogPage.tsx           — BacklogList + SprintPanel (Phase 3)
  IssuePage.tsx             — IssueHeader + IssueBody + IssueComments + IssueHistory + IssueSidebar
  ProjectSettingsPage.tsx   — tabs: Genel / Workflow / Üyeler / Webhook (Phase 4) / Tehlikeli
  ProjectMembersPage.tsx    — MemberList + InviteModal
  ProjectJoinPage.tsx       — davet bilgisi + kabul butonu

components/
  projects/
    ProjectCard.tsx         — isim, key badge, üye avatar'ları, board türü
    CreateProjectModal.tsx  — ad, proje kodu (2-10 büyük harf), board türü seçimi
    
  board/
    KanbanBoard.tsx         — yatay scroll, status sütunları, issue card'ları
    ScrumBoard.tsx          — aktif sprint header + Kanban görünümü (Phase 3)
    BoardColumn.tsx         — status başlığı + issue listesi + sort_order
    IssueCard.tsx           — issue_key, başlık, öncelik ikonu, kategori, assignee avatar, "Planıma Ekle"
    CreateIssueModal.tsx    — form: başlık, tip, öncelik, assignee, due_date, label
    BoardFilterBar.tsx      — üye, öncelik, tip, label, sprint filtresi
    
  issue/
    IssueHeader.tsx         — key + başlık + durum dropdown + öncelik + assignee
    IssueBody.tsx           — Markdown description + düzenleme modu
    IssueComments.tsx       — CommentList + CommentInput (@mention autocomplete Phase 2)
    IssueHistory.tsx        — zaman çizelgesi: "alice durumu değiştirdi: X → Y"
    IssueSidebar.tsx        — meta: tip, öncelik, label, due_date, sprint, bağlantılı issue'lar
    IssueLinkSection.tsx    — "blokluyor", "ilgili" gruplandırılmış linkler (Phase 2)
    IssueAttachments.tsx    — dosya eklentileri (Phase 3)
    AddToPlanModal.tsx      — tarih + saat seçici + onayla
    
  members/
    MemberList.tsx          — avatar, ad, rol badge, çıkarma butonu
    InviteModal.tsx         — email + rol seçimi
    
  shared/
    PriorityBadge.tsx       — kritik/yüksek/orta/düşük renk badge'i
    IssueTypeBadge.tsx      — epic/story/task/bug/sub_task ikonlu badge
    StatusDropdown.tsx      — workflow status'larını listele + seç
    UserAvatar.tsx          — 24px/32px/40px boyutlu avatar (mevcut pattern)
    MarkdownEditor.tsx      — textarea + preview toggle (react-markdown Phase 2)
    DayViewProjectBanner.tsx — DayView'daki atama banner'ı

hooks/
  useProjects.ts            — queryKey: ["projects"]
  useProject.ts             — queryKey: ["project", projectId]
  useBoard.ts               — queryKey: ["board", projectId, sprintId?]
  useIssue.ts               — queryKey: ["issue", issueKey]
  useIssues.ts              — queryKey: ["issues", projectId, filters]
  useMyAssignments.ts       — queryKey: ["my-assignments"] tüm projelerden
  useProjectMutations.ts    — createProject, updateProject, deleteProject
  useIssueMutations.ts      — createIssue, updateIssue, deleteIssue, moveIssue
  useCommentMutations.ts    — addComment, editComment, deleteComment
  useProjectEvents.ts       — SSE EventSource hook (02-redis-realtime.md'den)
  useSprints.ts             — queryKey: ["sprints", projectId] (Phase 3)
  useSprintMutations.ts     — createSprint, startSprint, completeSprint (Phase 3)
```

---

## Layout Değişiklikleri

```tsx
// Layout.tsx — mobil tab bar: Home / Week / Cal / Projects / Stats (5 item)
// Search mobil header'a taşınır (büyüteç ikonu → /search)
// Desktop nav: mevcut sıraya Projects eklenir

// Mobil tab bar (5 item):
// [Home] [Week] [Cal] [Projects] [Stats]
// Search: mobil header'ın sağ köşesine Search ikonu

<NavItem to="/projects" icon={<Layers size={20} />} label={t("nav.projects")} />
```

---

## KanbanBoard UI Yapısı

```
┌──────────────────────────────────────────────────────────────────────┐
│  [← Projeler]  ALPHA — Takım Panosu  │  [Sprint Alpha-1 ▼]  [+ Issue]│
│  Filtre: [Herkes ▼] [Tüm Tipler ▼] [Öncelik ▼]              🔴🟡🟢 │
├───────────────────┬───────────────────┬──────────────┬───────────────┤
│  Yapılacak (4)    │  Devam Ediyor (2) │  İnceleme (1)│  Tamamlandı(7)│
│  ──────────────   │  ──────────────   │  ──────────  │  ──────────── │
│  ┌─────────────┐  │  ┌─────────────┐  │  ┌─────────┐ │  ...          │
│  │ ALPHA-12    │  │  │ ALPHA-8     │  │  │ ALPHA-3 │ │               │
│  │ API endp.   │  │  │ DB migrasyon│  │  │ PR rev. │ │               │
│  │ 🔴 bug  @bob│  │  │ 🟡 task @al │  │  │ 🟢 task │ │               │
│  └─────────────┘  │  └─────────────┘  │  └─────────┘ │               │
│  [+ Kart Ekle ]   │                   │              │               │
└───────────────────┴───────────────────┴──────────────┴───────────────┘
Mobil: yatay scroll (min-w-[260px] per column)
```

**IssueCard içeriği:**
- Sol: öncelik renk çubuğu (3px border-l)
- İçerik: `ALPHA-12` key chip, başlık (2 satır truncate), assignee avatar (sağ alt)
- Alt: tip badge, kategori chip, tarih (kırmızı = gecikmişse)
- Hover: "Planıma Ekle" butonu belirir (sadece assignee ise)

---

## IssuePage Düzeni

```
┌──────────────────────────────────────────────────────────────────────┐
│ [← Board]  ALPHA-12  🔴  bug                                         │
│ API endpoint hata veriyor                              [Arşivle] [⋮] │
├─────────────────────────────────────┬────────────────────────────────┤
│  Açıklama                           │  Atanan:    @bob               │
│  ──────────                         │  Durum:     [Devam Ediyor ▼]   │
│  Markdown içerik (tıkla → düzenle)  │  Öncelik:   🔴 Kritik          │
│                                     │  Tip:       🐛 Bug             │
│  Yorumlar (3)                       │  Sprint:    Alpha-1            │
│  ───────────                        │  Bitiş:     15 Nis 2025        │
│  @alice: Bu PR'da düzeltildi...     │  Etiket:    [backend] [api]    │
│  @bob: Test ettim, geçiyor          │                                │
│  ─ Yorum Yaz ─────────────────      │  İlişkiler                     │
│  [                              ]   │  Blokluyor: ALPHA-10           │
│  [Gönder]                           │  İlgili:    ALPHA-7            │
│                                     │                                │
│  Geçmiş                             │  [Planıma Ekle]                │
│  ───────                            │                                │
│  bob durumu değiştirdi: Yapılacak → │                                │
│  alice atandı (önce: bob)           │                                │
└─────────────────────────────────────┴────────────────────────────────┘
```

---

## DayView Entegrasyonu (Minimal Dokunuş)

```tsx
// DayView.tsx'in en üstüne 2 satır eklenir:
import { DayViewProjectBanner } from "@/components/projects/DayViewProjectBanner";
// ...JSX içinde:
<DayViewProjectBanner date={date} />

// DayViewProjectBanner.tsx
function DayViewProjectBanner({ date }: { date: string }) {
  const { data } = useMyAssignments(date);          // /api/projects/my-assignments?date=
  const navigate = useNavigate();
  const unplanned = (data ?? []).filter((i) => !i.planItemId);
  if (!unplanned.length) return null;

  // Tek proje → board'una git; birden fazla proje → /projects?filter=assigned
  const projectIds = [...new Set(unplanned.map((i) => i.projectId))];
  const destination = projectIds.length === 1
    ? `/project/${projectIds[0]}/board`
    : `/projects?filter=assigned`;

  return (
    <div className="card border-l-4 border-accent flex items-center gap-3 mb-2">
      <Layers size={16} className="text-accent flex-shrink-0" />
      <span className="text-sm flex-1 text-text-secondary">
        {unplanned.length} atanmış proje görevi planınızda değil
      </span>
      <button onClick={() => navigate(destination)} className="text-xs text-accent">
        Görüntüle →
      </button>
    </div>
  );
}
```

`DayView.tsx`'e 2 satır ekleme. Başka değişiklik yok.

---

## State Yönetimi

| Veri | Yöntem |
|------|--------|
| Sunucu state (projeler, issue'lar, board) | React Query (useQuery + useMutation) |
| Board filter state (aktif filtreler) | `useState` veya URL search params |
| Issue düzenleme modu | `useState` (local, sunucuya gerek yok) |
| SSE bağlantısı | `useEffect` (useProjectEvents hook) |
| Toast bildirimler | Mevcut notification sistemi |

**Optimistic Update Örneği (status değişimi):**
```typescript
// useIssueMutations.ts
updateStatus: useMutation({
  mutationFn: (vars) => api.updateIssueStatus(projectId, vars.issueId, vars.statusId),
  onMutate: async (vars) => {
    await qc.cancelQueries({ queryKey: ["board", projectId] });
    const prev = qc.getQueryData(["board", projectId]);
    qc.setQueryData(["board", projectId], (old) =>
      moveIssueInBoard(old, vars.issueId, vars.statusId)
    );
    return { prev };
  },
  onError: (_, __, ctx) => qc.setQueryData(["board", projectId], ctx!.prev),
  onSettled: () => qc.invalidateQueries({ queryKey: ["board", projectId] }),
})
```

---

## i18n Anahtarları (TR/EN)

```typescript
// TR
"projects.title":          "Projeler",
"projects.new":            "Yeni Proje",
"projects.empty":          "Henüz bir projeye dahil değilsiniz",
"projects.board":          "Pano",
"projects.backlog":        "Backlog",
"projects.settings":       "Proje Ayarları",
"projects.members":        "Üyeler ({count})",
"projects.invite":         "Üye Davet Et",
"projects.createIssue":    "Görev Oluştur",
"projects.assignTo":       "Atanacak kişi",
"projects.addToPlan":      "Planıma Ekle",
"projects.inPlan":         "Planında ({date})",
"projects.noIssues":       "Bu sütunda görev yok",
"projects.issueKey":       "#{key}",
"projects.priority.critical": "Kritik",
"projects.priority.high":     "Yüksek",
"projects.priority.medium":   "Orta",
"projects.priority.low":      "Düşük",
"projects.type.epic":         "Epic",
"projects.type.story":        "Hikaye",
"projects.type.task":         "Görev",
"projects.type.bug":          "Hata",
"projects.type.sub_task":     "Alt Görev",
"projects.sprint.start":      "Sprint Başlat",
"projects.sprint.complete":   "Sprint Bitir",
"projects.sprint.planning":   "Planlama",
"projects.banner":         "{count} atanmış proje görevi planınızda değil",
```
