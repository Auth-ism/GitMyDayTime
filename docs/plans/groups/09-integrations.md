# 09 — Entegrasyonlar (Phase 4 — Post-MVP)

> Aşağıdaki tüm özellikler Phase 4 kapsamındadır. Altyapı hazırlanırken (DB şeması, webhook tablosu)
> Phase 3'te oluşturulabilir; implementasyon Phase 4'e bırakılır.

---

## Webhook Sistemi

### Tasarım

```
Issue/Sprint event → routes/projects.ts → enqueueWebhookDelivery() → Redis List
                                                                           ↓
                                                        scheduler.ts: processWebhooks()
                                                                           ↓
                                                             HTTP POST → dış sistem
                                                           [başarısız → retry queue]
```

### Redis Kuyruk Yapısı

```
gmd:webhook:queue       → Redis List (LPUSH/RPOP) — bekleyen webhook'lar
gmd:webhook:retry:{id}  → JSON, retry count + next_attempt timestamp
```

### Event Listesi

```typescript
type WebhookEventType =
  | "issue.created"         | "issue.updated"         | "issue.deleted"
  | "issue.status_changed"  | "issue.assigned"        | "issue.comment_added"
  | "sprint.started"        | "sprint.completed"
  | "member.joined"         | "member.left";
```

### Webhook Delivery

```typescript
// storage/projects.ts
export async function enqueueWebhookDelivery(projectId: string, event: WebhookEventType, payload: object) {
  if (!isRedisConnected()) return;

  // Bu proje için ilgili webhook'ları bul
  const { rows: hooks } = await pool.query(
    "SELECT id, url, secret_hash FROM webhooks WHERE project_id=$1 AND active=TRUE AND $2=ANY(events)",
    [projectId, event]
  );

  for (const hook of hooks) {
    await redis.lpush("gmd:webhook:queue", JSON.stringify({
      webhookId: hook.id,
      url:       hook.url,
      secretHash:hook.secret_hash,
      event,
      payload,
      projectId,
      attempt:   1,
      maxAttempts: 5,
      createdAt: Date.now(),
    }));
  }
}

// scheduler.ts'e eklenir
async function processWebhooks(): Promise<number> {
  let sent = 0;
  for (let i = 0; i < 10; i++) {   // tick başına max 10
    const raw = await redis.rpop("gmd:webhook:queue");
    if (!raw) break;
    const item = JSON.parse(raw);
    try {
      const body = JSON.stringify({
        event:     item.event,
        projectId: item.projectId,
        timestamp: new Date().toISOString(),
        data:      item.payload,
      });

      // HMAC-SHA256 imzası (secret varsa)
      const signature = item.secretHash
        ? "sha256=" + createHmac("sha256", item.secretHash).update(body).digest("hex")
        : undefined;

      const response = await fetch(item.url, {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "X-GMD-Event":   item.event,
          "X-GMD-Signature": signature ?? "",
        },
        body,
        signal: AbortSignal.timeout(10_000),  // 10s timeout
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      // Başarılı: failure_count sıfırla
      await pool.query("UPDATE webhooks SET last_fired_at=NOW(), failure_count=0 WHERE id=$1",
        [item.webhookId]).catch(() => {});
      sent++;
    } catch (err) {
      console.error(`[scheduler] webhook delivery failed (${item.webhookId}):`, err);
      // Retry: maxAttempts'e kadar exponential backoff
      if (item.attempt < item.maxAttempts) {
        const delay = Math.pow(2, item.attempt) * 60_000;  // 2m, 4m, 8m, 16m
        await redis.lpush("gmd:webhook:queue", JSON.stringify({ ...item, attempt: item.attempt + 1 }));
        // TODO: delay implementasyonu için sorted set kullanılabilir (score = next_attempt_time)
      } else {
        // Max retry aşıldı: webhook'u deaktif et
        await pool.query("UPDATE webhooks SET failure_count=failure_count+1, active=CASE WHEN failure_count>=9 THEN FALSE ELSE active END WHERE id=$1",
          [item.webhookId]).catch(() => {});
      }
    }
  }
  return sent;
}
```

### Webhook UI (ProjectSettingsPage)

```
Webhook URL: [https://hooks.slack.com/...]
Olaylar: ☑ issue.created  ☑ issue.status_changed  ☐ sprint.started  ...
[Kaydet]  [Sil]  [Test Gönder]

Son Teslimat: ✅ 2025-04-02 14:32  HTTP 200
```

---

## Dış REST API (Versiyonlanmış)

```
/api/v1/...    → Dış API (api_keys tablosu ile kimlik doğrulama)
/api/...       → İç API (JWT cookie ile kimlik doğrulama — mevcut)
```

### Kimlik Doğrulama

