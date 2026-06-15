# GMD Project Management — Mimari Genel Bakış

> Jira-inspired proje ve görev yönetimi katmanı. GMD'nin kişisel görev takip altyapısı **tamamen korunur**;
> bu özellik onun üstüne bir takım katmanı olarak eklenir.

---

## Modül Dizini

| # | Modül | İçerik |
|---|-------|--------|
| [01](./01-database.md) | **Database** | Tüm tablo şemaları, migration planı, faz bazlı eklentiler |
| [02](./02-redis-realtime.md) | **Redis & Real-time** | Cache, bildirim kuyruğu, SSE, WebSocket upgrade |
| [03](./03-api.md) | **API Spec** | Tüm endpoint'ler, auth kuralları, response tipleri |
| [04](./04-frontend.md) | **Frontend** | Route'lar, page'ler, component'ler, hook'lar, UI wireframe |
| [05](./05-issues-workflows.md) | **Issues & Workflows** | Issue tipleri, hiyerarşi, workflow state machine, linking |
| [06](./06-boards-sprints.md) | **Boards & Sprints** | Kanban, Scrum, sprint lifecycle, drag-and-drop |
| [07](./07-rbac.md) | **RBAC** | Roller, yetki matrisi, middleware, granüler izinler |
| [08](./08-search-audit.md) | **Arama & Audit** | Filtre sistemi, full-text search, değişiklik geçmişi |
| [09](./09-integrations.md) | **Entegrasyonlar** | Webhook, dış API, GitHub, Slack (Phase 4) |
| [10](./10-roadmap.md) | **Yol Haritası** | Fazlar, öncelikler, sprint planı, bağımlılıklar |
| [11](./11-tests.md) | **Test Planı** | Test senaryoları — kullanıcı tarafından doldurulacak |
| [12](./12-improvements.md) | **İyileştirmeler & Teknik Borç** | 24 madde: güvenlik açıkları, performans, UX, mimari — şimdi/sonra ayrımıyla |

---

## Onaylanmış Kararlar

| # | Konu | Karar | Etki |
|---|------|-------|------|
| 1 | Issue silme | **Soft delete** — `archived=true`, DB'den hiç silinmez. Geri alınabilir. | `DELETE /issues` → `PATCH archived=true` |
| 2 | Atanmamış issue | **NULL izin verilir** — unassigned issue'lar board'da status sütununda görünür, ayrı kolon yok | `assignee_id` nullable kalır |
| 3 | DayView completion sync | **`category='done'` olan en düşük sort_order'lı statüs** — proje hangi statüsü "done" olarak işaretlemişse oraya geç | plan.ts entegrasyonu |
| 4 | Project key | **Oluşturulduktan sonra değiştirilemez** — issue key'ler bozulur. Settings'de read-only gösterilir | ProjectSettings UI |
| 5 | Reporter açabileceği tipler | **task + bug** — epic, story, sub_task açamaz; sprint yönetemez | RBAC matrisi güncellendi |
| 6 | Board type değişikliği | **Değiştirilebilir** (admin/owner) — Kanban→Scrum'da issue'lar backlog'a düşer; sprint'ler silinmez, kanban'da gizlenir | ProjectSettings |
| 7 | Max üye/proje | **50 üye** | rate limiting + DB count check |
| 8 | Durum değişikliği bildirimi | **Sadece `category='done'`'a geçişte** assignee'ye bildirim — diğer geçişler sessiz | scheduler notification logic |
| 9 | Mobil tab bar | **Search header'a taşınır** — Tab bar: Home / Week / Cal / Projects / Stats (5 item) | Layout.tsx |
| 10 | "Planıma Ekle" varsayılan tarih | **Bugün**, `due_date` varsa önerilir ama değiştirilebilir | AddToPlanModal |
| 11 | DayView banner tıklaması | **Tek proje varsa** o projenin board'u; **birden fazlaysa** `/projects?filter=assigned` | DayViewProjectBanner |

---

## Terminoloji

| Eski (GROUPS_PLAN.md) | Yeni | Açıklama |
|-----------------------|------|----------|
| group | **project** | Organizasyon birimi — key ("ALPHA", "GMD") ile |
| group_members | **project_members** | Rol sistemi genişledi |
| group_tasks | **issues** | Tam Jira-like issue yönetimi |
| — | **workflow_statuses** | Proje başına özelleştirilebilir |
| — | **sprints** | Scrum sprint'leri |

---

## Feature Öncelik Matrisi

