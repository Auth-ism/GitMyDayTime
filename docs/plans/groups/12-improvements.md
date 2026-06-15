# 12 — İyileştirmeler, Eksikler & Teknik Borç

> Mevcut plan analizi sonucu tespit edilen eksikler, güvenlik riskleri, performans sorunları ve UX kararları.
> Her madde **şimdi** (Phase 1-2) veya **sonra** (Phase 3-4) etiketiyle işaretlenmiştir.

---

## 🔴 Kritik — Hemen Düzeltilmeli (Phase 1 implementasyonu öncesi)

### [GÜVENLİK] Davet Token Race Condition (TOCTOU)

**Sorun:** `GET /api/projects/join/:token` iki eş zamanlı istekte aynı token'ı iki kez kabul edebilir.

**Düzeltme:** Token kabulünü atomik yap — kontrol ve işaretlemeyi tek UPDATE'e taşı:

```sql
-- Ayrı SELECT + UPDATE yerine:
UPDATE project_invitations
SET accepted_at = NOW()
WHERE token_hash = $1
  AND accepted_at IS NULL
  AND expires_at  > NOW()
RETURNING *
-- 0 satır döndürürse: zaten kullanılmış veya expire → 409/410
```

**Dosya:** `storage/projects.ts → acceptInvitation()`

---

### [GÜVENLİK] IDOR: Issue Proje Kontrolü Eksik

**Sorun:** `PATCH /:projectId/issues/:issueId` endpoint'i `issueId`'nin o projeye ait olduğunu doğrulamıyor. Farklı projedeki issue ID'si bilerek kullanılabilir.

**Düzeltme:** Tüm issue sorgularına `AND project_id = $projectId` ekle:

```sql
-- Yanlış:
SELECT * FROM issues WHERE id = $1
-- Doğru:
SELECT * FROM issues WHERE id = $1 AND project_id = $2
```

**Dosya:** `storage/projects.ts` — `getIssue`, `updateIssue`, `deleteIssue` tüm fonksiyonlar.

---

### [GÜVENLİK] SSE Endpoint Rate Limiting Yok

**Sorun:** `GET /api/projects/:id/events` rate limit'e tabi değil. Binlerce SSE bağlantısı Node.js event loop'unu ve Redis subscriber'ı tüketir.

**Düzeltme:**

```typescript
// routes/projects.ts'te:
router.get("/:id/events", isMember, createRateLimiter(5, 60_000, "sse"), (req, res) => { ... });
// Ayrıca: kullanıcı başına aktif SSE sayısını takip et (in-memory Map)
const activeSseConnections = new Map<string, number>(); // userId → count
// Bağlantı başlarken +1, kapanınca -1; max 3 bağlantı/kullanıcı
```

---

### [GÜVENLİK] Privilege Escalation: `role: "owner"` Zod'da Bloklanmamış

**Sorun:** `PATCH /api/projects/:id/members/:userId` body validasyonunda `role` değeri plan'da `"admin"|"developer"|"reporter"|"viewer"` olarak belirtilmiş ama Zod enum `"owner"`'ı da kabul edebilir eğer dikkat edilmezse.

**Düzeltme:** Shared type'ta:

```typescript
export const UpdateMemberRoleInput = z.object({
  role: z.enum(["admin", "developer", "reporter", "viewer"]),  // "owner" kesinlikle dahil değil
});
```

---

### [EKSIK API] `my-assignments` Endpoint Tanımlanmamış

**Sorun:** `DayViewProjectBanner` component'i `/api/projects/my-assignments?date=` endpoint'ini kullanıyor ama `03-api.md`'de bu route yok.

**Eklenmesi gereken endpoint:**

```
GET /api/projects/my-assignments?date=YYYY-MM-DD
  Auth: giriş yapmış kullanıcı
  Resp: Array<{ issueId, issueKey, title, projectId, projectName, planItemId: string|null }>
  SQL: SELECT i.*, p.name AS project_name, p.id AS project_id
       FROM issues i
       JOIN projects p ON p.id = i.project_id
       JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = req.userId
       WHERE i.assignee_id = req.userId AND i.due_date = $date AND i.archived = FALSE
```

