Not: Kullanici email verfy etmeden uyg girecek email send dsadece uyg girdikten sonra kullasnici sen de basarsa atiolcak ilk kayitta email atilmiyacak !!!  \
NOT: Kaydirma da sitenin sonuna kadar kayiyior
NOT: Check boxlari isaretliyemiyuorum
# Feature Planlari

Yapilabilecek gelistirmeler ve yeni ozellikler. Oncelik sirasina gore gruplanmistir.

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

## 6. Bildirim & Hatirlatici Gelistirmeleri ⭐ ONCELIKLI

### 6a. Yaklasan Gorev Bildirimi (YAKIN VADELI)
- [ ] Bir sonraki plana kac dakika kala bildirim gonderilsin (ornek: 5dk, 10dk, 15dk once)
- [ ] Bu sure profilden ayarlanabilir olacak (varsayilan: 10dk)
- [ ] Push notification ile "Sonraki gorev: X, Y dakika sonra" bildirimi

### 6b. Erteleme / Snooze Sistemi (YAKIN VADELI)
- [ ] Gorevi ertele — bildirim X gun/saat sonra tekrar gelsin (ornek: 2 gun icinde hatirlatma)
- [ ] Erteleme suresi secenekleri: 1 saat / 3 saat / yarin / 2 gun / 1 hafta
- [ ] Erteleme sadece tek seferlik — tekrar eden goreve donusmeyecek
- [ ] Ertelenen gorevler ayri bir "Ertelenenler" listesinde gorunecek

### 6c. Bildirim Ayarlari — Profil (YAKIN VADELI)
- [ ] Varsayilan hatirlatma suresi (gorevden kac dk once)
- [ ] Varsayilan erteleme suresi
- [ ] Sessiz saatler (ornek: 22:00 - 08:00 arasi bildirim gonderme)
- [ ] Bildirim tercihi: push / e-posta / ikisi birden

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
- [ ] Mobil'de swipe-to-complete ve swipe-to-delete
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
- [ ] Health check endpoint (`/api/health`)
- [ ] Veritabani yedekleme otomasyonu (pg_dump cron)
- [ ] Hata izleme (Sentry entegrasyonu)
- [ ] Performans izleme (response time logging)
- [ ] Multi-tenant — birden fazla organizasyon destegi

---

## Oncelik Sirasi

### ⭐ Yakin Vadeli (Siradaki Sprint)
| # | Ozellik | Etki | Zorluk |
|---|---------|------|--------|
| 1 | Yaklasan gorev bildirimi (6a) | Yuksek | Dusuk |
| 2 | Erteleme / Snooze sistemi (6b) | Yuksek | Orta |
| 3 | Bildirim ayarlari — Profil (6c) | Yuksek | Dusuk |

### Sonraki Adimlar
| # | Ozellik | Etki | Zorluk |
|---|---------|------|--------|
| 4 | Context menu (sag tik) | Orta | Dusuk |
| 5 | Zaman cizelgesi surukleme & resize | Yuksek | Orta |
| 6 | Board/Kanban gorunumu | Yuksek | Orta |
| 7 | GitHub entegrasyonu | Yuksek | Orta |
| 8 | Test altyapisi (Vitest + Playwright) | Yuksek | Orta |
| 9 | Google Calendar sync | Yuksek | Yuksek |
| 10 | Public profil & paylasim | Orta | Dusuk |
| 11 | Slack entegrasyonu | Orta | Dusuk |
| 12 | Offline-first PWA | Orta | Yuksek |
| 13 | Akilli oneriler (AI) | Orta | Yuksek |
| 14 | Diger bildirim ozellikleri (6d) | Dusuk | Orta |
