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

- **`src/storage.ts`** — All database queries (plan items, tasks, stats, recurring tasks). Direct SQL via `pg` pool, no ORM.
- **`src/routes/`** — Express routers: `tasks.ts`, `plan.ts`, `stats.ts`, `search.ts`, `recurring.ts`.
- **`src/auth.ts`** — JWT + Redis session auth. `authMiddleware` protects all `/api/*` routes.
- **`src/db.ts`** — PostgreSQL pool + migration runner.
- **`migrations/`** — Sequential SQL files (`001_initial.sql` ... `005_recurring_tasks.sql`). Auto-run on startup.

### Frontend (`packages/web`)

- **Routing** — React Router v7. Layout with desktop header + mobile bottom tab bar.
- **State** — React Query for server state. No global client state library.
- **i18n** — Custom React Context in `src/lib/i18n.tsx`. TR/EN translations. Default locale: Turkish. Persisted in `localStorage` key `gmd-locale`.
- **Theming** — CSS variables in `src/index.css` via Tailwind v4 `@theme` block. Dark mode toggles `.dark` class on `<html>`. Dark overrides MUST be outside `@layer` blocks to beat `@theme` specificity.
- **Components** — `src/components/` for reusable pieces, `src/pages/` for route pages.
- **API layer** — `src/lib/api.ts` wraps all fetch calls. React Query hooks in `src/hooks/`.

### Shared (`packages/shared`)

Single `src/index.ts` exporting Zod schemas and inferred TypeScript types. Both server and web import from `@gmd/shared`.

## Key Patterns

- All API routes are under `/api/` and require auth (JWT cookie).
- Tailwind v4: use `@theme` for design tokens, CSS variable names like `--color-bg`, `--color-text`, etc. Reference as `bg-bg`, `text-text-secondary`, `border-border`.
- Dark mode CSS variable overrides go in `.dark { }` at top level of `index.css` — NOT inside `@layer base`.
- Version is injected at build time via Vite `define: { __APP_VERSION__ }` from root `package.json`.
- Recurring tasks auto-inject into daily plans via `useDayLog` hook + `recurring_task_instances` dedup table.

## Environment

- `.env` at repo root (not in packages). Server reads it via `dotenv` with explicit path.
- Required: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `CORS_ORIGIN`.
- Docker build uses multi-stage `Dockerfile`. Kubernetes namespace: `feb`.

## Deploy

Private registry at `hub.umceko.com/byfeb/gitmydaytime`. K8s cluster. Use `./deploy.sh`.
