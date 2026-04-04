# 03 — API Spec

Tüm route'lar `/api/projects` altında. `authMiddleware` zaten tüm `/api/*`'ı koruyor.

## Ortak Middleware

```typescript
// routes/projects.ts
const isMember   = requireProjectMembership("member");
const isDev      = requireProjectMembership("developer");
const isAdmin    = requireProjectMembership("admin");
const isOwner    = requireProjectMembership("owner");

// requireProjectMembership → getMemberRole() Redis cached → DB fallback
// req.projectRole set edilir, sonraki handler kullanabilir
```

---

## Projeler

```
POST   /api/projects
  Body: { name, projectKey, description?, boardType?: "kanban"|"scrum" }
  Auth: herhangi giriş yapmış kullanıcı
  Kural: kullanıcı başına max 20 proje; owner olarak eklenir; 4 varsayılan workflow status seed edilir; project_issue_counters başlatılır
  Resp: Project (201)

GET    /api/projects
  Auth: giriş yapmış kullanıcı
  Resp: Project[] (üyesi olduğu tüm projeler + memberCount + myRole)

GET    /api/projects/:id
  Auth: proje üyesi
  Resp: Project + ProjectMember[] + WorkflowStatus[]

PUT    /api/projects/:id
  Body: { name?, description?, boardType? }
  Auth: admin veya owner
  Resp: Project

DELETE /api/projects/:id
  Auth: owner
  Side: CASCADE → project_members, invitations, workflow_statuses, issues, comments, history
  Resp: { ok: true }
```

---

## Üye Yönetimi

```
POST   /api/projects/:id/invitations
  Body: { email, role?: "developer"|"reporter"|"viewer" }
  Auth: admin veya owner
  Kural: MAX 50 üye (SELECT COUNT(*) FROM project_members); zaten üyeyse 409; pending davet varsa token upsert
  Side: sendProjectInvitationEmail(); token Redis cache (7g)
  Resp: { ok: true, expiresAt }

GET    /api/projects/join/:token
  Auth: giriş yapmış kullanıcı
  Kural: token geçerliliği, email eşleşmesi, expire, accepted_at kontrolü
  Side: project_members INSERT; publishProjectEvent("member_joined"); invalidateInviteToken
  Resp: { projectId, projectName }

DELETE /api/projects/:id/leave
  Auth: üye (owner hariç — 400)
  Side: invalidateMemberCache
  Resp: { ok: true }

DELETE /api/projects/:id/members/:userId
  Auth: owner (herkesi) | admin (sadece developer/reporter/viewer)
  Side: invalidateMemberCache
  Resp: { ok: true }

PATCH  /api/projects/:id/members/:userId
  Body: { role: "admin"|"developer"|"reporter"|"viewer" }
  Auth: owner
  Side: invalidateMemberCache
  Resp: ProjectMember

POST   /api/projects/:id/transfer
  Body: { newOwnerId }
  Auth: owner
  Side: TX: yeni owner + eski → admin; invalidateAllMemberCaches
  Resp: { ok: true }
```

---

## Workflow Durumları

```
GET    /api/projects/:id/statuses
  Auth: üye
  Resp: WorkflowStatus[]

POST   /api/projects/:id/statuses      [Phase 2]
  Body: { name, color?, category }
  Auth: admin veya owner
  Resp: WorkflowStatus (201)

PUT    /api/projects/:id/statuses/:sid [Phase 2]
  Body: { name?, color?, category?, sortOrder? }
  Auth: admin veya owner
  Resp: WorkflowStatus

DELETE /api/projects/:id/statuses/:sid [Phase 2]
  Auth: owner
  Kural: son status silinemez; bu statüde issue varsa 409 (önce taşı)
  Resp: { ok: true }

PUT    /api/projects/:id/statuses/reorder [Phase 2]
  Body: { ids: string[] }
  Auth: admin veya owner
  Resp: { ok: true }
```

---

## Issues

