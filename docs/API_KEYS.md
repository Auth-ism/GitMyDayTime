# API Key Kullanım Rehberi — GMD & PM

İki ayrı sistem, iki ayrı token. Karıştırmak en sık yapılan hata.

| | GMD | PM |
|---|---|---|
| URL | `https://gmd.byfeb.com` | `https://pm.byfeb.com` |
| Amaç | Kişisel günlük plan / zaman takibi | Jira benzeri proje yönetimi |
| Token öneki | `gmd_pat_` | `pm_pat_` |
| K8s deployment | `gitmydaytime` | `byfeb-pm` |
| Veritabanı | `gitmydaytime` (user `gmd`) | `byfeb_pm` (user `pm`) |

**Kritik:** Token'lar sistemler arası geçerli değil. `gmd_pat_…` bir token'ı `pm.byfeb.com`'a gönderirsen `401 Unauthorized` alırsın. Bu tam olarak `pm-cli.sh`'in bir süre çalışmama sebebiydi.

---

## 1. Token formatı ve doğrulama

```
<önek> + 48 hex karakter
gmd_pat_ad52f3bda6281c3dcf5a26af27170d52921f983e4e21a5c2
pm_pat_f17e66b2121768625fafb82aa733b36f0c53888822492b0f
```

Sunucu tarafında (`packages/server/src/modules/apiTokens/storage.ts`):

- `isApiTokenShape()` — DB'ye gitmeden önce şekil kontrolü (önek + toplam uzunluk).
- Token DB'de **ham olarak tutulmaz**, sadece `sha256(raw)` hash'i `user_api_tokens.token_hash` sütununda durur.
- `resolveApiToken()` hash'i eşleştirir, `revoked_at IS NULL` ve `users.deleted_at IS NULL` şartlarını arar.
- Her başarılı kullanımda `touchApiToken()` `last_used_at`'i günceller (fire-and-forget).

Bunun pratik sonucu: **ham token'ı kaybedersen geri getirmenin yolu yoktur.** Yeni token üretmen gerekir.

`last_used_at` alanı teşhis için çok işe yarar — `NULL` ise o token hiç kullanılmamıştır (yani kullanıcıya hiç ulaşmamış olabilir).

---

## 2. Token nasıl alınır

### Admin (sen)
Profil → API Tokens → isim ver → **Yeni Oluştur**. Ham token ekranda **bir kez** gösterilir, kopyala.

Backend: `POST /api/profile/api-tokens` → `201 { id, token, name }`

### Admin olmayan kullanıcı
Profil → API key talebi gönderir (`POST /api/profile/api-key-request`).
→ Sana onay maili gider, içindeki butona tıklarsın
→ `GET /api/profile/api-key-requests/:id/approve?token=<review_token>`
→ Sistem token'ı üretir ve **kullanıcıya mail atar**.

> ⚠️ **Bilinen bug (GMD-1):** Onaylanan kullanıcı key'ini hiçbir yerde göremiyor.
> `ProfilePage.tsx:705` sadece `profile.isAdmin` ise `ApiTokensSection` render ediyor;
> backend'de de `modules/apiTokens/routes.ts` `adminOnly` middleware'i var.
> Onay maili ulaşmazsa kullanıcı kalıcı olarak kilitli kalıyor: approve linki ikinci
> tıklamada `410` dönüyor, ham token DB'de yok, kendi kendine üretemiyor.

---

## 3. Kimlik doğrulama

Tüm `/api/*` uçları için:

```bash
curl -H "Authorization: Bearer $TOKEN" https://gmd.byfeb.com/api/days/2026-07-28
```

`packages/server/src/auth.ts` üç yöntemi sırayla dener: cookie JWT → session → `Authorization: Bearer <PAT>`.

**Bearer ile yapılamayan tek şey token yönetimi:**

```js
// modules/apiTokens/routes.ts:17
if (req.headers.authorization?.startsWith("Bearer ")) {
  res.status(403).json({ error: "Token management requires browser session" });
}
```

Yani `/api/profile/api-tokens` uçlarına PAT ile erişemezsin — tarayıcı oturumu şart. Bir PAT ile yeni PAT üretilemez (ayrıcalık yükseltmeyi engelliyor).

---

## 4. PM API — proje yönetimi

`pm-cli.sh`'in kullandığı ve **doğrulanmış** uçlar:

| Metot | Yol | İş |
|---|---|---|
| `GET` | `/api/projects/:projectId/board` | Tüm board: `{ columns: { <statusId>: { status, issues } } }` |
| `GET` | `/api/projects/:projectId/statuses` | Workflow durumları (`id`, `name`, `category`, `sortOrder`) |
| `POST` | `/api/projects/:projectId/issues` | Yeni issue → `{ id, issueKey, … }` |
| `PATCH` | `/api/projects/:projectId/issues/:issueId/status` | Durum değiştir → `{ statusId }` |

### Proje ID'leri (`byfeb_pm` DB)

| Key | Ad | ID |
|---|---|---|
| `GMD` | GMD | `d87f1e45-f0cb-4d37-8f4a-37ee7de18f1f` |
| `PM` | PM | `6b6ad0db-b0b3-4726-8cfa-f734a00cbf35` |
| `MW` | MONEYWAR | `4a6f9ec2-5eee-49fe-9789-9af0187066cc` |

### GMD projesinin durumları

| Ad | Kategori | ID |
|---|---|---|
| Yapılacak | `todo` | `056a94a0-ba5f-4623-862e-b7f8981599ec` |
| Devam Ediyor | `in_progress` | `2d4a5cf5-85ac-4b89-a7a8-6d3d45d0ea0b` |
| İnceleme | `in_progress` | `cab16286-a16f-4755-9227-83b3957f3e90` |
| Tamamlandı | `done` | `904c296a-c527-45e7-96e0-e80b8e5f57ba` |

### Issue oluşturma

```bash
curl -X POST https://pm.byfeb.com/api/projects/d87f1e45-f0cb-4d37-8f4a-37ee7de18f1f/issues \
  -H "Authorization: Bearer pm_pat_..." \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Board sürükle-bırak mobilde takılıyor",
    "description": "iPhone Safari, uzun basıp sürükleyince kart yerine sayfa kayıyor.",
    "issueType": "bug",
    "priority": "high",
    "labels": ["claude"]
  }'
```

- `issueType`: `bug` · `task` · `story` · `epic` · `sub_task`
- `priority`: `critical` · `high` · `medium` · `low` · `none`

---

## 5. `pm-cli.sh` — günlük kullanım

Claude'un bug/feature takibi için kullandığı sarmalayıcı.

### Kurulum

`.env.local` (git-ignored):

```bash
# pm-cli.sh hedefi pm.byfeb.com — token PM hesabından alınmalı (gmd_pat_ değil!)
GMD_API_TOKEN=pm_pat_...
GMD_PROJECT_ID=d87f1e45-f0cb-4d37-8f4a-37ee7de18f1f
GMD_API_BASE=https://pm.byfeb.com
```

> Değişken adları tarihsel sebeple `GMD_` önekli ama **PM sistemine** işaret ediyor.
> `GMD_API_BASE` yazılmazsa varsayılan zaten `https://pm.byfeb.com`.

### Komutlar

```bash
./scripts/pm-cli.sh create "başlık" "açıklama" bug high   # issue aç → "GMD-1  <uuid>  başlık"
./scripts/pm-cli.sh list                                  # done olmayan tüm issue'lar
./scripts/pm-cli.sh statuses                              # workflow durumları + id'leri
./scripts/pm-cli.sh status GMD-1 "Devam Ediyor"           # durum değiştir (ad veya kategori)
./scripts/pm-cli.sh done GMD-1                            # ilk done kategorili duruma taşı
```

`done` ve `status` komutları issue-key'i (`GMD-1`) board'u tarayarak UUID'ye çevirir; UUID ezberlemene gerek yok.

### Sorun giderme

| Belirti | Sebep |
|---|---|
| `ERROR: Unauthorized` | GMD token'ı PM'e gönderiyorsun — `pm_pat_` ile değiştir |
| `list` boş çıktı | Board'da done olmayan issue yok (hata değil) |
| `ERROR: Issue X not found on board` | Issue zaten done kategorisinde ya da key yanlış |
| `GMD_API_TOKEN env var not set` | `.env.local` yok veya boş |

---

## 6. GMD API — kişisel plan/görev

Tarih formatı her yerde `YYYY-MM-DD` (`DATE_RE = /^\d{4}-\d{2}-\d{2}$/`).

> **Timezone tuzağı:** İstanbul UTC+3. `toISOString().split("T")[0]` bir gün kaydırır.
> `getFullYear/getMonth/getDate` ile lokal tarih üret.

### Gün ve plan

| Metot | Yol | İş |
|---|---|---|
| `GET` | `/api/days/:date` | O günün tüm log'u |
| `POST` | `/api/days/:date/plan` | Plan öğesi ekle |
| `PUT` | `/api/days/:date/plan/:id` | Güncelle |
| `DELETE` | `/api/days/:date/plan/:id` | Sil |
| `PUT` | `/api/days/:date/plan/reorder` | Sıralama |
| `PUT` | `/api/days/:date/plan/:id/move` | Başka güne taşı |
| `POST` | `/api/days/:date/copy-from/:fromDate` | Günü kopyala |
| `GET` | `/api/days/:date/one-year-ago` | 1 yıl önce bugün |

