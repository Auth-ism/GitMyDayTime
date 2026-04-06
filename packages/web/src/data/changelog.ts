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
