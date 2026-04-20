# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project Overview

**GitMyDayTime (GMD)** — Personal daily task/time-tracking PWA + Jira-like project management system. Turkish developer, deployed at `gmd.byfeb.com`.

## Monorepo Structure

npm workspaces, three packages:

| Package | Alias | Role |
|---------|-------|------|
| `packages/shared` | `@gmd/shared` | Zod schemas + TypeScript types. **Build first** (`npm run build:shared`) when types change. |
| `packages/server` | `@gmd/server` | Express REST API. PostgreSQL via `pg`, Redis sessions, JWT httpOnly cookies. |
| `packages/web` | `@gmd/web` | React 19 + Vite + Tailwind CSS 4 SPA. React Query 5. PWA via vite-plugin-pwa. |

## Commands

```bash
npm run dev              # server + web concurrently
npm run dev:server       # server only (tsx watch, port 3001)
npm run dev:web          # vite dev server

npx tsc --noEmit -p packages/web/tsconfig.json    # type-check web
npx tsc --noEmit -p packages/server/tsconfig.json  # type-check server

npm run build:shared     # must run first if shared types changed
npm run build            # all workspaces

./deploy.sh              # patch bump → docker build+push → kubectl rollout
./deploy.sh minor        # minor bump
./deploy.sh major        # major bump
```

No test runner or linter configured.

## Backend Architecture (`packages/server`)

### Storage layer (`src/storage/`)
- **`storage.ts`** — Plan items, tasks, stats, recurring tasks, categories, journals, templates, export/import. Direct SQL via `pg` pool, no ORM.
- **`storage/groups.ts`** — Group/team queries.
- **`storage/projects.ts`** — Project management: projects, members, issues, board, labels, sprints, reorder.
- **`storage/notifications.ts`** — In-app notification CRUD (`user_notifications` table).
- **`storage/spaces.ts`** — Spaces queries.

### Routes (`src/routes/`)
`tasks`, `plan`, `stats`, `search`, `recurring`, `categories`, `templates`, `profile`, `push`, `export`, `groups`, `projects`, `notifications`, `spaces`

### Other
- **`src/auth.ts`** — JWT + Redis sessions. `authMiddleware` guards all `/api/*`. `requireGroupMembership(minRole)` for group/project routes. Admin auto-approve via `ADMIN_EMAIL`.
- **`src/db.ts`** — PostgreSQL pool + migration auto-runner on startup.
- **`src/email.ts`** — Resend API: verification, approval, notifications.
- **`src/audit.ts`** — Audit event logging.
- **`src/redis.ts`** — Session cache + pub/sub for SSE.

### Migrations (`migrations/`)
Sequential SQL files `001_initial.sql` … `025_password_reset.sql`. Auto-run on startup.

| Migration | Purpose |
|-----------|---------|
| 001–019 | Core app: plan items, profiles, categories, recurring, notifications, etc. |
| 020 | Projects table, issues, members, statuses, labels |
| 021 | Issue links (parent/child via `parent_id`) |
| 022 | Spaces |
| 023 | Sprints |
| 024 | User notifications (in-app bell) |
| 025 | Password reset tokens |

## Frontend Architecture (`packages/web`)

### Routing — React Router v7
Desktop header + mobile bottom tab bar layout (`src/components/Layout.tsx`).

### Pages (`src/pages/`)
**Core:** `DayView`, `WeekView`, `CalendarPage`, `StatsPage`, `SearchPage`, `RecurringPage`, `ProfilePage`, `LoginPage`, `VerifyEmailPage`, `ResetPasswordPage`, `NotFoundPage`

**Groups:** `GroupsPage`, `GroupPage`, `GroupSettingsPage`

**Project Management:** `ProjectsPage`, `BoardPage`, `IssuePage`, `ProjectMembersPage`, `ProjectSettingsPage`, `ProjectInsightsPage`

### Key Hooks (`src/hooks/`)
- `useDayLog` — day CRUD with optimistic updates
- `useCategories` — default + custom categories
- `useRecurringTasks`
- `useKeyboardShortcuts`, `useSwipe`
- `useGroups`, `useGroup`, `useGroupTasks`
- `useProject`, `useProjects`, `useProjectMembers`, `useBoard`, `useIssues`, `useIssue`
- `useSprints`, `useSprintMutations`
- `useIssueMutations` — create/update/delete/reorder/setIssueSprint
- `useProjectEvents` — SSE real-time board updates

### Components (`src/components/`)
- **`board/`** — `KanbanBoard`, `BoardColumn`, `IssueCard`, `CreateIssueModal`, `BoardFilterBar`
- **`projects/`** — project-related components
- **`MentionTextarea`** — `@mention` dropdown + `CommentText` renderer
- **`NotificationBell`** — in-app notifications with unread badge
- **`Layout`** — app shell, includes NotificationBell in both desktop + mobile headers

### State & Data
- React Query 5 for all server state. No global client state library.
- Optimistic updates in `useDayLog`, `useCategories` — new mutations must follow same `onMutate`/`onError`/`onSettled` pattern.

### i18n
Custom React Context in `src/lib/i18n.tsx`. TR/EN. Default: Turkish. Persisted in `localStorage` key `gmd-locale`.

### Theming
Tailwind v4 `@theme` block in `src/index.css`. CSS vars: `--color-bg`, `--color-text`, etc. → class names `bg-bg`, `text-text-secondary`, `border-border`.
**Dark mode:** `.dark { }` overrides at top level of `index.css` — NOT inside `@layer base` (beats `@theme` specificity).