```
GET    /api/projects/:id/issues
  Query: ?status=&assignee=&type=&priority=&label=&sprint=&q=&page=&limit=
  Auth: üye
  Resp: { issues: Issue[], total, page, limit }

GET    /api/projects/:id/issues/:issueId
  Auth: üye
  Resp: IssueDetail (issue + comments + history + links + attachments)

POST   /api/projects/:id/issues
  Body: AssignIssueInput
  Auth: developer, admin veya owner  [reporter sadece bug açabilir]
  Side:
    - issue_number = next_issue_number(projectId) — atomik
    - issue_key = project.key + '-' + issue_number
    - status_id = projenin default statüsü
    - enqueueProjectNotification({ type:"issue_assigned", ... }) — assignee varsa
    - publishProjectEvent({ type:"issue_created", payload:issue })
    - invalidateBoardCache(projectId)
  Resp: Issue (201)

PATCH  /api/projects/:id/issues/:issueId
  Body: Partial<UpdateIssueInput>
  Auth: üye (kendi issue'sını günceller) | developer+ (herhangi birini)
  Side:
    - Değişen her alan için issue_history INSERT
    - Status değişiminde: publishProjectEvent("issue_status_changed") + resolved_at güncelleme
    - Assignee değişiminde: enqueueProjectNotification("issue_assigned")
    - invalidateIssueCache + invalidateBoardCache
    - plan_item_id varsa ve completed değişmişse: plan_items.completed sync
  Resp: Issue

DELETE /api/projects/:id/issues/:issueId
  Auth: reporter+ (kendi açtığı) | developer+ (herhangi) | admin/owner (hepsi)
  Kural: SOFT DELETE — gerçekte silinmez; archived=true yapılır
         Alt issue'ları (sub_task) varsa onlar da archived=true edilir
  Side: invalidateBoardCache; publishProjectEvent("issue_deleted")
  Resp: { ok: true }

PATCH  /api/projects/:id/issues/:issueId/restore
  Auth: admin veya owner
  Side: archived=false; alt issue'lar da restore edilir
  Resp: Issue

GET    /api/projects/:id/issues/archived
  Auth: admin veya owner
  Resp: Issue[] (archived=true olanlar, sayfalandırılmış)

PATCH  /api/projects/:id/issues/:issueId/status
  Body: { statusId }
  Auth: developer+
  Resp: Issue
  Side: issue_history + publishProjectEvent + invalidate

PATCH  /api/projects/:id/issues/reorder
  Body: { issueId, newOrder, statusId? }  [Kanban D&D için]
  Auth: developer+
  Resp: { ok: true }
```

---

## Issue Linking (Phase 2)

```
POST   /api/projects/:id/issues/:issueId/links
  Body: { targetIssueKey, linkType }
  Auth: developer+
  Kural: Karşılıklı link oluşturulur (blocks ↔ is_blocked_by, duplicates ↔ is_duplicated_by)
  Resp: { links: IssueLink[] }

DELETE /api/projects/:id/issues/:issueId/links/:linkId
  Auth: developer+
  Side: Karşılıklı link de silinir
  Resp: { ok: true }
```

---

## Yorumlar

```
GET    /api/projects/:id/issues/:issueId/comments
  Auth: üye
  Resp: IssueComment[]

POST   /api/projects/:id/issues/:issueId/comments
  Body: { content }  [Markdown, max 10K]
  Auth: üye
  Side:
    - @mention parse: content içindeki @username'leri UUID'ye çevir → mentions[]
    - Her mention için enqueueProjectNotification("comment_mention")
    - publishProjectEvent("comment_added")
    - invalidateIssueCache
  Resp: IssueComment (201)

PUT    /api/projects/:id/issues/:issueId/comments/:commentId
  Body: { content }
  Auth: comment.author_id === req.userId
  Side: edited_at güncelle; invalidateIssueCache
  Resp: IssueComment

DELETE /api/projects/:id/issues/:issueId/comments/:commentId
  Auth: author veya admin/owner
  Side: invalidateIssueCache; publishProjectEvent("comment_deleted")
  Resp: { ok: true }
```

---

## Sprints (Phase 2–3)

```
GET    /api/projects/:id/sprints
  Auth: üye
  Resp: Sprint[] (planning/active/completed)

POST   /api/projects/:id/sprints
  Body: { name, goal?, startDate?, endDate? }
  Auth: admin veya owner
  Resp: Sprint (201)

PUT    /api/projects/:id/sprints/:sprintId
  Body: { name?, goal?, startDate?, endDate? }
  Auth: admin veya owner
  Resp: Sprint

POST   /api/projects/:id/sprints/:sprintId/start
  Auth: admin veya owner
  Kural: Zaten aktif sprint varsa 409
  Side: status='active', start_date=NOW(); publishProjectEvent("sprint_started"); invalidateBoardCache
  Resp: Sprint

POST   /api/projects/:id/sprints/:sprintId/complete
  Auth: admin veya owner
  Body: { moveUnfinishedTo?: "backlog" | sprintId }
  Side: Tamamlanmamış issue'ları backlog'a veya yeni sprint'e taşı; status='completed'; publishProjectEvent
  Resp: Sprint

DELETE /api/projects/:id/sprints/:sprintId
  Auth: owner
  Kural: Sadece planning statüsündeki sprint silinebilir
  Side: issue'lar backlog'a taşınır
  Resp: { ok: true }

POST   /api/projects/:id/sprints/:sprintId/issues
  Body: { issueIds: string[] }   [Backlog'dan sprint'e taşı]
  Auth: admin veya owner
  Resp: { moved: number }

DELETE /api/projects/:id/sprints/:sprintId/issues/:issueId
  Auth: admin veya owner  [Sprint'ten backlog'a geri]
  Resp: { ok: true }
```