**Dosya:** `routes/projects.ts` ve `03-api.md`

---

### [GÜVENLİK] Webhook SSRF Riski (Phase 4 öncesi tasarlanmalı)

**Sorun:** Webhook URL'si olarak `http://169.254.169.254/latest/meta-data/` (AWS metadata) veya `http://localhost:5432` gibi iç ağ adreslerine istek atılabilir.

**Düzeltme:** Webhook kaydederken URL'yi validate et:

```typescript
// storage/projects.ts — createWebhook öncesi:
async function validateWebhookUrl(url: string): Promise<void> {
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Geçersiz protokol");
  const { address } = await dns.promises.lookup(parsed.hostname);
  if (isPrivateIP(address)) throw new Error("İç ağ adreslerine webhook gönderilemez");
}

function isPrivateIP(ip: string): boolean {
  // 10.x, 172.16-31.x, 192.168.x, 127.x, 169.254.x, ::1
  return /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|169\.254\.|::1)/.test(ip);
}
```

**Not:** K8s pod CIDR'ları da eklenebilir.

---

## 🟡 Önemli — Phase 1-2 Geliştirme Sırasında Düzeltilmeli

### [PERFORMANS] Board Endpoint'inde Reporter JOIN Gereksiz

**Sorun:** `getBoardDataFromDB` sorgusu board kartlarında gösterilmeyen `reporter_name` için gereksiz JOIN yapıyor.

**Düzeltme:** `u_r.username AS reporter_name` JOIN'i board sorgusundan çıkar. Reporter sadece issue detay sayfasında (IssuePage) lazy olarak çekilsin.

**Etki:** Board sorgusu ~15% daha hızlı.

---

### [PERFORMANS] ILIKE Yerine `pg_trgm` Operatörü

**Sorun:** `searchIssues`'da `title ILIKE '%query%'` leading wildcard, `idx_issues_title_trgm` GIN index'ini bypass ediyor → seq-scan.

**Düzeltme:**

```sql
-- Yanlış (index kullanmaz):
WHERE title ILIKE '%api%'

-- Doğru (trgm index kullanır):
WHERE title % $1           -- similarity >= threshold (pg_trgm)
-- veya:
WHERE title ILIKE $1 AND similarity(title, $1) > 0.1
```

**Dosya:** `storage/projects.ts → searchIssues()`

---

### [VERİ TUTARLILIĞI] Sprint Complete Atomic Değil

**Sorun:** Sprint bitirme işleminde `UPDATE issues` ve `UPDATE sprints` ayrı sorgular. Aralarında crash olursa tutarsız veri.

**Düzeltme:** Transaction içine al:

```typescript
await pool.query("BEGIN");
try {
  await pool.query("UPDATE issues SET sprint_id=$1 WHERE sprint_id=$2 AND status_id != ALL($3)", [...]);
  await pool.query("UPDATE sprints SET status='completed', completed_at=NOW() WHERE id=$1", [...]);
  await pool.query("COMMIT");
} catch(e) { await pool.query("ROLLBACK"); throw e; }
```

**Dosya:** `routes/projects.ts → completeSprint`

---

### [GÜVENLİK] Issue Linking Cross-Project IDOR

**Sorun:** `POST /:id/issues/:issueId/links` ile `targetIssueKey = "GIZLI-42"` kullanıcının üye olmadığı projedeki bir issue'ya link oluşturabilir.

**Düzeltme:** Link oluşturmadan önce:

```sql
SELECT i.id FROM issues i
JOIN project_members pm ON pm.project_id = i.project_id AND pm.user_id = $userId
WHERE i.issue_key = $targetIssueKey
-- 0 satır → 403 veya 404
```

---

### [GÜVENLİK] Email Enumeration (Davet Endpoint)

