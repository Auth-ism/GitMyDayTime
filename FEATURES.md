# GMD — Feature Backlog & Roadmap

Son güncelleme: 2026-04-05

---

## ✅ Tamamlanan Özellikler

### Temel Uygulama
- [x] Günlük plan/görev yönetimi (DayView, WeekView, CalendarPage)
- [x] Tekrarlayan görevler (recurring tasks)
- [x] Kategoriler — 7 varsayılan + kullanıcı özel kategorileri (renkli)
- [x] İstatistikler & heatmap (StatsPage)
- [x] Hatırlatıcılar ve push bildirimleri
- [x] Sessiz saatler, bildirim tercihleri
- [x] Profil sayfası: avatar, renk teması, timezone, telefon, e-posta değiştirme
- [x] Şablon sistemi (templates)
- [x] Export/Import (JSON)
- [x] Arama (fuzzy search, PostgreSQL pg_trgm)
- [x] PWA kurulum desteği
- [x] Swipe-to-complete & swipe-to-delete (mobil)
- [x] Klavye kısayolları
- [x] TR/EN i18n
- [x] Karanlık mod
- [x] Rate limiting (route bazlı, Redis)
- [x] Şifre sıfırlama (ResetPasswordPage + migration 025)

### Grup / Takım Çalışma Alanları ✅
- [x] `groups`, `group_members`, `group_tasks` tabloları
- [x] `storage/groups.ts`, `routes/groups.ts`
- [x] `requireGroupMembership(minRole)` middleware
- [x] GroupsPage, GroupPage, GroupSettingsPage
- [x] Üye davet sistemi (e-posta)
- [x] Grup görev panosu (tarih bazlı, üye kolonları)
- [x] Grup görevini kişisel plana ekleme ("Planıma Ekle")
- [x] Push + e-posta bildirimleri

### Proje Yönetimi (Jira-benzeri) ✅
- [x] Projeler — `project_key`, açıklama, üye rolleri (owner/admin/developer/reporter/viewer)
- [x] Issue'lar — tip (epic/story/task/bug/sub_task), öncelik, etiket, atanan
- [x] Issue hiyerarşisi — parent/child, breadcrumb navigasyon
- [x] Kanban board — sürükle-bırak (kolon içi sıralama + kolon arası taşıma), her ikisi de optimistik
- [x] Board filtreleri — arama, tip, öncelik, etiket, "Bana Atananlar"
- [x] Sprint yönetimi — CRUD, aktif sprint, board sprint filtresi, backlog view, sprint tamamla
- [x] Story Points — issue sidebar + backlog SP toplamı + sprint velocity
- [x] Backlog view — iki kolonlu (backlog / aktif sprint), sprint'e ekle/çıkar
- [x] @mention — textarea dropdown, Tab/Enter klavye navigasyonu, CommentText renderer
- [x] In-app bildirimler — NotificationBell, okunmamış badge; atama + mention + done bildirimleri
- [x] Plan köprüsü — issue'dan günlük plana ekleme (dev kategorisi, issue key prefix, duplikasyon koruması)
- [x] Raporlar sayfası (ProjectInsightsPage) — KPI kartları, durum/öncelik/tip/atanan grafikleri, sprint velocity
- [x] SSE ile gerçek zamanlı board güncellemeleri (`useProjectEvents`)
- [x] Proje ayarları — statüler, etiket yönetimi, sprint CRUD
- [x] Issue link kopyalama — board kart + issue detay + backlog'da issue key'e tıkla → URL clipboard
- [x] Board kartında hızlı arşivle (hover, developer+ için)
- [x] Sub-issue oluşturma — parent'ta anlık görünüm (Redis + parentId fix)

---

## 🚀 Sonraki Sprint — Hızlı Kazanımlar

> Yüksek etki, düşük efor. Tek sprint'te hepsi yapılabilir.

| # | Özellik | Açıklama | Efor | Durum |
|---|---------|----------|------|-------|
| 1 | ~~Story Points~~ | Issue sidebar'a sayı alanı; velocity chart'ı anlamlı kılar | XS | ✅ |
| 2 | ~~"Bana Atananlar" filtresi~~ | Board'da tek tık, en sık kullanılan aksiyon | XS | ✅ |
| 3 | ~~Kolon issue sayısı~~ | Başlıkta badge | XS | ✅ |
| 4 | ~~Issue linki kopyala~~ | Clipboard + toast bildirimi | XS | ✅ |
| 5 | ~~Sprint tamamla butonu~~ | Tamamlanmayanlar için "backlog'a taşı" dialog | S | ✅ |
| 6 | **Cmd/Ctrl+K global arama** | Tüm projeler arası issue arama | M | ⏳ |
| 7 | **Hover context menüsü** | Kart üzerinde hızlı atama/durum değişimi | S | ⏳ |

---

