# 02 — Redis & Real-time Mimarisi

## Redis Key Namespace

```
── Mevcut (dokunulmaz) ─────────────────────────────────────────────────────
session:{tokenHash}                    → JWT session cache (TTL 5m)
rl:{key}                               → rate limit counter
reminders                              → sorted set (score=timestamp)
daylog:{userId}:{date}                 → kişisel günlük log cache

── Yeni (project management) ───────────────────────────────────────────────
gmd:pm:member:{projectId}:{userId}     → rol string, TTL 5dk
gmd:pm:board:{projectId}:{sprintId}    → BoardData JSON, TTL 30s
gmd:pm:issue:{issueId}                 → Issue detail JSON, TTL 2dk
gmd:pm:invite:{tokenHash}              → { projectId, email, role }, TTL 7g
gmd:pm:notify                          → Redis List (LPUSH/RPOP) bildirim kuyruğu
gmd:pm:{projectId}:events              → Pub/Sub channel — SSE/WS için
```

---

## 1. Üyelik Rolü Cache

Her API isteğinde middleware `getMemberRole()` çağırır. DB'ye gitmeyi azaltır:

```typescript
// storage/projects.ts
export async function getMemberRole(projectId: string, userId: string): Promise<ProjectRole | null> {
  const key = `gmd:pm:member:${projectId}:${userId}`;
  const cached = await cacheGet<string>(key);
  if (cached !== undefined && cached !== null) {
    return (cached || null) as ProjectRole | null;
  }
  const { rows } = await pool.query(
    "SELECT role FROM project_members WHERE project_id=$1 AND user_id=$2",
    [projectId, userId]
  );
  const role = rows[0]?.role ?? null;
  await cacheSet(key, role ?? "", role ? 300 : 30);
  return role;
}

export async function invalidateMemberCache(projectId: string, userId: string) {
  await cacheDel(`gmd:pm:member:${projectId}:${userId}`);
}

export async function invalidateAllMemberCaches(projectId: string) {
  await cacheDelPattern(`gmd:pm:member:${projectId}:*`);
}
```

**Invalidate ne zaman:** üye ekleme, çıkarma, rol değişimi, sahiplik devri.

---

## 2. Board Cache

Board view her açılışta proje + sprint + issue + üye join'ları içerir. Cache kritik:

```typescript
// storage/projects.ts
const BOARD_TTL_TODAY = 20;   // saniyer — aktif sprint için sık güncelleme
const BOARD_TTL_OLD   = 300;  // 5 dk — geçmiş sprint görüntüleme

export async function getBoardData(projectId: string, sprintId: string | null): Promise<BoardData> {
  const key = `gmd:pm:board:${projectId}:${sprintId ?? "backlog"}`;
  const cached = await cacheGet<BoardData>(key);
  if (cached) return cached;
  const data = await getBoardDataFromDB(projectId, sprintId);
  await cacheSet(key, data, sprintId ? BOARD_TTL_TODAY : BOARD_TTL_OLD);
  return data;
}

export async function invalidateBoardCache(projectId: string, sprintId?: string | null) {
  if (sprintId !== undefined) {
    await cacheDel(`gmd:pm:board:${projectId}:${sprintId ?? "backlog"}`);
  } else {
    await cacheDelPattern(`gmd:pm:board:${projectId}:*`);
  }
}
```

**Invalidate ne zaman:** issue oluştur/güncelle/taşı/sil, sprint başlat/bitir.

---

## 3. Issue Detail Cache

Issue sayfası açıldığında comments + history + links join'ı:

```typescript
export async function getIssueDetail(issueId: string): Promise<IssueDetail> {
  const key = `gmd:pm:issue:${issueId}`;
  const cached = await cacheGet<IssueDetail>(key);
  if (cached) return cached;
  const detail = await getIssueDetailFromDB(issueId);
  await cacheSet(key, detail, 120);  // 2 dk
  return detail;
}

export async function invalidateIssueCache(issueId: string) {
  await cacheDel(`gmd:pm:issue:${issueId}`);
}
```

---

## 4. Bildirim Kuyruğu (Redis List)

Route handler bloklamaz; mesaj kuyruğa atılır, scheduler işler:

