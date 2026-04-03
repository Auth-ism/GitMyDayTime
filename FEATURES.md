Not: Kullanici email verify etmeden uyg girecek. Email send sadece uyg girdikten sonra kullanici "gonder" basarsa atilacak, ilk kayitta email atilmayacak.

# Feature Planlari

Yapilabilecek gelistirmeler ve yeni ozellikler. Oncelik sirasina gore gruplanmistir.

---

## 🚀 GRUPlar / TAKIM CALISMA ALANLARI — SONRAKI FEATURE

> Detayli teknik plan: `GROUPS_PLAN.md`

### Sprint 1 — Temel Altyapi (DB + Backend)
- [ ] `020_groups.sql` migration — `groups`, `group_members`, `group_invitations`, `group_tasks` tablolari
- [ ] `storage/groups.ts` — group CRUD sorgu fonksiyonlari
- [ ] `routes/groups.ts` — grup yonetim API'leri
- [ ] `requireGroupMembership(minRole)` middleware
- [ ] `@gmd/shared` — Group tipleri ve Zod schemalari

### Sprint 2 — Grup Yonetimi UI
- [ ] `GroupsPage` — grup listesi, yeni grup olusturma
- [ ] `GroupPage` — grup dashboard (uye listesi, ayarlar linki)
- [ ] `GroupSettingsPage` — uye yonetimi, davet gonderi, rol degistirme
- [ ] `useGroups`, `useGroup` hooks
- [ ] `InviteMemberModal` component
- [ ] Navigasyon: Layout'a Gruplar linki ekleme

### Sprint 3 — Grup Gorev Panosu
- [ ] Grup icin tarih bazli ortak gorev panosu (`/group/:id?date=...`)
- [ ] `MemberTaskColumn` — her uye icin sutun
- [ ] `GroupTaskCard` — gorev karti (kategori, sure, tamamlanma, atanan kisi)
- [ ] `AssignTaskModal` — gruba yeni gorev olustur ve uye ata
- [ ] `AddToPlanModal` — grup gorevini kisisel plana ekle ("Planıma Ekle")
- [ ] `useGroupTasks` hook

### Sprint 4 — Bildirimler ve Cilalama
- [ ] Gorev atama push + email bildirimi (alan kisi)
- [ ] Gorev tamamlaninca grup panelinde sync
- [ ] Davet email entegrasyonu (Resend)
- [ ] `plan_items` completion → `group_tasks` sync (`syncTaskCompletion`)
- [ ] i18n TR/EN grup key'leri
- [ ] Rate limiting: grup endpoint'leri icin

### Tasarim Kararlari
- "groups" → "projects" olarak yeniden adlandırıldı (proje_key: "ALPHA", "GMD")
- Issue tablosu (`issues`) plan_items'dan tamamen ayrı — mevcut sorgular değişmez
- Kullanıcı atanmış issue'yu kişisel planına ekleyebilir (`plan_item_id` FK)
- Roller: owner > admin > developer > reporter > viewer
- Detaylı mimari: `plans/groups/` dizininde modüller halinde

---

## 1. GitHub Entegrasyonu

GitHub hesabini bagla, gunluk aktiviteleri otomatik cek.

- [ ] GitHub OAuth ile hesap baglama (profil sayfasindan)
- [ ] Gunluk commit/PR/issue aktivitelerini otomatik cekme
- [ ] DayView'da "GitHub Aktivitesi" bolumu (commitler, acilan PR'lar)
- [ ] Haftalik contribution ozeti (stats sayfasina entegre)
- [ ] Webhook ile real-time commit loglama
- [ ] Commit mesajlarindan otomatik kategori tespiti (feat→dev, fix→ops, docs→learning)

**Teknik:** GitHub App veya OAuth App. Server'da `github.ts` route, `github_connections` tablosu. Cron job ile gunluk fetch veya webhook.

---

## 2. Paylasim & Ortak Alan

Planlari ve istatistikleri baskalariyia paylas.

- [ ] Public profil sayfasi (`/u/username`) — istatistikler, streak, heatmap
- [ ] Gunluk plan paylasma linki (read-only, token-based)
- [ ] Takim olusturma — ortak bir dashboard'da herkesin gunu
- [ ] Standup export'u direkt Slack/Discord webhook'a gonder
- [ ] Haftalik rapor e-postasi (Pazartesi sabahi otomatik)
- [ ] RSS/Atom feed ile aktivite akisi

**Teknik:** `teams` tablosu, `team_members`, public route'lar auth gerektirmeden. Slack webhook entegrasyonu basit POST.

---

## 3. Canvas / Board Gorunumu

Kanban tarzi gorunum — gorevleri sutunlar arasinda surukle.