## Shared Package (`packages/shared/src/index.ts`)

Exports Zod schemas + inferred TypeScript types. Key types:

**Auth/User:** `User`, `UserProfile`, `ProjectMember`

**Plan/Task:** `PlanItem`, `Task`, `RecurringTask`, `Category`

**Groups:** `Group`, `GroupMember`, `GroupTask`, `GroupRole`

**Projects/PM:**
- `Project`, `ProjectRole` (`owner|admin|developer|reporter|viewer`)
- `Issue`, `IssueDetail` (includes `children?: Issue[]`), `BoardData`
- `Sprint`, `SprintStatus` (`planning|active|completed`)
- `CreateSprintInput`, `UpdateSprintInput`
- `Notification` (in-app bell)

## Key Patterns & Gotchas

### PM System
- Projects use `project_key` prefix for issue keys (e.g. `ALPHA-42`).
- Issues table is **separate from `plan_items`** — existing `WHERE user_id = $1` queries untouched.
- Issue → personal plan bridge: category `dev`, description `[ISSUE-KEY] title`, duplicate guard (checks existing plan items), shows DayView link after adding.
- Board columns are project statuses with `category` field (`todo|in_progress|done`).
- `getBoardData` accepts `sprintId`: `null` = all, `"backlog"` = `sprint_id IS NULL`, sprint UUID = filtered.
- Only one sprint can be `active` at a time — enforced in `PATCH /sprints/:sprintId`.
- `reorderIssues` is a transaction-based bulk UPDATE for sort_order.
- SSE endpoint at `GET /api/projects/:id/events` — client uses `useProjectEvents` hook.

### Groups
- `group_tasks` is separate from `plan_items`. Group tasks link to personal plans via optional `plan_item_id` FK.
- Use `requireGroupMembership(minRole)` middleware to protect group/project routes.

### Dates & Timezone
- **Always** use `localDateStr(date)` with `getFullYear/getMonth/getDate` — never `toISOString().split("T")[0]`.
- Istanbul timezone is UTC+3; ISO string conversion causes off-by-one day bugs.
- `pg.types.setTypeParser(1082, ...)` parses DATE columns as strings, not JS Date objects.

### Auth
- All `/api/*` routes require auth except `/api/auth/*`.
- Registration requires admin approval + email verification. Admin email auto-approves.
- Per-user rate limiting (Redis-backed). Concurrent session limit: 5 per user.

### Storage
- Profile avatar: base64 in `user_profiles.avatar_url`, max 150KB.
- `nanoid(8)` for `plan_items.id` — TEXT PK, no auto-generation. Must pass explicit id on INSERT.
- Recurring tasks auto-inject via `injectRecurringTasks()` + `recurring_task_instances` dedup table.
- Categories: 7 defaults + user custom via `user_categories`. `PRESET_COLORS` from `TaskForm.tsx` = shared palette.

### Version
Injected at Vite build time via `define: { __APP_VERSION__ }` from root `package.json`.

## Environment

`.env` at repo root. Server reads via `dotenv` with explicit path.

| Variable | Required |
|----------|---------|
| `DATABASE_URL` | ✅ |
| `REDIS_URL` | ✅ |
| `JWT_SECRET` | ✅ |
| `CORS_ORIGIN` | ✅ |
| `ADMIN_EMAIL` | ✅ |
| `RESEND_API_KEY` | optional |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | optional |

**IMPORTANT:** Env var changes in `k8s.yaml` require `kubectl apply -f k8s.yaml` — deploying a new image alone does NOT pick them up.

## Deploy

Private registry: `hub.umceko.com/byfeb/gitmydaytime`. K8s namespace: `feb`. Use `./deploy.sh`.

## Claude ↔ PM Integration (`scripts/pm-cli.sh`)

This repo ships a bash wrapper that lets Claude auto-create/close issues in the user's GMD project. The user reports bugs/feature requests in chat → Claude opens a PM issue via the CLI → works on it → closes it on deploy.

**Setup (one-time, user-side):**
1. Profile → API Tokens → "Claude PM" token oluştur, raw token'ı kopyala
2. `cp .env.local.example .env.local` → `GMD_API_TOKEN` ve `GMD_PROJECT_ID` doldur (git-ignored)

**Claude workflow:**
- **User reports a bug/feature:** immediately `./scripts/pm-cli.sh create "<title>" "<description>" <type> <priority>` and tell the user the issue key (e.g. "GMD-42 açıldı")
  - Types: `bug`, `task`, `story`, `epic`, `sub_task`
  - Priorities: `critical`, `high`, `medium`, `low`, `none`
  - CLI auto-labels every Claude-created issue with `claude`
- **Before starting work:** `./scripts/pm-cli.sh status <KEY> "in progress"` (optional)
- **After successful deploy:** `./scripts/pm-cli.sh done <KEY>`
- **To check open issues:** `./scripts/pm-cli.sh list`

**Do NOT** create PM issues for trivial one-liner fixes the user asks for in the same message. Reserve PM issues for:
- Bugs the user reports (they want to track the fix)
- Feature requests
- Multi-step work that spans multiple messages

Auth: Bearer PAT via `Authorization` header. authMiddleware resolves it to userId. PAT management endpoints (`/api/profile/api-tokens`) reject Bearer auth — must be browser session.

## Feature Roadmap

See `FEATURES.md` for the full backlog and roadmap.