| Özellik | Faz | Zorluk | Açıklama |
|---------|-----|--------|----------|
| Proje oluşturma & üye yönetimi | **1 – MVP** | Düşük | Temel grup altyapısı |
| Issues (task, bug) oluşturma | **1 – MVP** | Düşük | Temel CRUD |
| Yorumlar & @mention | **1 – MVP** | Düşük | audit.ts genişletilir |
| Temel Kanban board (To Do / In Progress / Done) | **1 – MVP** | Orta | 3 sabit sütun |
| SSE real-time (board güncellemeleri) | **1 – MVP** | Orta | Redis pub/sub var |
| Bildirim kuyruğu (atama push+email) | **1 – MVP** | Orta | Scheduler'a eklenir |
| DayView entegrasyonu ("Planıma Ekle") | **1 – MVP** | Düşük | plan_item_id FK |
| Issue tipleri hiyerarşisi (Epic→Story→Task→Sub-task) | **2** | Orta | parent_id + epic_id |
| Özelleştirilebilir workflow durumları | **2** | Orta | workflow_statuses tablosu |
| Issue linking (blocks, relates to, duplicates) | **2** | Düşük | issue_links tablosu |
| Labels & etiketleme | **2** | Düşük | TEXT[] kolonu |
| Değişiklik geçmişi (issue history) | **2** | Düşük | audit.ts pattern ile |
| Gelişmiş filtre & arama | **2** | Orta | pg_trgm + JSONB |
| Sprint yönetimi (Scrum) | **3** | Yüksek | sprints tablosu + backlog |
| Drag-and-drop Kanban board | **3** | Yüksek | Framer Motion Reorder |
| Dosya eklentileri (attachments) | **3** | Orta | S3/MinIO veya DB blob |
| Özel alanlar (custom fields) | **3** | Yüksek | JSONB schema + UI form builder |
| Kaydedilmiş görünümler (saved views) | **3** | Orta | JSONB filter kaydetme |
| WebSocket upgrade (canlı işbirliği) | **3** | Yüksek | socket.io veya native ws |
| Granüler yetki matrisi (RBAC++) | **4** | Yüksek | permissions tablosu |
| Workflow validasyonları & tetikleyiciler | **4** | Yüksek | state machine engine |
| JQL-benzeri sorgu dili | **4** | Yüksek | custom query parser |
| Webhook outbound | **4** | Orta | webhooks tablosu + queue |
| Dış REST API (versiyonlanmış) | **4** | Yüksek | /api/v1/* + api_keys |
| GitHub/GitLab entegrasyonu | **4** | Yüksek | OAuth + repo events |
| Slack/Discord entegrasyonu | **4** | Orta | webhook POST |
| CI/CD pipeline entegrasyonu | **4** | Yüksek | Status update hooks |
| Burndown & velocity grafikleri | **4** | Orta | Sprint data aggregation |

---

## Mimari Öncelik Kararı

**Soru:** Backend esnekliği mi (özel alanlar, workflow) yoksa frontend gerçek zamanlı UX mi (WebSocket, board)?

**Karar: Backend-first, faz bazlı real-time yükseltme.**

**Neden:**
1. Custom fields ve workflow motoru için sağlam bir veri modeli şart — eksik tasarlanırsa sonradan refactor çok maliyetli.
2. SSE (Phase 1-2) zaten mevcut Redis pub/sub ile ücretsiz geliyor ve `task güncellendi / durum değişti` için yeterli.
3. WebSocket Phase 3'te sprint planning ve canlı board işbirliği gerektiğinde eklenir — bu noktada data model oturmuş olacak.
4. Pragmatik: REST + SSE (kanıtlanmış, basit) → WebSocket (gerektiğinde).

---

## Mevcut Altyapıyla Entegrasyon Noktaları

```
GMD Personal Layer                  GMD Team Layer
─────────────────                   ──────────────
DayView / WeekView                  ProjectBoard (Kanban/Scrum)
plan_items                 ←────    issues.plan_item_id (Planıma Ekle)
tasks                               (dokunulmaz)
recurring_tasks                     (dokunulmaz)
scheduler.ts               ←────    processGroupNotifications() eklenir
audit.ts                   ←────    logIssueHistory() aynı pattern
search.ts (pg_trgm)        ←────    issue search aynı altyapı
redis.ts (cacheGet/Set)    ←────    gmd:project:* namespace
```

---

## Hızlı Başlangıç

Phase 1 implementasyonu için geliştirme sırası:
```
Migration 020 → Shared types → storage/projects.ts → routes/projects.ts
→ index.ts mount → api.ts frontend layer → useProject hooks
→ ProjectsPage → ProjectBoard → IssueCard → AssignModal
→ CommentSection → DayView banner
```

Detaylar için → [10-roadmap.md](./10-roadmap.md)