- [ ] Board sayfasi (`/board`) — "Yapilacak", "Devam Eden", "Tamamlanan" sutunlari
- [ ] Surukle-birak ile sutunlar arasi tasima
- [ ] Haftalik board — her gun bir sutun
- [ ] Filtreleme: kategori, oncelik, tarih araligi
- [ ] Board'u sablon olarak kaydetme

**Teknik:** Mevcut plan verisi ustune `status` alani eklenmeli. DnD zaten Framer Motion Reorder ile var, genisletilir.

---

## 4. Zaman Cizelgesi Gelistirmeleri

Timeline view'i interaktif hale getir.

- [ ] Surukle-birak ile planlari zaman cizelgesinde tasima
- [ ] Resize ile sure ayarlama (kenarlari cekerek)
- [ ] Cakisma uyarisi (ayni saatte 2+ plan)
- [ ] Google Calendar sync (ical import/export)
- [ ] Outlook/Apple Calendar entegrasyonu
- [ ] "Bos zaman" gosterimi — planlanmamis saatler vurgulama

---

## 5. Akilli Ozellikler

AI ve otomasyon ile uretkenlik artirma.

- [ ] Otomatik kategori onerisi (aciklamadan tahmin)
- [ ] Sure tahmini (gecmis verilere gore "bu genelde 45dk suruyor")
- [ ] Gunluk plan onerisi (en verimli saatlere gore siralama)
- [ ] Tamamlanmayan gorev pattern analizi ("Toplanti gunleri dev gorevleri hep atlaniyor")
- [ ] Haftalik ozet raporu (trendler, oneriler)
- [ ] Dogal dil ile plan ekleme ("yarin 10'da 1 saat toplanti")

---

## 6. Bildirim & Hatirlatici Gelistirmeleri

### 6a. Yaklasan Gorev Bildirimi ✅ TAMAMLANDI
- [x] Bir sonraki plana kac dakika kala bildirim gonderilsin (5/10/15/30dk)
- [x] Bu sure profilden ayarlanabilir (varsayilan: Kapali)
- [x] Push notification ile "Yaklasan Gorev: X — HH:MM" bildirimi

### 6b. Erteleme / Snooze Sistemi (YAKIN VADELI)
- [ ] Gorevi ertele — bildirim X gun/saat sonra tekrar gelsin (ornek: 2 gun icinde hatirlatma)
- [ ] Erteleme suresi secenekleri: 1 saat / 3 saat / yarin / 2 gun / 1 hafta
- [ ] Erteleme sadece tek seferlik — tekrar eden goreve donusmeyecek
- [ ] Ertelenen gorevler ayri bir "Ertelenenler" listesinde gorunecek

### 6c. Bildirim Ayarlari — Profil ✅ TAMAMLANDI
- [x] Varsayilan hatirlatma suresi (gorevden kac dk once): Off/5/10/15/30dk
- [ ] Varsayilan erteleme suresi
- [x] Sessiz saatler (bas/bitis saat profil sayfasindan)
- [x] Bildirim tercihi: push / e-posta / SMS (zaten mevcuttu)

### 6d. Diger Bildirim Ozellikleri
- [ ] E-posta ile gunluk ozet (aksam saati secilerek)
- [ ] Telegram bot entegrasyonu
- [ ] Masaustu bildirimleri (Electron wrapper veya PWA push)
- [ ] "Calisma saatleri disinda" uyarisi

---

## 7. Veri & Analiz

