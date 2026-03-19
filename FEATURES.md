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

## 6. Bildirim & Hatirlatici Gelistirmeleri

- [ ] Erteleme (snooze) — 5dk/15dk/1saat/yarin secenekleri
- [ ] Tekrarlayan hatirlaticilar (sadece planlar degil)
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

| # | Ozellik | Etki | Zorluk |
|---|---------|------|--------|
| 1 | GitHub entegrasyonu | Yuksek | Orta |
| 2 | Context menu (sag tik) | Orta | Dusuk |
| 3 | Board/Kanban gorunumu | Yuksek | Orta |
| 4 | Google Calendar sync | Yuksek | Yuksek |
| 5 | Public profil & paylasim | Orta | Dusuk |
| 6 | Slack entegrasyonu | Orta | Dusuk |
| 7 | Offline-first PWA | Orta | Yuksek |
| 8 | Test altyapisi | Yuksek | Orta |
| 9 | Akilli oneriler (AI) | Orta | Yuksek |
| 10 | Bildirim gelistirmeleri | Dusuk | Dusuk |