## 🧩 UX Ekstralar (Tamamlanan)
- [x] Logout onay dialogu
- [x] İlk giriş onboarding turu (5 adım)
- [x] Changelog popup (major/minor versiyonda otomatik)
- [x] Changelog sayfası (`/changelog`)
- [x] Geri bildirim / bug report butonu → admin'e e-posta

---

## 📋 Backlog — Core Eksikler

### ~~Backlog View + Sprint Planning~~ ✅
İki kolonlu sayfa tamamlandı: sol = backlog, sağ = aktif sprint.

### Activity Timeline (Issue Sayfasında)
Yorum + durum değişikliği + atama + sprint değişikliği kronolojik akışı. "Kim ne zaman ne yaptı."

### Rich Text / Markdown — Açıklama Alanı
Plain text yerine başlık, liste, kod bloğu, bold. `@uiw/react-md-editor` veya `marked` ile.

### List / Tablo View (Board Alternatifi)
Sıralanabilir tablo, inline edit. 50+ issue için board yetersiz.

### Kişisel Dashboard (Tüm Projeler)
"Bana atanan", "Bildirdiğim", "Yaklaşan due date" — tüm projeleri kesen tek sayfa.

---

## 🎨 UX/UI İyileştirmeler

| Özellik | Açıklama |
|---------|----------|
| **Board yoğunluğu** | Compact / Normal / Comfortable density switcher |
| **Epic renk şeridi** | Kart solunda renkli thin bar — hangi epic'e ait anlık görünür |
| **WIP Limiti** | Kolona max issue sayısı; geçilince başlık kırmızıya döner |
| **Boş durum illüstrasyonları** | Boş board/backlog için illüstrasyon + CTA butonu |
| **Sprint tamamlandığında konfeti** | Küçük şey, büyük moral |
| **Pull to refresh** | Mobil issue listesi ve board |
| **Kart swipe aksiyonları** | Mobil'de swipe ile hızlı durum değişimi |

---

## ⚡ Orta Vadeli Özellikler

### Roadmap / Timeline View
Epic'leri yatay bar olarak zaman ekseninde göster. Sprint dönemleriyle hizalanmış. Gantt değil, hafif.

### Bulk Actions
Issue listesinde checkbox seç → toplu status/sprint/atama değiştir.

### Issue Şablonları
"Bug Report", "Feature Request", "Tech Debt" şablonları — seçince description + label otomatik dolar. Proje settings'te yönetilir.

### Erteleme / Snooze Sistemi
Görevi ertele: 1 saat / 3 saat / yarın / 2 gün / 1 hafta. Ertelenenler ayrı listede.

---

## 🔌 Entegrasyonlar

### GitHub Entegrasyonu (Yüksek Öncelik)
- Commit mesajında `GMD-42` → issue'ya otomatik bağla
- PR açılınca issue "In Review"'a geçsin
- Commit/PR listesi issue detayında görünsün
- **Teknik:** GitHub App webhook, `github_connections` tablosu

### Slack / Discord
- Sprint başlangıç/bitiş bildirimleri
- Issue atama bildirimleri
- Webhook tabanlı, basit POST

### Google Calendar
- Issue due date → takvim eventi
- İki yönlü sync (opsiyonel)

### API Key Sistemi
3. parti uygulamalar için REST API erişimi.

---

## 🤖 Otomasyon

Basit kural motoru:
- "Issue done'a taşınınca → atanan kişiye bildir"
- "Sprint başlayınca → tüm üyelere özet at"
- "Sprint bitince → tamamlanmayan issue'ları backlog'a taşı"

---

## 🧠 Akıllı Özellikler (Uzun Vade)

- **Time Tracking** — Issue'da başlat/durdur, harcanan süre logu. Plan bridge ile entegre.
- **Story point velocity trendi** — Sprint bazlı velocity eğilim çizgisi
- **Due date takvim görünümü** — Issue'ları tarih bazlı takvimde göster
- **Otomatik kategori önerisi** — Açıklamadan tahmin
- **Doğal dil ile issue oluşturma** — "2 günde bitir yüksek öncelikli login bug'ını"

---

## 🔒 Güvenlik — Tamamlanan

- [x] Avatar base64 magic bytes doğrulaması
- [x] Import endpoint Zod validation + boyut limiti
- [x] CORS production fallback
- [x] Route bazlı rate limiting (Redis)
- [x] Concurrent session limiti (5/kullanıcı)
- [x] Route bazlı body size limiti
- [x] Helmet/CSP (dev=gevşek, prod=strict)
- [x] E-posta/kullanıcı adı enumeration koruması
- [x] Telefon numarası Türk formatı doğrulaması

---

## 🏗 Altyapı

- [ ] Test altyapısı (Vitest + Playwright)
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Sentry hata izleme
- [ ] Veritabanı yedekleme otomasyonu (pg_dump cron)
- [ ] Multi-tenant organizasyon desteği
- [x] Health check endpoint (`/api/health`)
- [x] Response time logging