### Checklist

| Metot | Yol |
|---|---|
| `POST` | `/api/days/:date/plan/:planId/checklist` |
| `PUT` | `/api/days/:date/plan/:planId/checklist/:clId` |
| `DELETE` | `/api/days/:date/plan/:planId/checklist/:clId` |

### Görevler / devir

| Metot | Yol |
|---|---|
| `POST` | `/api/days/:date/tasks` |
| `PUT` | `/api/days/:date/tasks/:id` |
| `DELETE` | `/api/days/:date/tasks/:id` |
| `PUT` | `/api/days/:date/tasks/:id/move` |
| `GET` | `/api/days/:date/carryover` |
| `POST` | `/api/days/:date/carryover` |

### Diğer

| Metot | Yol | İş |
|---|---|---|
| `GET` | `/api/stats` · `/api/stats/yearly` | İstatistikler |
| `GET` | `/api/search?q=…` | Arama |
| `GET`/`POST`/`PUT`/`DELETE` | `/api/recurring` | Tekrarlayan görevler |
| `POST` | `/api/recurring/inject/:date` | O güne enjekte et |
| `GET`/`POST`/`PUT`/`DELETE` | `/api/categories` | Özel kategoriler |
| `GET`/`POST`/`DELETE` | `/api/templates` | Şablonlar |
| `GET`/`PUT` | `/api/days/:date/journal` | Günlük not |
| `GET` | `/api/export` | Tüm veriyi dışa aktar |
| `POST` | `/api/export/import` | İçe aktar (max 1MB) |
| `GET` | `/api/notifications` | Bildirimler |

### Plan ekleme örneği

```bash
curl -X POST https://gmd.byfeb.com/api/days/2026-07-28/plan \
  -H "Authorization: Bearer gmd_pat_..." \
  -H "Content-Type: application/json" \
  -d '{
    "description": "[GMD-1] API key görünürlük bugunu düzelt",
    "category": "dev",
    "duration": 90,
    "scheduledTime": "14:00",
    "priority": "high"
  }'
```

`CreatePlanInput` (`packages/shared/src/index.ts:85`):

| Alan | Tip | Varsayılan |
|---|---|---|
| `description` | string, min 1 | — (zorunlu) |
| `category` | enum | `"other"` |
| `duration` | number (dakika) | opsiyonel |
| `scheduledTime` | string `"HH:MM"` | opsiyonel |
| `itemType` | enum | `"plan"` |
| `priority` | enum | `"normal"` |

Kategoriler: `dev` · `meeting` · `review` · `ops` · `learning` · `personal` · `other` (+ kullanıcının özel kategorileri).

### PM → GMD köprüsü

Bir issue üzerinde çalışacaksan GMD'ye plan olarak ekleme kalıbı:
kategori `dev`, açıklama `[ISSUE-KEY] başlık`. Aynı gün için mükerrer ekleme koruması var.

---

## 7. Rate limit

`packages/server/src/index.ts` içinde tanımlı, Redis destekli. PAT kullanımı da bu limitlere tabi.

| Kapsam | Limit |
|---|---|
| Global (authed, kullanıcı başına) | 3000 / dk |
| Gün okuma (`rlDaysR`) | 300 / dk |
| Gün yazma (`rlDaysW`) | 60 / dk |
| İstatistik | 60 / dk |
| Arama | 40 / dk |
| Tekrarlayan · kategori · şablon | 30 / dk |
| Token yönetimi | 10 / dk |
| Avatar yükleme | 5 / dk |
| Export | 5 / dk |
| Import | 3 / dk |
| API key onay linki (IP başına) | 10 / dk |

`429` alırsan bir dakika bekle. `/events` (SSE) uçları tüm limitlerden muaf — tek uzun ömürlü bağlantı olduğu için.

---

## 8. Güvenlik

- Token'ı **asla** commit'leme. `.env.local` git-ignored; `.env.local.example` şablondur.
- Token = tam hesap erişimi (token yönetimi hariç). Sızarsa hemen iptal et:
  Profil → API Tokens → çöp kutusu (`DELETE /api/profile/api-tokens/:id`, soft revoke → `revoked_at`).
- Hesap silinince (`deleted_at`) tüm PAT'ler otomatik iptal olur.
- Onay maili token'ı düz metin taşır — mail kutusu ele geçerse token da gider.
  Şüphe varsa iptal edip yeniden üret.