```typescript
// api_keys tablosu (01-database.md'de tanımlı)
// Authorization: Bearer gmd_live_xxxxxxxxxxxxx

function apiKeyMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer gmd_")) {
    return res.status(401).json({ error: "API anahtarı gerekli" });
  }
  const rawKey = authHeader.slice(7);
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  // DB'den doğrula + last_used_at güncelle
}
```

### Temel Endpoint'ler (Phase 4)

```
GET  /api/v1/projects                   → proje listesi (sahibi veya üye)
GET  /api/v1/projects/:key/issues       → issue listesi (filtrelenebilir)
POST /api/v1/projects/:key/issues       → issue oluştur
GET  /api/v1/projects/:key/issues/:key  → issue detay
PATCH /api/v1/projects/:key/issues/:key → issue güncelle
```

---

## GitHub Entegrasyonu (Phase 4)

### Amaç

- PR açılınca ilgili issue otomatik "In Review"'e geçer
- Branch adından issue key parse edilir: `feature/ALPHA-42-fix-auth` → `ALPHA-42`
- PR merge → issue "Done"'a geçer

### Implementasyon

```typescript
// POST /api/v1/github/webhook  (GitHub App webhook)
router.post("/github/webhook", express.json({ type: "*/*" }), async (req, res) => {
  // GitHub imzası doğrula (HMAC-SHA256)
  const sig = req.headers["x-hub-signature-256"] as string;
  const expected = "sha256=" + createHmac("sha256", process.env.GITHUB_WEBHOOK_SECRET!)
    .update(JSON.stringify(req.body)).digest("hex");
  if (sig !== expected) return res.status(401).end();

  const { action, pull_request } = req.body;

  if (["opened", "reopened"].includes(action)) {
    const issueKey = extractIssueKey(pull_request.head.ref);  // ALPHA-42
    if (issueKey) {
      await moveIssueToStatusByCategory(issueKey, "in_progress");
      await logIssueHistory(issueKey, "github-bot", "status", null, "In Review (GitHub PR)");
    }
  }

  if (action === "closed" && pull_request.merged) {
    const issueKey = extractIssueKey(pull_request.head.ref);
    if (issueKey) {
      await moveIssueToStatusByCategory(issueKey, "done");
    }
  }

  res.status(200).end();
});

function extractIssueKey(branchName: string): string | null {
  const match = branchName.match(/([A-Z][A-Z0-9]+-\d+)/);
  return match ? match[1] : null;
}
```

**Gereksinimler:**
- GitHub App veya Repository Webhook URL
- `GITHUB_WEBHOOK_SECRET` env var
- K8s service URL: `https://gmd.byfeb.com/api/v1/github/webhook`

---

## Slack Entegrasyonu (Phase 4)

### Outbound (Webhook üzerinden — mevcut webhook sistemiyle)

```
issue.created event → webhook → Slack Incoming Webhook POST
Slack mesajı: "ALPHA-42: API endpoint hata veriyor" [bug 🔴] @alice tarafından açıldı
```

Özel Slack webhook tanımlamak için: `POST /api/projects/:id/webhooks` ile `url=https://hooks.slack.com/...`

### Slash Command (Phase 4+)

```
/gmd issue ALPHA-42          → Issue detayını Slack'te göster
/gmd create task "API fix"   → Yeni task oluştur
/gmd myissues                → Bana atanan açık issue'lar
```

Gerektirdiği şeyler: Slack App + OAuth + Slash Command handler

---

## CI/CD Entegrasyonu (Phase 4)

**Kullanım senaryosu:** GitHub Actions pipeline build/test başarılı olduğunda issue'yu otomatik güncelle.

```yaml
# .github/workflows/deploy.yml
- name: Update GMD Issue
  run: |
    curl -X PATCH https://gmd.byfeb.com/api/v1/projects/ALPHA/issues/${{ env.ISSUE_KEY }} \
      -H "Authorization: Bearer ${{ secrets.GMD_API_KEY }}" \
      -H "Content-Type: application/json" \
      -d '{"statusCategory": "done", "comment": "Deployed to prod by CI ✅"}'
```

---

## Faz Özeti

| Özellik | Faz | Önkoşul |
|---------|-----|---------|
| Webhook altyapısı (DB + queue) | 3 (DB) + 4 (impl) | webhooks tablosu |
| Outbound webhook delivery | 4 | scheduler genişletmesi |
| Dış REST API v1 | 4 | api_keys tablosu |
| GitHub webhook entegrasyonu | 4 | GitHub App |
| Slack Incoming Webhook | 4 | webhook sistemi (mevcut kullanılır) |
| Slack Slash Command | 4+ | Slack App OAuth |
| CI/CD status update | 4 | Dış API v1 |