---

## Board & Backlog

```
GET    /api/projects/:id/board
  Query: ?sprintId= (opsiyonel; yoksa aktif sprint veya kanban için tüm issue'lar)
  Auth: üye
  Resp: BoardData — Redis cached
  {
    statuses: WorkflowStatus[],
    columns: {
      [statusId]: { status: WorkflowStatus, issues: Issue[] }
    },
    sprint?: Sprint,
    members: ProjectMember[]
  }

GET    /api/projects/:id/backlog
  Auth: üye
  Resp: { issues: Issue[], sprints: Sprint[] }
```

---

## Dosya Eklentileri (Phase 3)

```
POST   /api/projects/:id/issues/:issueId/attachments
  Body: multipart/form-data (file, max 10MB)
  Auth: developer+
  Kural: mime_type whitelist: image/*, application/pdf, text/plain
  Resp: Attachment (201)

DELETE /api/projects/:id/issues/:issueId/attachments/:attachmentId
  Auth: uploader veya admin/owner
  Resp: { ok: true }
```

---

## Arama

```
GET    /api/projects/:id/search?q=&type=&status=&assignee=&priority=&label=&from=&to=
  Auth: üye
  Resp: { issues: Issue[], total }
  Not: pg_trgm full-text + filter kombinasyonu; mevcut search.ts pattern kullanılır

GET    /api/search?q=&scope=projects  [Tüm projeler geneli — mevcut /api/search genişletilir]
  Auth: giriş yapmış kullanıcı
  Resp: { plans: [], tasks: [], issues: [] }
```

---

## Webhook (Phase 4)

```
GET    /api/projects/:id/webhooks
  Auth: admin veya owner
  Resp: Webhook[]

POST   /api/projects/:id/webhooks
  Body: { url, events: string[] }
  Auth: admin veya owner
  Resp: { webhook: Webhook, secret: string }  [secret sadece bir kez döner]

PUT    /api/projects/:id/webhooks/:webhookId
  Body: { url?, events?, active? }
  Auth: admin veya owner
  Resp: Webhook

DELETE /api/projects/:id/webhooks/:webhookId
  Auth: admin veya owner
  Resp: { ok: true }

POST   /api/projects/:id/webhooks/:webhookId/test
  Auth: admin veya owner
  Side: Test payload gönderir
  Resp: { status: number, ok: boolean }
```

---

## SSE

```
GET    /api/projects/:id/events
  Auth: üye
  Content-Type: text/event-stream
  Resp: SSE stream (Redis pub/sub tabanlı, 30s heartbeat)
```

---

## "Planıma Ekle" Bridge

```
POST   /api/projects/:id/issues/:issueId/add-to-plan
  Body: { date, scheduledTime? }
  Auth: issue.assignee_id === req.userId
  Kural: plan_item_id zaten doluysa 409
  TX: INSERT plan_items + UPDATE issues.plan_item_id
  Side: cacheDel personal daylog; invalidateBoardCache; publishProjectEvent
  Resp: { planItemId, ok: true }

DELETE /api/projects/:id/issues/:issueId/add-to-plan
  Auth: assignee
  TX: UPDATE issues SET plan_item_id=NULL + DELETE plan_items WHERE id=plan_item_id
  Side: cacheDel personal daylog; invalidateBoardCache
  Resp: { ok: true }
```

---

## plan.ts Entegrasyonu (Tek Satır Ekleme)

```typescript
// routes/plan.ts — updatePlan endpoint'ine:
if (updates.completed !== undefined) {
  await projectStorage.syncPlanItemCompletion(planItemId, updates.completed);
  // syncPlanItemCompletion:
  //   completed=true  → issue'yu category='done' olan en düşük sort_order'lı statüse geçir
  //   completed=false → issue'yu category='todo' olan en düşük sort_order'lı statüse geri al
  //   + logIssueHistory("status", oldName, newName)
  //   + invalidateIssueCache + invalidateBoardCache
}
```
