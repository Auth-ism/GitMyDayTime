# GMD Project Management — Ana Dizin

> Jira-inspired proje ve görev yönetimi. Detaylı teknik plan `plans/groups/` dizininde modüller halinde.

## Modüller

| Modül | İçerik |
|-------|--------|
| [README](./plans/groups/README.md) | Genel bakış, feature matrisi, terminoloji, mimari karar |
| [01 — Database](./plans/groups/01-database.md) | Tüm tablo şemaları, migration planı (020–026) |
| [02 — Redis & Real-time](./plans/groups/02-redis-realtime.md) | Cache, bildirim kuyruğu, SSE, WebSocket upgrade |
| [03 — API](./plans/groups/03-api.md) | Tüm endpoint'ler, auth, response tipleri |
| [04 — Frontend](./plans/groups/04-frontend.md) | Route'lar, page'ler, component'ler, hook'lar, UI wireframe |
| [05 — Issues & Workflows](./plans/groups/05-issues-workflows.md) | Issue tipleri, hiyerarşi, workflow, linking, @mention |
| [06 — Boards & Sprints](./plans/groups/06-boards-sprints.md) | Kanban, Scrum, sprint lifecycle, drag-and-drop |
| [07 — RBAC](./plans/groups/07-rbac.md) | Roller, yetki matrisi, middleware, granüler izinler |
| [08 — Arama & Audit](./plans/groups/08-search-audit.md) | Filtre sistemi, full-text search, issue geçmişi |
| [09 — Entegrasyonlar](./plans/groups/09-integrations.md) | Webhook, dış API, GitHub, Slack (Phase 4) |
| [10 — Yol Haritası](./plans/groups/10-roadmap.md) | Faz planı, öncelik matrisi, bağımlılık grafiği |

## Özet

- **Phase 1 (~10 gün):** Proje + üye + temel kanban + issue CRUD + SSE + bildirim
- **Phase 2 (~8 gün):** Issue tipleri, linking, @mention, gelişmiş filtre, geçmiş
- **Phase 3 (~12 gün):** Sprint yönetimi, drag-and-drop, custom fields, saved views, WebSocket
- **Phase 4 (sürekli):** Webhook, dış API v1, GitHub, Slack, granüler RBAC, JQL

## Temel Kural

`plan_items` tablosuna **sıfır değişiklik**. `issues.plan_item_id` FK ile bağlantı kurulur.
`storage.ts`'e **sıfır değişiklik**. Tüm yeni sorgular `storage/projects.ts`'te.
`plan.ts`'e **tek if bloğu** eklenerek issue–plan completion sync sağlanır.