```typescript
// storage/projects.ts
export type ProjectNotificationEvent =
  | { type: "issue_assigned";    issueId: string; assigneeId: string; assignerName: string; projectName: string; issueKey: string; issueTitle: string }
  | { type: "comment_mention";   issueId: string; mentionedId: string; authorName: string; projectName: string; issueKey: string; commentPreview: string }
  | { type: "issue_done";        issueId: string; assigneeId: string; toStatus: string; changerName: string; issueKey: string; issueTitle: string }  // sadece done kategorisine geçişte
  | { type: "project_invited";   projectId: string; email: string; inviterName: string; projectName: string; inviteUrl: string };

export async function enqueueProjectNotification(event: ProjectNotificationEvent) {
  if (!isRedisConnected()) return;
  try { await redis.lpush("gmd:pm:notify", JSON.stringify(event)); }
  catch { /* ignore */ }
}
```

**scheduler.ts'e eklenir (mevcut tick() içine):**

```typescript
export async function processProjectNotifications(): Promise<number> {
  if (!isRedisConnected()) return 0;
  let sent = 0;
  for (let i = 0; i < 30; i++) {
    const raw = await redis.rpop("gmd:pm:notify");
    if (!raw) break;
    try {
      const ev: ProjectNotificationEvent = JSON.parse(raw);
      const targetUserId = "assigneeId" in ev ? ev.assigneeId
                         : "mentionedId" in ev ? ev.mentionedId
                         : null;
      if (!targetUserId) continue;

      const { rows } = await pool.query(
        `SELECT push_subscription, email, plan_push_notifications, plan_email_notifications
         FROM users WHERE id=$1`, [targetUserId]
      );
      if (!rows.length) continue;
      const user = rows[0];

      // Push
      if (user.plan_push_notifications && user.push_subscription && process.env.VAPID_PUBLIC_KEY) {
        const sub = typeof user.push_subscription === "string"
          ? JSON.parse(user.push_subscription) : user.push_subscription;
        const { title, body, tag } = buildPushPayload(ev);
        await webpush.sendNotification(sub, JSON.stringify({ title, body, tag,
          data: { url: `/project/${ev.issueId ? "issue/" + ev.issueId : ""}` }
        })).catch((e: any) => {
          if (e.statusCode !== 410 && e.statusCode !== 404)
            console.error("[scheduler] pm push failed:", e);
        });
      }

      // Email
      if (user.plan_email_notifications) {
        await sendProjectNotificationEmail(user.email, ev).catch(() => {});
      }

      await pool.query("UPDATE issues SET notification_sent=TRUE WHERE id=$1",
        ["issueId" in ev ? ev.issueId : ""]).catch(() => {});
      sent++;
    } catch (err) {
      console.error("[scheduler] pm notification error:", err);
    }
  }
  return sent;
}

function buildPushPayload(ev: ProjectNotificationEvent) {
  switch (ev.type) {
    case "issue_assigned":
      return { title: `${ev.projectName}: Görev Atandı`, body: `${ev.assignerName}: ${ev.issueTitle}`, tag: `issue-${ev.issueId}` };
    case "comment_mention":
      return { title: `${ev.projectName}: ${ev.authorName} sizi etiketledi`, body: ev.commentPreview, tag: `comment-${ev.issueId}` };
    case "issue_status":
      return { title: `${ev.issueKey} durumu değişti`, body: `${ev.fromStatus} → ${ev.toStatus}`, tag: `status-${ev.issueId}` };
    default:
      return { title: "GMD", body: "", tag: "gmd" };
  }
}
```

**Redis kapalı fallback:** `issues.notification_sent=FALSE` olan kayıtları scheduler DB'den çeker (mevcut pattern).

---

## 5. SSE — Phase 1 Real-time (Düşük Maliyet)

### redis.ts'e Eklenenler

```typescript
// Tek subscriber bağlantısı — tüm projeler için
let pmSubscriber: Redis | null = null;
const pmListeners = new Map<string, Set<(msg: string) => void>>();

export function getPMSubscriber(): Redis {
  if (!pmSubscriber) {
    pmSubscriber = redis.duplicate();
    pmSubscriber.on("message", (channel, msg) => {
      pmListeners.get(channel)?.forEach((fn) => fn(msg));
    });
  }
  return pmSubscriber;
}

export function subscribeProjectEvents(projectId: string, fn: (msg: string) => void): () => void {
  const ch = `gmd:pm:${projectId}:events`;
  if (!pmListeners.has(ch)) {
    pmListeners.set(ch, new Set());
    getPMSubscriber().subscribe(ch).catch(() => {});
  }
  pmListeners.get(ch)!.add(fn);
  return () => {
    const set = pmListeners.get(ch);
    if (!set) return;
    set.delete(fn);
    if (set.size === 0) {
      pmListeners.delete(ch);
      getPMSubscriber().unsubscribe(ch).catch(() => {});
    }
  };
}

export async function publishProjectEvent(projectId: string, event: object): Promise<void> {
  if (!isRedisConnected()) return;
  try { await redis.publish(`gmd:pm:${projectId}:events`, JSON.stringify(event)); }
  catch { /* ignore */ }
}
```

