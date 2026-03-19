# GitMyDayTime

Kisisel gunluk planlama ve zaman takip uygulamasi (PWA). Gununuzu planlayin, aktiviteleri kaydedin, kategorilere gore zaman takibi yapin.

**Live:** [gmd.byfeb.com](https://gmd.byfeb.com)

## Ozellikler

- **Gunluk Planlama** — Oncelikli gorevler, zaman cizelgesi, surukle-birak siralama
- **Tekrar Eden Gorevler** — Gunluk, hafta ici, haftalik veya ozel gun tekrarlari
- **Pomodoro Zamanlayici** — Plan bazli odak zamanlayicisi
- **Hatirlaticilar** — Zamanli hatirlaticilar ve web push bildirimleri
- **Gunluk** — Her gun icin serbest yazi alani
- **Sablonlar** — Gunluk planlari sablon olarak kaydet ve uygula
- **Haftalik Gorunum** — 7 gunluk grid, gunler arasi surukle-birak
- **Takvim** — Aylik aktivite haritasi
- **Istatistikler** — Kategori dagilimi, tamamlanma oranlari, yillik heatmap, tahmin vs gercek
- **Arama** — Bulanik metin arama (pg_trgm)
- **Ozel Kategoriler** — Varsayilanlara ek kullanici tanimli kategoriler
- **Disa/Ica Aktarma** — Tum verileri JSON olarak indir/yukle
- **Profil** — Avatar, bildirim ayarlari, pomodoro/calisma saatleri tercihleri
- **Karanlik/Acik Tema** — CSS degiskenleri ile tam tema destegi
- **TR/EN Dil Destegi** — Turkce varsayilan
- **PWA** — Mobil cihazlarda ana ekrana eklenebilir
- **Guvenlik** — JWT + Redis session, argon2 sifre hash, e-posta dogrulama, admin onayi

## Teknoloji

| Katman | Teknoloji |
|--------|-----------|
| Frontend | React 19, Vite 8, Tailwind CSS 4, React Query 5, Framer Motion |
| Backend | Express.js, PostgreSQL (pg), Redis |
| Shared | Zod schemas, TypeScript monorepo (npm workspaces) |
| Altyapi | Docker, Kubernetes, Resend (e-posta) |

## Hizli Baslangic

```bash
cp .env.example .env     # DATABASE_URL, REDIS_URL, JWT_SECRET, CORS_ORIGIN ayarla
npm install
npm run dev              # server (3001) + web (5173) baslatir
```

## Ortam Degiskenleri

| Degisken | Aciklama |
|----------|----------|
| `DATABASE_URL` | PostgreSQL baglanti URL'i |
| `REDIS_URL` | Redis baglanti URL'i |
| `JWT_SECRET` | JWT imzalama anahtari |
| `CORS_ORIGIN` | Frontend URL (orn. `https://gmd.byfeb.com`) |
| `ADMIN_EMAIL` | Admin hesabi e-postasi (otomatik onay) |
| `RESEND_API_KEY` | Resend API anahtari (e-posta bildirimleri) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web push bildirimleri |

## Deploy

```bash
./deploy.sh          # patch versiyon
./deploy.sh minor    # minor versiyon
./deploy.sh major    # major versiyon
```

Script: versiyon bump → docker build → push → kubectl rollout → git push + tag

## Proje Yapisi

```
packages/
  shared/   # Zod semalari, TypeScript tipleri, sabitler
  server/   # Express API, PostgreSQL, Redis, JWT auth
  web/      # React SPA, PWA
```

## Lisans

MIT
