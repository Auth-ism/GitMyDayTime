# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GitMyDayTime — a personal daily task/time-tracking PWA. Turkish developer, deployed at gmd.byfeb.com.

## Monorepo Structure

npm workspaces with three packages:

- **`packages/shared` (`@gmd/shared`)** — Zod schemas, TypeScript types, shared constants. Must be built first (`tsc`).
- **`packages/server` (`@gmd/server`)** — Express.js REST API. PostgreSQL via `pg`, Redis for sessions, JWT auth with httpOnly cookies.
- **`packages/web` (`@gmd/web`)** — React 19 + Vite 8 + Tailwind CSS 4 SPA. React Query 5 for data fetching. PWA via vite-plugin-pwa.

## Commands

```bash
# Development
npm run dev              # starts server + web concurrently
npm run dev:server       # server only (tsx watch, port 3001)
npm run dev:web          # vite dev server

# Build
npm run build:shared     # must run first if shared types changed
npm run build            # builds all workspaces

# Deploy (bumps version, docker build+push, kubectl rollout)
./deploy.sh              # patch bump (default)
./deploy.sh minor        # minor bump
./deploy.sh major        # major bump
```

No test runner is configured.

## Architecture

### Backend (`packages/server`)

- **`src/storage.ts`** — All database queries (plan items, tasks, stats, recurring tasks, categories, journals, templates, export/import). Direct SQL via `pg` pool, no ORM.
- **`src/routes/`** — Express routers: `tasks.ts`, `plan.ts`, `stats.ts`, `search.ts`, `recurring.ts`, `categories.ts`, `templates.ts`, `profile.ts`, `push.ts`, `export.ts`.
- **`src/auth.ts`** — JWT + Redis session auth. `authMiddleware` protects all `/api/*` routes. Admin auto-approve via `ADMIN_EMAIL` env var.
- **`src/db.ts`** — PostgreSQL pool + migration runner.
- **`src/email.ts`** — Resend API for transactional emails (verification, approval, notifications).
- **`src/audit.ts`** — Audit event logging.
- **`src/redis.ts`** — Redis session cache + pub/sub.
- **`migrations/`** — Sequential SQL files (`001_initial.sql` ... `013_fuzzy_search.sql`). Auto-run on startup.

### Frontend (`packages/web`)

- **Routing** — React Router v7. Layout with desktop header + mobile bottom tab bar.
- **Pages** — `DayView`, `WeekView`, `CalendarPage`, `StatsPage`, `SearchPage`, `RecurringPage`, `ProfilePage`, `LoginPage`, `VerifyEmailPage`.
- **State** — React Query for server state. No global client state library.
- **i18n** — Custom React Context in `src/lib/i18n.tsx`. TR/EN translations. Default locale: Turkish. Persisted in `localStorage` key `gmd-locale`.
- **Theming** — CSS variables in `src/index.css` via Tailwind v4 `@theme` block. Dark mode toggles `.dark` class on `<html>`. Dark overrides MUST be outside `@layer` blocks to beat `@theme` specificity.
- **Components** — `src/components/` for reusable pieces, `src/pages/` for route pages.
- **API layer** — `src/lib/api.ts` wraps all fetch calls. React Query hooks in `src/hooks/`.
- **Key hooks** — `useDayLog` (day CRUD), `useCategories` (default + custom categories), `useRecurringTasks`, `useKeyboardShortcuts`, `useSwipe`, `useUndoDelete`.

### Shared (`packages/shared`)

Single `src/index.ts` exporting Zod schemas and inferred TypeScript types. Both server and web import from `@gmd/shared`.

## Key Patterns

- All API routes are under `/api/` and require auth (JWT cookie). Auth routes under `/api/auth/` are public.
- Tailwind v4: use `@theme` for design tokens, CSS variable names like `--color-bg`, `--color-text`, etc. Reference as `bg-bg`, `text-text-secondary`, `border-border`.
- Dark mode CSS variable overrides go in `.dark { }` at top level of `index.css` — NOT inside `@layer base`.
- Version is injected at build time via Vite `define: { __APP_VERSION__ }` from root `package.json`.
- Recurring tasks auto-inject into daily plans via `injectRecurringTasks()` in storage.ts + `recurring_task_instances` dedup table.
- Categories: default 7 categories (dev, meeting, review, ops, learning, personal, other) + user custom categories via `user_categories` table and `useCategories` hook.
- User registration requires admin approval (email sent to ADMIN_EMAIL) + email verification. Admin email auto-approves.
- Profile avatar stored as base64 in `user_profiles.avatar_url`. Max 150KB.
- Email change requires current password confirmation and triggers re-verification.
- Phone numbers stored as 10-digit Turkish format (5XXXXXXXXX).

## Environment

- `.env` at repo root (not in packages). Server reads it via `dotenv` with explicit path.
- Required: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `CORS_ORIGIN`, `ADMIN_EMAIL`.
- Optional: `RESEND_API_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`.
- Docker build uses multi-stage `Dockerfile`. Kubernetes namespace: `feb`.
- IMPORTANT: When adding/changing env vars in `k8s.yaml`, must run `kubectl apply -f k8s.yaml` — deploying a new image alone won't pick up env changes.

## Deploy

Private registry at `hub.umceko.com/byfeb/gitmydaytime`. K8s cluster. Use `./deploy.sh`.

## Feature Plans

See `FEATURES.md` for planned features and improvements.