### SSE Endpoint (routes/projects.ts)

```typescript
router.get("/:id/events", isMember, (req, res) => {
  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection",    "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");   // nginx buffering kapalı
  res.flushHeaders();
  res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);

  const unsub = subscribeProjectEvents(req.params.id, (msg) => {
    res.write(`data: ${msg}\n\n`);
  });
  const hb = setInterval(() => res.write(": heartbeat\n\n"), 30_000);
  req.on("close", () => { clearInterval(hb); unsub(); });
});
```

**Ne zaman publish edilir:**
- `issue_created`, `issue_updated`, `issue_status_changed`, `issue_deleted`
- `comment_added`, `comment_edited`, `comment_deleted`
- `member_joined`, `member_left`, `sprint_started`, `sprint_completed`

### Frontend Hook (useProjectEvents.ts)

```typescript
export function useProjectEvents(projectId: string | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!projectId) return;
    const es = new EventSource(`/api/projects/${projectId}/events`, { withCredentials: true });
    es.onmessage = (e) => {
      const ev = JSON.parse(e.data);
      if (ev.type === "connected") return;

      if (["issue_created", "issue_updated", "issue_deleted", "issue_status_changed"].includes(ev.type)) {
        qc.invalidateQueries({ queryKey: ["board", projectId] });
        if (ev.issueId) qc.invalidateQueries({ queryKey: ["issue", ev.issueId] });
      }
      if (["comment_added", "comment_edited", "comment_deleted"].includes(ev.type)) {
        if (ev.issueId) qc.invalidateQueries({ queryKey: ["issue", ev.issueId] });
      }
      if (["member_joined", "member_left"].includes(ev.type)) {
        qc.invalidateQueries({ queryKey: ["project", projectId] });
      }
      if (["sprint_started", "sprint_completed"].includes(ev.type)) {
        qc.invalidateQueries({ queryKey: ["board", projectId] });
        qc.invalidateQueries({ queryKey: ["sprints", projectId] });
      }
    };
    return () => es.close();
  }, [projectId, qc]);
}
```

**Fallback:** SSE bağlantısı kopunca EventSource otomatik yeniden bağlanır. React Query `staleTime: 30_000` ile polling devam eder.

---

## 6. WebSocket Upgrade — Phase 3

SSE tek yönlü (server → client). Phase 3'te şunlar için WebSocket gerekecek:
- Canlı sprint board işbirliği (A taşıyor, B anlık görüyor)
- @mention autocomplete (yazarken üye araması)
- Issue description canlı düzenleme kilidi (conflict önleme)

### Upgrade Stratejisi

```
Phase 1-2:  SSE  (Redis pub/sub → EventSource)
Phase 3:    socket.io üstüne geç
  - socket.io Redis adapter (ioredis) → multi-pod desteği
  - Aynı Redis pub/sub altyapısı kullanılır
  - SSE endpoint kaldırılır, socket.io ile replace edilir
```

**socket.io Redis adapter:**
```typescript
import { createAdapter } from "@socket.io/redis-adapter";
const pubClient = redis;
const subClient = redis.duplicate();
io.adapter(createAdapter(pubClient, subClient));
```

K8s: Tek pod deployment olduğu için Phase 3'te multi-pod sorunu yok. İleride scale gerekirse Redis adapter zaten hazır.

---

## Kapasite Hesabı

| Senaryo | Redis Bağlantısı |
|---------|-----------------|
| 50 proje, her birinde 5 aktif SSE bağlantısı | **2 bağlantı** (main + 1 subscriber) |
| WebSocket Phase 3 | **3 bağlantı** (main + pub + sub) |

Ioredis default max connection pool = unlimited. Sorun yok.
