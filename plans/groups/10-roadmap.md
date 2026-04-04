# 10 — Geliştirme Yol Haritası

## Faz Genel Bakışı

| Faz | Ad | Süre | Çıktı |
|-----|-----|------|-------|
| **1** | MVP — Proje + Temel Board | ~10 gün | Proje oluştur, issue aç, kanban board, SSE, bildirim |
| **2** | Issue Tracker | ~8 gün | Issue tipleri, linking, @mention, geçmiş, filtre |
| **3** | Agile Boards | ~12 gün | Sprint, drag-and-drop, custom fields, saved views, attachments |
| **4** | Enterprise | sürekli | RBAC++, webhook, dış API, GitHub/Slack |

---

## Phase 1 — MVP (10 Gün)

### Sprint 1A — Backend (4 gün)

| # | Görev | Dosya(lar) | Zorluk |
|---|-------|-----------|--------|
| 1 | Migration 020: projects, project_members, project_invitations, workflow_statuses, issues, issue_comments, issue_history, project_issue_counters | `migrations/020_projects.sql` | Orta |
| 2 | Shared types: Project, Issue, Comment, WorkflowStatus, ProjectRole, CreateIssueInput... | `packages/shared/src/index.ts` | Düşük |
| 3 | `storage/projects.ts`: tüm CRUD + Redis cache + logIssueHistory | `packages/server/src/storage/projects.ts` | Yüksek |
| 4 | `redis.ts` genişletme: subscribeProjectEvents, publishProjectEvent, getPMSubscriber | `packages/server/src/redis.ts` | Düşük |
| 5 | `routes/projects.ts`: proje CRUD + üye + davet + SSE | `packages/server/src/routes/projects.ts` | Yüksek |
| 6 | `index.ts`: route mount + rate limiter | `packages/server/src/index.ts` | Düşük |
| 7 | `scheduler.ts`: processProjectNotifications() | `packages/server/src/scheduler.ts` | Orta |
| 8 | `email.ts`: sendProjectInvitationEmail, sendProjectNotificationEmail | `packages/server/src/email.ts` | Düşük |

### Sprint 1B — Issue API (2 gün)

| # | Görev | Zorluk |
|---|-------|--------|
| 9 | Issue CRUD endpoints (create + next_issue_number, update, delete) | Orta |
| 10 | Issue status change + issue_history log | Düşük |
| 11 | Comment CRUD | Düşük |
| 12 | Board endpoint (GET /board, Redis cached) | Orta |
| 13 | enqueueProjectNotification + DB fallback | Düşük |

### Sprint 1C — Frontend (4 gün)