**Sorun:** Zaten üye olan email için `409` dönüyor → admin, sistemde kimin kayıtlı olduğunu test edebilir.

**Düzeltme:** `{ ok: true }` döndür (idempotent), log'a yaz.

---

### [TEKNİK BORÇ] `notification_sent` Boolean Semantiği Bozuk

**Sorun:** Assignee değişince yeni kişiye bildirim gitmesi gerekir ama `notification_sent=TRUE` eski atama için set edilmiş ve yeni bildirim engelleniyor.

**Düzeltme:** `notification_sent` boolean'ı kaldır; yerine `last_notified_at TIMESTAMPTZ` koy:

```sql
ALTER TABLE issues
  DROP COLUMN notification_sent,
  ADD COLUMN  last_notified_at TIMESTAMPTZ;
```

Scheduler: `last_notified_at IS NULL` olan veya `assignee son X dakikada değişmiş` olanları işle.

---

### [UX] Kanban Scroll Çakışması (Mobil)

**Sorun:** `overflow-x-auto` board + `overflow-y-auto` column birlikte mobilde kötü deneyim.

**Düzeltme — KanbanBoard.tsx:**

```tsx
// Board: yatay scroll
<div className="overflow-x-auto -mx-4 px-4">
  <div className="flex gap-3" style={{ minWidth: "max-content" }}>
    {statuses.map(s => (
      // Column: sabit yükseklik + dikey scroll
      <div key={s.id} className="w-[280px] flex-shrink-0">
        <div className="overflow-y-auto max-h-[calc(100dvh-14rem)] space-y-2 pr-1">
          {columns[s.id]?.issues.map(i => <IssueCard key={i.id} issue={i} />)}
        </div>
      </div>
    ))}
  </div>
</div>
```

---

### [UX] Unassigned Issue'da "Planıma Ekle" Erişilemiyor

**Sorun:** Issue'nun assignee'si yoksa hiç kimse "Planıma Ekle" düğmesini göremez.

**Düzeltme:** Developer+ rolü, atanmamış issue'ya tek tıkla hem kendine atayıp hem planına ekleyebilmeli:

```tsx
// IssueCard'da:
{!issue.assigneeId && req.role >= "developer" && (
  <button onClick={() => claimAndAddToPlan(issue)}>
    Üstlen & Planıma Ekle
  </button>
)}
```

**Yeni endpoint:** `POST /api/projects/:id/issues/:issueId/claim`  
Body: `{ date, scheduledTime? }` — issue'yu req.userId'ye ata + plan'a ekle (tek TX).

---

### [UX] Label Lowercase Normalize Eksik

**Sorun:** `backend` ve `Backend` iki farklı etiket olarak saklanır.

**Düzeltme:** Storage katmanında insert öncesi:

```typescript
labels: data.labels.map(l => l.toLowerCase().trim())
```

---

### [UX] CreateIssueModal Frontend Validasyonu

**Sorun:** Boş başlıkla submit yapılırsa DB constraint hatası kullanıcıya düz `500` veya parse edilmemiş hata olarak dönebilir.

**Düzeltme:** `AssignIssueInput` Zod şeması `CreateIssueModal`'da react-hook-form ile anlık validate edilmeli:

```typescript
const form = useForm({ resolver: zodResolver(AssignIssueInput) });
// title: required, min 1 char — form submit'te önce validate
```

---

## 🔵 Sonra — Phase 3-4 Mimari İyileştirmeler

### [MİMARİ] SSE Kaldırılmak Yerine Preserve Edilmeli

**Mevcut plan sorunu:** `02-redis-realtime.md`'de "SSE endpoint kaldırılır, socket.io ile replace edilir" yazıyor. Bu production'daki tüm `useProjectEvents` hook'larını kırar.

**Doğru yaklaşım:** Progressive upgrade — SSE endpoint korunur, socket.io opsiyonel transport olarak eklenir:

