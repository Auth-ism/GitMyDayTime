export type ChangeType = "feat" | "fix" | "perf" | "breaking";

export interface ChangeEntry {
  type: ChangeType;
  text: string;
}

export interface VersionEntry {
  version: string;
  date: string;
  bump: "major" | "minor" | "patch";
  summary?: string;
  changes: ChangeEntry[];
}

export const CHANGELOG: VersionEntry[] = [
  {
    version: "4.9.0",
    date: "2026-04-20",
    bump: "minor",
    summary: "API Token sistemi — Claude PM entegrasyonu için Personal Access Token",
    changes: [
      { type: "feat", text: "Profile → API Tokens: isimlendirilmiş kişisel erişim token'ları oluştur, iptal et" },
      { type: "feat", text: "Authorization: Bearer <token> ile tüm API endpoint'leri kullanılabilir" },
      { type: "feat", text: "Token yönetimi sadece browser session üzerinden — stolen PAT başka token oluşturamaz" },
      { type: "feat", text: "scripts/pm-cli.sh — Claude'un bug raporlarını otomatik PM issue'ya çevirmesi için CLI" },
    ],
  },
  {
    version: "4.8.1",
    date: "2026-04-20",
    bump: "patch",
    summary: "Rate limit düzeltmesi — 300 → 800/dk, takvim abonelik 429 hatası giderildi",
    changes: [
      { type: "fix", text: "Global rate limit 300 → 800 req/dk/IP — polling + multi-tab (gmd+pm) için gerçekçi limit" },
      { type: "fix", text: "Takvim abonelik linki oluşturmada 429 hatası düzeldi — kullanıcıya özel mesaj gösteriliyor" },
    ],
  },
  {
    version: "4.8.0",
    date: "2026-04-20",
    bump: "minor",
    summary: "Haftalık özet e-postası — Pazartesi 09:00 önceki haftanın raporu",
    changes: [
      { type: "feat", text: "Haftalık özet e-postası — Profil → Haftalık Özet'ten aç, Pazartesi 09:00'da kendi TZ'nde otomatik gelir" },
      { type: "feat", text: "Özet: tamamlanan görev, harcanan saat, en verimli gün, en çok kullanılan kategori" },
      { type: "feat", text: "Boş hafta (0 tamamlanmış görev) e-posta göndermez, spam olmaz" },
    ],
  },
  {
    version: "4.7.0",
    date: "2026-04-20",
    bump: "minor",
    summary: "Takvim aboneliği — planlarınızı Google/Apple Calendar'dan takip edin",
    changes: [
      { type: "feat", text: "iCal abonelik linki — Profil → Takvim Aboneliği'nden oluştur, Google/Apple Calendar'ın 'URL ile ekle' seçeneğine yapıştır" },
      { type: "feat", text: "Plan items (son 30 gün + gelecek 90 gün) ve size atanmış issue due date'leri senkron" },
      { type: "feat", text: "Token iptal edilebilir; son kullanım tarihi izleniyor" },
      { type: "perf", text: "ETag desteği — değişiklik olmadığında 304 döner, client cache kullanır" },
    ],
  },
  {
    version: "4.6.0",
    date: "2026-04-20",
    bump: "minor",
    summary: "Geri al genişledi, `?` kısayol ekranı global, bir yıl önce bandı",
    changes: [
      { type: "feat", text: "Plan tamamla / geri al — swipe sağ veya tamamla butonu sonrası 'Geri Al' toast ile 5 sn içinde düzeltme" },
      { type: "feat", text: "Plan silindiğinde checklist içeriği de Geri Al ile birlikte geri geliyor" },
      { type: "feat", text: "`?` tuşu artık her sayfada çalışıyor — kategorize kısayol ekranı, Esc ile kapanıyor" },
      { type: "feat", text: "DayView üstünde 'Bir yıl önce bugün' bandı — aynı tarih 1 yıl önceki planlarını aç/kapa" },
      { type: "perf", text: "Geri Al toast süresi 4sn → 5sn uzatıldı" },
    ],
  },
  {
    version: "4.5.17",
    date: "2026-04-19",
    bump: "patch",
    summary: "Kullanıcı dostu polish — PWA kısayolları, paylaş menüsü, undo, bildirim sayacı",
    changes: [
      { type: "feat", text: "Ana ekran kısayolları — uygulama ikonuna uzun basınca Bugün / Hızlı ekle / Haftalık / İstatistikler doğrudan açılıyor" },
      { type: "feat", text: "Diğer uygulamalardan 'Paylaş' → GMD seçerek başlığı otomatik görev olarak ekleme" },
      { type: "feat", text: "Okunmamış bildirim sayısı uygulama ikonu ve tarayıcı sekmesinde görünüyor" },
      { type: "feat", text: "Tekrarlayan görevi silince 'Geri al' bildirimi çıkıyor" },
      { type: "feat", text: "Issue arşivlenince 'Geri al' bildirimi ile hatayı anında geri alabilirsiniz" },
      { type: "fix", text: "pm.byfeb.com PWA'sının home screen ikonundan hızlıca proje listesine/GMD'ye geçiş" },
    ],
  },
  {
    version: "4.5.16",
    date: "2026-04-19",
    bump: "patch",
    summary: "pm.byfeb.com yayında — proje yönetimi ayrı subdomain'de",
    changes: [
      { type: "feat", text: "pm.byfeb.com ayrı frontend olarak yayında — proje yönetimi kendi subdomain'inde, GMD Projects header'ıyla" },
      { type: "fix", text: "pm.byfeb.com'da Inter fontu CSP tarafından bloke ediliyordu, düzeltildi" },
      { type: "fix", text: "pm.byfeb.com'da favicon ve ikonlar 404 dönüyordu — web public dizini paylaşılır hale getirildi" },
      { type: "fix", text: "Eski `apple-mobile-web-app-capable` meta uyarısı — modern `mobile-web-app-capable` eklendi" },
      { type: "perf", text: "Subdomain geçişinde tekrar login gerekmiyor — cookie artık `.byfeb.com` domain'inde paylaşımlı" },
      { type: "perf", text: "DB connection pool 10→20'ye çıkarıldı, idle/connect timeout eklendi" },
    ],
  },
  {
    version: "4.5.8",
    date: "2026-04-18",
    bump: "patch",
    changes: [
      { type: "fix", text: "Board'da fare tekerleği yatay kaydırıyor, kolon içinde dikey kaydırmaya ihtiyaç varsa ona geçiyor" },
      { type: "fix", text: "Kanban kolonları `h-full` zinciriyle düzgün hizalandı, flex-shrink sorunları giderildi" },
    ],
  },
  {
    version: "4.5.6",
    date: "2026-04-17",
    bump: "patch",
    changes: [
      { type: "fix", text: "Board kolonları çok fazla issue olunca dikey kaydırma çalışmıyordu, düzeltildi" },
    ],
  },
  {
    version: "4.5.5",
    date: "2026-04-17",
    bump: "patch",
    changes: [
      { type: "fix", text: "Today'de çek-listesi onaylama çubuğu mobil klavye açılınca gizleniyordu — visual viewport ile klavye üstünde kalıyor" },
      { type: "fix", text: "Gün değiştirince timeline görünümü açık kalmıyor, otomatik kapanıyor" },
      { type: "feat", text: "IssuePage alt issue (subtask) listesi iyileştirildi — başlık, durum ve atanan kişi tek satırda" },
      { type: "fix", text: "Board IssueCard ve kolon başlıkları küçük ekranda düzgün sarıyor" },
    ],
  },
  {
    version: "4.5.4",
    date: "2026-04-17",
    bump: "patch",
    changes: [
      { type: "fix", text: "Board mobilde proje adı ve ikon üst üste biniyordu — iki satıra alındı" },
      { type: "fix", text: "Board yatay scroll: alt scrollbar kalktı, solda/sağda gradient + ok butonlarıyla rahat kaydırma" },
      { type: "fix", text: "Tüm sayfalar artık daha geniş (max-w-5xl) — PC'de boş kenar alanı azaldı" },
      { type: "fix", text: "Proje istatistikleri mobilde pasta grafiğe dokununca beyaz kare çıkıyordu, düzeltildi" },
      { type: "fix", text: "@mention bildirimleri karşılıklı çalışmıyordu — push bildirim filtresi kaldırıldı" },
      { type: "fix", text: "Board'dan 'Plana Ekle' yapılınca Today'de anında görünüyor, not eklemek gerekmiyordu" },
      { type: "fix", text: "Today zaman/timeline butonu farklı günlere gidip dönünce çalışmıyordu — animasyon kiliti kaldırıldı" },
    ],
  },
  {
    version: "4.5.2",
    date: "2026-04-06",
    bump: "patch",
    changes: [
      { type: "fix", text: "Giriş ekranı changelog popup'ı artık yalnızca minor/major güncellemelerde açılıyor" },
    ],
  },
  {
    version: "4.5.1",
    date: "2026-04-06",
    bump: "patch",
    changes: [
      { type: "fix", text: "Backlog sayfası mobilde başlık ve arama alanı üst üste biniyordu, düzeltildi" },
      { type: "fix", text: "Board kartı hover durum menüsü ekran solunda açılınca görünmez oluyordu, sağa açılacak şekilde düzeltildi" },
    ],
  },
  {
    version: "4.5.0",
    date: "2026-04-06",
    bump: "minor",
    summary: "Cmd+K Global Arama & Hızlı Durum Değişimi",
    changes: [
      { type: "feat", text: "Cmd/Ctrl+K ile tüm projelerde issue arama — ok tuşları + Enter ile hızlı geziş" },
      { type: "feat", text: "Board kartlarında hover ile hızlı durum değiştirme — sürüklemeye gerek yok" },
      { type: "feat", text: "Mobil header'da arama butonu — Cmd+K paleti mobilde de açılıyor" },
    ],
  },
  {
    version: "4.4.7",
    date: "2026-04-06",
    bump: "patch",
    changes: [
      { type: "feat", text: "Mobilde versiyon numarasına tıklayınca changelog açılıyor" },
      { type: "fix", text: "DayView banner yalnızca 'yapılacak' (todo) issue'ları gösteriyor — tamamlanmış ve devam edenler çıkarıldı" },
      { type: "fix", text: "Plan tamamlama barı mobil klavyenin altında kalıyordu — Visual Viewport API ile klavye üstüne oturuyor" },
      { type: "fix", text: "Süre giriş alanında autofill önerileri (passkey, kredi kartı vb.) artık çıkmıyor" },
    ],
  },
  {
    version: "4.4.4",
    date: "2026-04-06",
    bump: "patch",
    changes: [
      { type: "fix", text: "Mobilde plan öğesi işaretlenince 'something went wrong' hatası giderildi" },
      { type: "fix", text: "Plan tamamlama süre girişi sayfayı kaydırmıyor (preventScroll), autofill kapalı" },
    ],
  },
  {
    version: "4.4.3",
    date: "2026-04-06",
    bump: "patch",
    changes: [
      { type: "fix", text: "Plan öğesi tamamlanınca diğer öğeler artık üst üste binmiyor — süre girişi sayfadan bağımsız sabit bar olarak açılıyor" },
      { type: "fix", text: "Takvim 'Bugün' butonu sayfa köşesine taşındı, nav okunabilir kaldı" },
      { type: "fix", text: "Issue değişiklik geçmişi ham UUID yerine okunabilir isim gösteriyor (durum, atanan, sprint)" },
      { type: "fix", text: "Mobilde issue değişiklik geçmişi sekmesi erişilebilir hale getirildi" },
      { type: "fix", text: "Board sütun başlığına 'Issue Ekle' butonu taşındı — uzun listelerde kaydırmak gerekmiyor" },
      { type: "fix", text: "@mention bildirimleri anlık güncelleniyor (SSE tetiklemeli + kısa poll aralığı)" },
    ],
  },
  {
    version: "4.4.0",
    date: "2026-04-06",
    bump: "minor",
    summary: "Font Boyutu, Sürükle-Bırak İyileştirmeleri & UX Düzeltmeleri",
    changes: [
      { type: "feat", text: "Font boyutu ayarı — Küçük / Normal / Büyük / Çok Büyük, hesaba özel kaydedilir" },
      { type: "feat", text: "Onboarding turu artık hesap bazlı — yeni cihazda tekrar gösterilmez" },
      { type: "feat", text: "Plan listesinde sürükleme kolu (grip) — mobilde kaydırırken kazara sıralama değişmez" },
      { type: "feat", text: "E-posta şablonlarında GMD logosu" },
      { type: "fix", text: "Tamamlanan issue'lar bugün banner'ında artık görünmüyor" },
      { type: "fix", text: "Issue planına ekle → DayView anında güncelleniyor, etkileşim gerekmez" },
      { type: "fix", text: "Tamamlanmış plan öğeleri sürüklenip yeniden sıralanabiliyor" },
      { type: "fix", text: "Mobilde plan öğesi işaretlenince diğer öğeler üst üste binmiyordu" },
      { type: "fix", text: "Hafta ve Ay görünümünde kaydırma (swipe) navigasyon layout bozukluğu giderildi" },
      { type: "fix", text: "@mention bildirimleri büyük/küçük harf farkı gözetmeksizin ulaşıyor, tire/nokta içeren kullanıcı adları destekleniyor" },
      { type: "fix", text: "Proje İçgörüler sayfası tooltip'leri dark mode'da okunabilir" },
    ],
  },
  {
    version: "4.3.0",
    date: "2026-04-05",
    bump: "minor",
    summary: "Onboarding, Changelog, Geri Bildirim & Kalite İyileştirmeleri",
    changes: [
      { type: "feat", text: "İlk giriş onboarding turu — 5 adımda uygulamayı tanı" },
      { type: "feat", text: "Changelog popup — major/minor versiyonlarda yenilikler otomatik gösterilir" },
      { type: "feat", text: "Changelog sayfası (/changelog) — tüm versiyon geçmişi timeline görünümünde" },
      { type: "feat", text: "Geri bildirim / bug report butonu — footer'dan hata ve öneri gönder" },
      { type: "feat", text: "Issue key kopyalama — board, backlog ve issue detayında key'e tıkla → URL clipboard" },
      { type: "feat", text: "Logout onay dialogu" },
      { type: "fix", text: "Sub-issue oluşturunca parent'ta anında görünüyor (parentId artık INSERT'e ekleniyor)" },
      { type: "perf", text: "@mention dropdown Tab/ArrowDown + Enter klavye navigasyonu" },
      { type: "perf", text: "Kanban dikey sıralama optimistik — kart anında yerleşiyor, sunucu yanıtı beklemiyor" },
      { type: "perf", text: "Board optimistik update tüm sprint filtrelerini kapsıyor" },
    ],
  },
  {
    version: "4.2.2",
    date: "2026-04-05",
    bump: "patch",
    changes: [
      { type: "fix", text: "Davet kontrolü: sadece kayıtlı kullanıcı gerekiyor, onay şartı kaldırıldı" },
      { type: "fix", text: "Sub-issue oluşturunca parent issue'da görünmüyordu, Redis cache eksikliği giderildi" },
      { type: "fix", text: "@ mention dropdown'da Tab/Enter klavye navigasyonu eklendi" },
      { type: "perf", text: "Kanban dikey sıralama artık optimistik — kart anında hareket ediyor" },
    ],
  },
  {
    version: "4.2.1",
    date: "2026-04-04",
    bump: "patch",
    changes: [
      { type: "fix", text: "E-posta doğrulama guard'ı proje özelliklerine eklendi" },
      { type: "fix", text: "Proje davet join sayfası iyileştirildi, rol seçimi düzeltildi" },
    ],
  },
  {
    version: "4.2.0",
    date: "2026-04-03",
    bump: "minor",
    summary: "Proje Yönetimi — Backlog, Story Points, Sprint Tamamlama",
    changes: [
      { type: "feat", text: "Backlog sayfası: sprint dışı issue'lar ayrı listede, sprint'e ekle/çıkar" },
      { type: "feat", text: "Story Points: issue oluşturma, düzenleme ve backlog'da SP toplamı" },
      { type: "feat", text: "Sprint tamamlama: tamamlanmamış issue'ları backlog'a taşı veya sonraki sprint'e aktar" },
      { type: "feat", text: "Board filtresi: 'Benimkiler' ile sadece atanan issue'ları gör" },
      { type: "fix", text: "Reorder 500 hatası düzeltildi (Express route sırası)" },
      { type: "fix", text: "Issue plana eklenince issue detayında hâlâ '+Plana Ekle' görünüyordu" },
    ],
  },
  {
    version: "4.1.0",
    date: "2026-03-28",
    bump: "minor",
    summary: "Global Hata Toastları & Plan Zaman Düzenleme",
    changes: [
      { type: "feat", text: "Tüm mutation hatalarında otomatik toast bildirimi" },
      { type: "feat", text: "Plan öğelerinde saat ve süre düzenleme desteği" },
      { type: "feat", text: "Board'dan plana eklenince plan silinirken board da güncelleniyor" },
    ],
  },
  {
    version: "4.0.0",
    date: "2026-03-20",
    bump: "major",
    summary: "Proje Yönetim Sistemi",
    changes: [
      { type: "feat", text: "Jira benzeri proje yönetimi: Kanban board, issue'lar, sprint'ler" },
      { type: "feat", text: "Proje üyeleri ve roller: owner, admin, developer, reporter, viewer" },
      { type: "feat", text: "Issue bağlantıları (blocks, duplicates, relates to, parent/child)" },
      { type: "feat", text: "Gerçek zamanlı board güncellemeleri (SSE)" },
      { type: "feat", text: "Proje davet sistemi e-posta ile" },
      { type: "feat", text: "Issue'ları kişisel plana ekle" },
      { type: "feat", text: "Sprint yönetimi: oluştur, başlat, tamamla" },
      { type: "feat", text: "Proje insights sayfası" },
    ],
  },
];