| # | Görev | Dosya(lar) | Zorluk |
|---|-------|-----------|--------|
| 14 | api.ts: tüm proje API metodları | `packages/web/src/lib/api.ts` | Düşük |
| 15 | useProjects, useProject, useBoard, useIssueMutations, useProjectEvents hooks | `hooks/` | Orta |
| 16 | ProjectsPage + ProjectCard + CreateProjectModal | `pages/ProjectsPage.tsx` | Düşük |
| 17 | BoardPage + KanbanBoard + BoardColumn + IssueCard | `pages/BoardPage.tsx` + `components/board/` | Yüksek |
| 18 | CreateIssueModal | `components/board/CreateIssueModal.tsx` | Orta |
| 19 | IssuePage: header + description + sidebar + CommentSection + IssueHistory | `pages/IssuePage.tsx` | Yüksek |
| 20 | ProjectMembersPage + InviteModal | `pages/ProjectMembersPage.tsx` | Orta |
| 21 | ProjectJoinPage | `pages/ProjectJoinPage.tsx` | Düşük |
| 22 | AddToPlanModal + DayViewProjectBanner (DayView'e 2 satır ekleme) | `components/` | Düşük |
| 23 | Layout.tsx nav item + App.tsx route'lar | `Layout.tsx`, `App.tsx` | Düşük |
| 24 | i18n anahtarları (TR + EN) | `lib/i18n.tsx` | Düşük |

**Phase 1 Teslim Kriteri:**
- ✅ Proje oluştur, üye davet et
- ✅ Issue aç (task, bug), kanban board'da görüntüle
- ✅ Issue durumunu değiştir, sütunlar arası taşı (sort_order güncellemesi)
- ✅ Yorum yaz
- ✅ Issue'yu kişisel planıma ekle
- ✅ SSE ile canlı board güncellemesi
- ✅ Atama bildirimi (push + email)
- ✅ DayView'da "X atanmış proje görevi" banner'ı

---

## Phase 2 — Issue Tracker (8 Gün)

| # | Görev | Faz | Zorluk |
|---|-------|-----|--------|
| 1 | Migration 021: issue_links tablosu + pg_trgm issue index | `021_issue_links.sql` | Düşük |
| 2 | Issue linking API + karşılıklı link oluşturma | storage + route | Orta |
| 3 | Issue tip hiyerarşisi: parent_id, epic_id kullanımı + UI | — | Orta |
| 4 | Label ekleme/çıkarma + autocomplete API | — | Düşük |
| 5 | @mention parse + comment bildirim kuyruğu | comment route | Orta |
| 6 | Gelişmiş arama (çoklu filtre, URL state) | route + frontend | Orta |
| 7 | Global search'e issue sonuçları (SearchPage güncelleme) | search.ts + SearchPage | Düşük |
| 8 | Workflow status ekle/güncelle/sil UI | ProjectSettingsPage | Orta |
| 9 | IssueLinkSection component | IssuePage | Düşük |
| 10 | BoardFilterBar ile client-side filtre | BoardPage | Düşük |
| 11 | Issue geçmişi zaman çizelgesi UI iyileştirmesi | IssueHistory | Düşük |
| 12 | Issue arşivleme + archived issue listesi | — | Düşük |

**Phase 2 Bağımlılıkları:** Phase 1 tamamlanmış olmalı.

---

## Phase 3 — Agile Boards (12 Gün)

| # | Görev | Zorluk |
|---|-------|--------|
| 1 | Migration 022: sprints, sprint_issue_order tabloları | Düşük |
| 2 | Sprint CRUD + start/complete API | Orta |
| 3 | BacklogPage (sprint listesi + backlog issue'ları) | Orta |
| 4 | ScrumBoard component (aktif sprint header + kanban) | Orta |
| 5 | Sprint planning: backlog → sprint issue taşıma UI | Orta |
| 6 | Drag-and-drop kanban (Framer Motion Reorder veya @dnd-kit) | Yüksek |
| 7 | Migration 023: issue_attachments | Düşük |
| 8 | Dosya yükleme API + frontend AttachmentSection | Orta |
| 9 | Migration 024: custom_field_definitions | Düşük |
| 10 | Custom field UI: proje ayarlarında alan tanımla | Yüksek |
| 11 | Custom field değerlerini issue formunda göster/düzenle | Yüksek |
| 12 | Migration 025: saved_views | Düşük |
| 13 | Kaydedilmiş görünüm oluştur/uygula/sil UI | Orta |
| 14 | WebSocket upgrade (socket.io + Redis adapter) | Yüksek |
| 15 | Markdown editor (description için react-markdown + preview) | Orta |

**Phase 3 Bağımlılıkları:** Phase 2 tamamlanmış olmalı.

---

## Phase 4 — Enterprise (Sürekli)

| # | Görev | Zorluk | Öncelik |
|---|-------|--------|---------|
| 1 | Migration 026: webhooks, api_keys | Düşük | Yüksek |
| 2 | Webhook CRUD + delivery queue (scheduler) | Yüksek | Yüksek |
| 3 | Dış REST API v1 + api_keys auth middleware | Yüksek | Yüksek |
| 4 | GitHub webhook entegrasyonu | Yüksek | Orta |
| 5 | Slack Incoming Webhook (mevcut webhook sistemi) | Düşük | Orta |
| 6 | Granüler RBAC: project_permissions tablosu + UI | Yüksek | Düşük |
| 7 | Workflow transition kuralları + validasyon | Yüksek | Düşük |
| 8 | JQL-benzeri sorgu dili | Yüksek | Düşük |
| 9 | Burndown grafikleri (sprint stats) | Orta | Düşük |
| 10 | Velocity grafikleri | Orta | Düşük |
| 11 | Slack Slash Command | Yüksek | Düşük |
| 12 | CI/CD entegrasyonu (API üzerinden) | Orta | Orta |

---

## Öncelik Matrisi (Tüm Fazlar)

```
YüKSEK ETKİ + DÜŞÜK ZORLUK = ŞİMDİ YAP (Phase 1-2)
─────────────────────────────────────────────────────
✅ Proje oluşturma + üye yönetimi
✅ Temel issue CRUD (task + bug)
✅ Kanban board (3 sabit sütun)
✅ SSE real-time
✅ Bildirim kuyruğu (Redis)
✅ DayView entegrasyonu
✅ Issue geçmişi
✅ @mention notification
✅ Issue linking
✅ Label sistemi

YüKSEK ETKİ + ORTA ZORLUK = PLAN YAP (Phase 2-3)
─────────────────────────────────────────────────────
🔜 Sprint yönetimi
🔜 Drag-and-drop board
🔜 Custom fields
🔜 Gelişmiş filtre

ORTA ETKİ + YÜKSEK ZORLUK = DEĞERLENDIR (Phase 4)
─────────────────────────────────────────────────────
💤 Webhook sistemi
💤 Dış API
💤 GitHub entegrasyonu
💤 Granüler RBAC

DÜŞÜK ETKİ + YÜKSEK ZORLUK = SONRA (Phase 4+)
─────────────────────────────────────────────────────
⏳ JQL sorgu dili
⏳ Workflow validasyon motoru
⏳ Velocity/burndown grafikler
⏳ Slack slash command
```

---

## Bağımlılık Grafiği

```
Migration 020
    ↓
Storage/projects.ts + Redis extensions
    ↓
Routes/projects.ts (proje + üye + SSE)
    ↓
Routes/projects.ts (issues + comments)
    ↓
Scheduler genişletmesi (bildirimler)
    ↓
Frontend: hooks → pages → board
    ↓
[Phase 1 tamamlandı]
    ↓
Migration 021 (issue_links)
    ↓
[Phase 2 tamamlandı]
    ↓
Migration 022-025 (sprints + custom fields + saved views)
    ↓
[Phase 3 tamamlandı]
    ↓
Migration 026 (webhooks + api_keys)
    ↓
[Phase 4 başlar]
```

---

## Plan.ts Entegrasyonu (Tek Satır — Tüm Fazlarda Geçerli)

```typescript
// packages/server/src/routes/plan.ts — updatePlan handler'ına eklenir:
if (updates.completed !== undefined) {
  // plan_item_id üzerinden ilgili issue'yu da güncelle
  await projectStorage.syncPlanItemCompletion(planItem.id, updates.completed);
}
// Bu tek if bloğu dışında plan.ts hiç değişmez.
```

---

## Notlar

- **plan_items tablosu** hiç değişmez. Tüm mevcut DayView/WeekView/Stats sorguları etkilenmez.
- **Mevcut storage.ts** hiç değişmez. Tüm yeni sorgular `storage/projects.ts`'te.
- **scheduler.ts** sadece 2 fonksiyon eklenerek genişler: `processProjectNotifications()` + `processWebhooks()` (Phase 4).
- **audit.ts** değişmez; `logIssueHistory()` ayrı tablo+fonksiyon, aynı pattern.
- **i18n** her fazda ilgili i18n key'leri `lib/i18n.tsx`'e eklenir.
