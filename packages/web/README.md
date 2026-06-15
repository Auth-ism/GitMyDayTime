# @gmd/web

GitMyDayTime'ın frontend paketi — React 19 + Vite + Tailwind CSS 4 ile geliştirilmiş bir SPA / PWA.

Bu paket monorepo'nun bir parçasıdır. Kurulum, ortam değişkenleri ve genel mimari için kök dizindeki [README](../../README.md) ve [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md) dosyalarına bakın.

## Teknoloji

- **React 19** + **Vite** (dev server, HMR, production build)
- **Tailwind CSS 4** — `@theme` tabanlı tasarım token'ları, CSS değişkenleriyle dark/light tema
- **React Query 5** — tüm sunucu state'i; `useDayLog`/`useCategories` optimistik güncellemelerle
- **React Router v7** — masaüstü header + mobil alt tab bar layout
- **vite-plugin-pwa** — ana ekrana eklenebilir PWA, web push bildirimleri
- Özel i18n Context (TR/EN, varsayılan Türkçe)

## Geliştirme

```bash
# Kök dizinden (önerilen — server + web birlikte)
npm run dev

# Sadece web
npm run dev:web

# Tip kontrolü
npx tsc --noEmit -p packages/web/tsconfig.json
```

## Yapı

```
src/
  pages/        # DayView, WeekView, CalendarPage, StatsPage, BoardPage, IssuePage, ...
  components/   # Layout, board/, projects/, NotificationBell, MentionTextarea, ...
  hooks/        # useDayLog, useBoard, useIssues, useProjectEvents (SSE), ...
  lib/          # i18n, yardimcilar
  index.css     # Tailwind v4 @theme + dark mode override'lari
```