### Token'ın kime ait olduğunu bulma

Ham token'ı biliyor ama sahibini bilmiyorsan hash'ini hesaplayıp DB'de ara:

```bash
node -e 'console.log(require("crypto").createHash("sha256").update("pm_pat_...").digest("hex"))'

kubectl exec -n feb deploy/byfeb-pm-postgres -c postgres -- \
  psql -U pm -d byfeb_pm -c \
  "SELECT t.name, t.created_at, t.last_used_at, t.revoked_at, u.email
     FROM user_api_tokens t JOIN users u ON u.id = t.user_id
    WHERE t.token_hash = '<hash>';"
```

GMD için: `deploy/gitmydaytime-postgres`, `-U gmd -d gitmydaytime`.

---

## 9. Operasyon — kubectl ile teşhis

```bash
# Bekleyen/onaylanmış API key talepleri
kubectl exec -n feb deploy/gitmydaytime-postgres -c postgres -- \
  psql -U gmd -d gitmydaytime -c \
  "SELECT r.id, r.status, r.requested_at, r.reviewed_at, u.email
     FROM api_key_requests r JOIN users u ON u.id = r.user_id
    ORDER BY r.requested_at DESC;"

# Token'lar — last_used_at NULL ise kullanıcıya ulaşmamış olabilir
kubectl exec -n feb deploy/gitmydaytime-postgres -c postgres -- \
  psql -U gmd -d gitmydaytime -c \
  "SELECT t.name, t.created_at, t.last_used_at, t.revoked_at, u.email
     FROM user_api_tokens t JOIN users u ON u.id = t.user_id
    ORDER BY t.created_at DESC;"

# Onay linki tıklanmış mı? (410 = zaten işlenmiş)
kubectl logs -n feb deploy/gitmydaytime | grep "api-key-requests"
```

### Ulaşmayan onayı yeniden tetikleme

Onay maili gitmediyse talebi `pending`'e alıp yeni `review_token` üret, sonra linke tıkla —
gerçek kod yolu çalışır, mail yeniden gönderilir:

```bash
NEW_TOKEN=$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')

kubectl exec -n feb deploy/gitmydaytime-postgres -c postgres -- \
  psql -U gmd -d gitmydaytime -c \
  "UPDATE api_key_requests
      SET status='pending', reviewed_at=NULL, review_token='$NEW_TOKEN'
    WHERE id='<request-id>';"

# Eski, kullanılmamış token'ı da iptal et ki ortalıkta sahipsiz kalmasın
kubectl exec -n feb deploy/gitmydaytime-postgres -c postgres -- \
  psql -U gmd -d gitmydaytime -c \
  "UPDATE user_api_tokens SET revoked_at=NOW()
    WHERE id='<token-id>' AND revoked_at IS NULL;"

# Sonra tarayıcıda aç:
# https://gmd.byfeb.com/api/profile/api-key-requests/<request-id>/approve?token=$NEW_TOKEN
```

**Not:** `approveApiKeyRequest()` yalnızca `status='pending'` VE `review_token` eşleşiyorsa çalışır.
Onay sonrası `review_token` `NULL`'lanır — bu yüzden aynı linke ikinci kez tıklamak `410` döner.
Bu tasarım gereği (tek kullanımlık link), bug değil. Bug olan, kullanıcının kurtarma yolunun olmaması (GMD-1).

---

## İlgili dosyalar

| Dosya | İçerik |
|---|---|
| `packages/server/src/modules/apiTokens/storage.ts` | Token üretme/hash/çözümleme, talep CRUD |
| `packages/server/src/modules/apiTokens/routes.ts` | Token yönetimi (adminOnly + Bearer engeli) |
| `packages/server/src/modules/profile/routes.ts:204` | Talep gönderme/durum sorgulama |
| `packages/server/src/index.ts:128` | Tek tıkla onay ucu (oturum gerektirmez) |
| `packages/server/src/email.ts:258` | Talep ve onay mailleri |
| `packages/server/src/auth.ts:227` | Bearer PAT çözümleme |
| `packages/web/src/components/ApiTokensSection.tsx` | Admin token yönetim UI |
| `packages/web/src/components/ApiKeyRequestSection.tsx` | Kullanıcı talep formu |
| `packages/server/migrations/031_api_tokens.sql` | `user_api_tokens` tablosu |
| `packages/server/migrations/033_api_key_requests.sql` | `api_key_requests` tablosu |
| `scripts/pm-cli.sh` | PM CLI sarmalayıcı |