```typescript
// Client-side: feature detect
const useProjectEvents = (projectId) => {
  const qc = useQueryClient();
  useEffect(() => {
    // socket.io available → WebSocket; fallback → SSE
    if (io) {
      const socket = io("/projects");
      socket.on(`project:${projectId}`, handleEvent);
      return () => socket.disconnect();
    } else {
      const es = new EventSource(`/api/projects/${projectId}/events`);
      es.onmessage = handleEvent;
      return () => es.close();
    }
  }, [projectId]);
};
```

---

### [PERFORMANS] Board Cache Granülaritesi — Column Bazında Parçala

**Sorun:** 1000+ issue'lu projede tüm board tek cache key'e giriyor (~2MB). Her değişiklikte tüm board yeniden hesaplanıyor.

**Düzeltme (Phase 3):** Cache'i sütun bazında parçala:

```
gmd:pm:board:{projectId}:col:{statusId}  → o sütundaki issue'lar (TTL 30s)
```

Sadece değişen sütunun cache'i invalidate edilir:

```typescript
// Issue status A → B geçişinde:
await cacheDel(`gmd:pm:board:${projectId}:col:${oldStatusId}`);
await cacheDel(`gmd:pm:board:${projectId}:col:${newStatusId}`);
// Tüm board cache'i invalidate etmek yerine
```

---

### [PERFORMANS] Board Pagination (Phase 3)

**Mevcut sorun:** Tüm issue'lar tek sorguda çekiliyor.

**Düzeltme:** Sütun başına soft limit + "Daha Fazla" butonu:

```typescript
// Board sorgusunda:
const PAGE_SIZE = 50;  // sütun başına max 50 issue
// /api/projects/:id/board?statusId=xxx&page=2 ile sayfalandırma
```

---

### [MİMARİ] Webhook Retry için BullMQ (Phase 4)

**Mevcut sorun:** Redis List + scheduler tick (60s) ile webhook retry — concurrency yok, gerçek backoff yok, dead letter yok.

**Düzeltme:** BullMQ veya pg-boss:

```typescript
// BullMQ ile:
import { Queue, Worker } from "bullmq";
const webhookQueue = new Queue("webhooks", { connection: redis });

// Retry options:
await webhookQueue.add("deliver", payload, {
  attempts: 5,
  backoff: { type: "exponential", delay: 120_000 },  // 2m, 4m, 8m, 16m, 32m
});

// Worker (scheduler'ın yerini alır):
new Worker("webhooks", deliverWebhook, { connection: redis, concurrency: 5 });
```

---

### [MİMARİ] Transactional Outbox — Issue History Kayıp Riski

**Sorun:** `logIssueHistory` try/catch ile sessizce başarısız olabiliyor → audit log eksik kalıyor.

**Düzeltme (Phase 3):** Status geçişi ve atama değişimi gibi kritik field'lar için issue update + history aynı transaction:

```typescript
// Ayrı try/catch yerine:
await pool.query("BEGIN");
await pool.query("UPDATE issues SET ... WHERE id=$1", [...]);
await pool.query("INSERT INTO issue_history ... VALUES (...)", [...]);
// İkisi ya birlikte commit olur ya da ikisi birlikte rollback
await pool.query("COMMIT");
```

Önemsiz field'lar (description düzenleme) için mevcut sessiz log yeterli.

---

### [TEKNİK BORÇ] Label Refactor — Phase 2'de Yap, Phase 3'e Bırakma

**Sorun:** `issues.labels TEXT[]` → `project_labels` ayrı tablosuna geçiş Phase 3'e planlanmış. Ama bu arada etiket renkleri yok, case normalizasyonu yok, proje bazlı tanımlama yok. Phase 3'te migrasyon daha maliyetli.

**Öneri:** Phase 2'de `project_labels (id, project_id, name, color)` tablosunu oluştur. `issues.labels TEXT[]` → `issue_labels (issue_id, label_id)` junction tablosuna geç. Migration:

```sql
-- 021 migration'ına ekle:
CREATE TABLE project_labels (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name       TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 32),
  color      TEXT NOT NULL DEFAULT '#6b7280',
  UNIQUE (project_id, name)
);

-- issues.labels TEXT[] korunur (backward compat), yeni issue'lar issue_labels'ı kullanır
-- Phase 3'te issues.labels kaldırılır
```

---

### [PERFORMANS] `idx_issues_notification` Partial Index Kullanılmıyor

**Sorun:** `notification_sent=FALSE` partial index var ama bunu kullanan scheduler kodu yok. Redis kuyruğu birincil; DB fallback kodu planlanmamış.

**Düzeltme:** Notification_sent'i `last_notified_at` ile değiştirince bu index gereksiz kalır. Yeni index:

```sql
CREATE INDEX idx_issues_unnotified ON issues(assignee_id, created_at)
  WHERE last_notified_at IS NULL AND assignee_id IS NOT NULL AND archived = FALSE;
```

Scheduler DB fallback'i bunu kullanır.

---

### [UX] Issue Attachment MIME Validation (Phase 3)

**Sorun:** Client'tan gelen `Content-Type` header'ı güvenilmez. SVG ile XSS mümkün.

**Düzeltme (Phase 3 implementasyonunda):**

```typescript
import { fileTypeFromBuffer } from "file-type";

const buffer = req.body;  // multipart'tan
const detected = await fileTypeFromBuffer(buffer.slice(0, 4100));
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];

if (!detected || !ALLOWED.includes(detected.mime)) {
  return res.status(422).json({ error: "Desteklenmeyen dosya türü" });
}
// SVG'yi hiçbir zaman kabul etme
```

---

## Özet Tablo

| # | Sorun | Tip | Faz | Öncelik |
|---|-------|-----|-----|---------|
| 1 | Davet token race condition | Güvenlik | 1 | 🔴 Kritik |
| 2 | IDOR: issue proje kontrolü | Güvenlik | 1 | 🔴 Kritik |
| 3 | SSE rate limiting yok | Güvenlik | 1 | 🔴 Kritik |
| 4 | Owner privilege escalation | Güvenlik | 1 | 🔴 Kritik |
| 5 | `my-assignments` endpoint eksik | API Eksiği | 1 | 🔴 Kritik |
| 6 | Webhook SSRF riski | Güvenlik | 4 öncesi tasarım | 🔴 Kritik |
| 7 | Board reporter JOIN gereksiz | Performans | 1 | 🟡 Önemli |
| 8 | ILIKE → pg_trgm operatörü | Performans | 1 | 🟡 Önemli |
| 9 | Sprint complete atomic değil | Veri tutarlılığı | 3 | 🟡 Önemli |
| 10 | Issue linking cross-project | Güvenlik | 2 | 🟡 Önemli |
| 11 | Email enumeration | Güvenlik | 1 | 🟡 Önemli |
| 12 | `notification_sent` semantiği | Teknik borç | 1 | 🟡 Önemli |
| 13 | Kanban mobil scroll | UX | 1 | 🟡 Önemli |
| 14 | Unassigned issue "Planıma Ekle" | UX | 1 | 🟡 Önemli |
| 15 | Label lowercase normalize | UX | 1 | 🟡 Önemli |
| 16 | CreateIssueModal validasyon | UX | 1 | 🟡 Önemli |
| 17 | SSE preserve, socket.io progressive | Mimari | 3 | 🔵 Sonra |
| 18 | Board cache column bazında | Performans | 3 | 🔵 Sonra |
| 19 | Board pagination (50/col) | Performans | 3 | 🔵 Sonra |
| 20 | BullMQ webhook retry | Mimari | 4 | 🔵 Sonra |
| 21 | Transactional outbox history | Mimari | 3 | 🔵 Sonra |
| 22 | Label Phase 2'de refactor | Teknik borç | 2 | 🔵 Sonra |
| 23 | Notification index güncelle | Performans | 1 | 🔵 Sonra |
| 24 | Attachment MIME magic bytes | Güvenlik | 3 | 🔵 Sonra |