- [ ] Karsilastirmali haftalik rapor (bu hafta vs gecen hafta)
- [ ] Burndown grafigi (gun icinde tamamlanma hizi)
- [ ] Odak suresi analizi (pomodoro verilerinden)
- [ ] Kategori bazli verimlilik trendi
- [ ] CSV export (JSON'a ek olarak)
- [ ] Gunluk/haftalik e-posta raporu
- [ ] Hedef takibi — aylik/haftalik hedefler ve ilerleme

---

## 8. UX & Mobil

- [ ] Sag tik context menu — mouse konumunda popup (duzenleme, silme, tasima)
- [ ] Toplu islem — birden fazla plan sec, toplu tamamla/sil/tasi
- [ ] Oncelik bazli filtreleme (kategori gibi pills)
- [ ] Offline-first — service worker ile tam offline destek, sync queue
- [ ] Drag-to-select (fare ile birden fazla item sec)
- [ ] Klavye navigasyon — J/K ile planlar arasinda gez, Enter ile toggle
- [x] Mobil'de swipe-to-complete ve swipe-to-delete
- [ ] Widget — mobil ana ekranda gunun ozeti

---

## 9. Entegrasyonlar

- [ ] Google Calendar — iki yonlu senkronizasyon
- [ ] Slack — standup export, bildirimler, `/gmd plan` komutu
- [ ] Discord — webhook ile gunluk ozet
- [ ] Notion — sayfa olarak gunluk plan aktarimi
- [ ] Todoist/TickTick — import/sync
- [ ] Zapier/Make webhook — custom otomasyon trigger'lari
- [ ] API key sistemi — 3. parti uygulamalar icin REST API erisimi

---

## 10. Altyapi & DevOps

- [ ] Test altyapisi (Vitest + Playwright)
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Rate limiting dashboard
- [x] Health check endpoint (`/api/health`)
- [ ] Veritabani yedekleme otomasyonu (pg_dump cron)
- [ ] Hata izleme (Sentry entegrasyonu)
- [x] Performans izleme (response time logging)
- [ ] Multi-tenant — birden fazla organizasyon destegi

---

## 🐛 UI / Mobil Hata Duzeltmeleri

Bilinen hatalar ve layout sorunlari.

### Kritik

- [x] **Ust navigasyon tasiyor (mobil)** — `overflow-hidden` eklendi, header content tasmasini engelliyor. `Layout.tsx`
- [x] **Alt tab bar padding uyumsuz** — `pb-20` → `pb-16` + `safe-main-bottom` ile tab bar yuksekligine hizalandi. `Layout.tsx`
- [x] **Recurring duzgun calismiyor** — `recurring_task_id` FK ile plan_items baglandi. Deaktif = uncompleted silinir. Sil = CASCADE ile tum plan_items temizlenir. `storage.ts`, `017_recurring_task_link.sql`
- [x] **Profil sayfasi mobilde sigmiyor** — Timezone/locale grid `grid-cols-1 sm:grid-cols-2` yapildi. `ProfilePage.tsx`

### Yuksek

- [x] **WeekView mobilde cok sikisik** — Yatay scroll + `minmax(110px,1fr)` ile 7-sutun grid. `WeekView.tsx`
- [x] **Profil avatar hover-only** — Kamera ikonu mobilde her zaman gorunuyor (`sm:opacity-0 sm:group-hover:opacity-100`). `ProfilePage.tsx`
- [x] **Profil renk seciciler cok kucuk** — `w-4 h-4` → `w-6 h-6` (create), `w-3.5 h-3.5` → `w-5 h-5` (edit). `ProfilePage.tsx`
- [x] **Safe area** — `safe-top` mobil header'a, `safe-main-bottom` main content'e eklendi. `Layout.tsx`, `index.css`
- [x] **Sifre alani ikon cakismasi** — `pr-8`→`pr-10`, `right-2`→`right-3`, buton `p-1` ile touch target buyutuldu. `ProfilePage.tsx`

### Orta

- [x] **RecurringPage form uzun** — `max-h-[calc(100dvh-12rem)] overflow-y-auto` ile form icerigi scroll ediliyor.
- [x] **DayView kategori filtresi** — Notlar artik filtreden cikarildi, filtre sadece plan itemleri icin calisiyor.
- [x] **TaskForm custom sure alani** — `!w-16` → `!w-20` ile genisletildi, "Custom"/"Özel" yazisi artik sigiyor.
- [x] **StatsPage grafik tasmasi** — YAxis genisligi label uzunlugundan dinamik hesaplaniyor.
- [x] **Swipe hassasiyeti** — Threshold 80px → 60px. `SwipeableItem.tsx`

### Dusuk

- [x] **Input alanlari kucuk** — `.input-sm` min-height 2.5rem, padding artirildi. `index.css`
- [x] **Buton touch target** — `.btn-icon` min 2.75rem. `index.css`
- [x] **Z-index catismasi** — Header/nav z-40, modal/overlay z-50. `Layout.tsx`, `index.css`

---

## 🔒 Guvenlik Duzeltmeleri

### Tamamlanan (v2.7)

- [x] **Avatar base64 icerik dogrulamasi** — Magic bytes kontrolu (JPEG, PNG, WebP, GIF) + MIME type dogrulama. `profile.ts`
- [x] **Import endpoint Zod validation** — Her item type icin ayri schema, max 5000 item limiti, field bounds. `export.ts`
- [x] **CORS fallback** — Production fallback `https://gmd.byfeb.com`, `origin: true` sadece dev'de. `index.ts`
- [x] **Auto-login token** — GET sadece auto-submit form render, login POST body ile. `Referrer-Policy: no-referrer`. `auth.ts`
- [x] **Journal icerik validation** — Zod schema `z.string().max(10000)`. `journal.ts`
- [x] **Avatar boyut limiti hizalama** — Backend 205K base64 chars (= 150KB binary + prefix). `profile.ts`
- [x] **Hata mesajlari** — Email/username enumeration engeli: genel "Bu bilgiler kullanilamaz" mesaji. `auth.ts`, `profile.ts`
- [x] **Telefon numarasi validation** — `.regex(/^5\d{9}$/)` Turk formati zorunlulugu. `shared/index.ts`
- [x] **Token temizligi** — Hourly cleanup: email token (48h), approval token (30 gun). `index.ts`
- [x] **Kategori renkleri kartlarda** — Default ve custom kategorilerin rengi plan kartlarinda gorunuyor. `PlanItem.tsx`
- [x] **Optimistic update iyilestirmesi** — `onMutate` sync yapildi, `onSuccess` ile server data swap. Plan/not/reminder ekleme aninda gorunuyor. `useDayLog.ts`

### Tamamlanan (v2.8)

- [x] **Route bazli rate limiting** — Per-user, Redis-backed. days-read 120/dk, days-write 60/dk, search 20/dk, stats 30/dk, profile 10/dk, avatar 5/dk, export 5/dk, import 3/dk. `index.ts`, `auth.ts`
- [x] **Concurrent session limiti** — Kullanici basina max 5 session. Yeni session olusturulurken eski oturum silinir. `auth.ts`
- [x] **Route bazli body size** — Default 100kb, avatar 250kb, import 1mb. `index.ts`
- [x] **Checklist cache invalidation** — Checklist CRUD sonrasi Redis daylog cache invalidate ediliyor. `plan.ts`
- [x] **Checklist optimistic UUID → nanoid** — `addChecklist.onSuccess` ile server ID'si aninda swap ediliyor. `useDayLog.ts`
- [x] **Stats custom kategori renkleri** — `getCategoryColor()` ile custom kategoriler dogru renk alıyor. `StatsPage.tsx`
- [x] **WeekView reminder ayirimi** — Reminder'lar plan kartlarindan ayrildi, bell ikonu ile gosteriliyor. `WeekView.tsx`
- [x] **WeekView custom kategori renkleri** — `getCategoryColor()` kullaniliyor. `WeekView.tsx`
- [x] **Reminder takvimde gorunme** — `dailyActivity` sorgusu `item_type` filtresi kaldirildi. `storage.ts`
- [x] **Recurring task link** — `plan_items.recurring_task_id` FK ile injection izleme. Deaktif/silme cleanup. `storage.ts`, `017_recurring_task_link.sql`

### Kalan

- [x] **Dev ortamda Helmet/CSP kapatilmis** — Dev'de gevsetilmis CSP (unsafe-eval/ws izni), prod'da strict. `index.ts`

---

## Oncelik Sirasi

### 🔒 Oncelik 0a — Guvenlik ✅ TAMAMLANDI
Kritik + Yuksek + Orta guvenlik duzeltmeleri tamamlandi.

### 🐛 Oncelik 0b — Bug Fix ✅ TAMAMLANDI
| # | Ozellik | Durum |
|---|---------|-------|
| 0b-1 | UI/Mobil hata duzeltmeleri (Kritik + Yuksek + Orta + Dusuk) | ✅ Tamamlandi |
| 0b-2 | Recurring task carry-over fix | ✅ Tamamlandi |
| 0b-3 | Bildirim (6a + 6c): advance notification + sessiz saatler | ✅ Tamamlandi |

### 🚀 Oncelik 1 — SIMDI: Grup Calisma Alanlari
| Sprint | Kapsam | Durum |
|--------|--------|-------|
| Sprint 1 | DB migration + backend API (storage/groups.ts, routes/groups.ts) | Bekliyor |
| Sprint 2 | Grup yonetimi UI (GroupsPage, GroupPage, GroupSettingsPage) | Bekliyor |
| Sprint 3 | Grup gorev panosu (MemberTaskColumn, GroupTaskCard, AssignTaskModal) | Bekliyor |
| Sprint 4 | Bildirimler + cilalama + i18n | Bekliyor |

### Oncelik 2 — Sonraki Adimlar
| # | Ozellik | Etki | Zorluk |
|---|---------|------|--------|
| 1 | Erteleme / Snooze sistemi (6b) | Yuksek | Orta |
| 2 | Context menu (sag tik) | Orta | Dusuk |
| 3 | Zaman cizelgesi surukleme & resize | Yuksek | Orta |
| 4 | Board/Kanban gorunumu | Yuksek | Orta |
| 5 | GitHub entegrasyonu | Yuksek | Yuksek |
| 6 | Test altyapisi (Vitest + Playwright) | Yuksek | Orta |
| 7 | Google Calendar sync | Yuksek | Yuksek |
| 8 | Public profil & paylasim | Orta | Dusuk |
| 9 | Slack entegrasyonu | Orta | Dusuk |
| 10 | Offline-first PWA | Orta | Yuksek |
| 11 | Akilli oneriler (AI) | Orta | Yuksek |
| 12 | Diger bildirim ozellikleri (6d) | Dusuk | Orta |
