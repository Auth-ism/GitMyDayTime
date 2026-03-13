# GitMyDayTime

Minimal daily planner and time tracker. Plan your day, log activities, track time by category.

## Features

- Daily planning with category-based tasks
- Activity logging with time tracking
- Weekly calendar view with drag-friendly cards
- Category filtering (Dev, Meeting, Review, Ops, Learning, Personal)
- Monthly calendar with activity heatmap
- Stats dashboard with charts
- Dark/light theme
- Password-protected access

## Stack

- **Frontend**: React, Tailwind CSS, React Query, Framer Motion, Recharts
- **Backend**: Express, file-based JSON storage
- **Shared**: Zod schemas, TypeScript monorepo

## Quick Start

```bash
cp .env.example .env     # set your password
npm install
npm run dev              # starts server (3001) + web (5173)
```

## Docker

```bash
docker compose up -d
```

Configure password in `docker-compose.yml` via `GMD_PASSWORD` env var.

## Deploy (Kubernetes)

```bash
# Build & push
docker build -t hub.umceko.com/byfeb/gitmydaytime:latest .
docker push hub.umceko.com/byfeb/gitmydaytime:latest

# Apply manifests
kubectl apply -f k8s.yaml

# Or use the deploy script
./deploy.sh
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GMD_PASSWORD` | Login password | `admin` |
| `PORT` | Server port | `3001` |

## Project Structure

```
packages/
  shared/   # Types, schemas, utilities
  server/   # Express API + file storage
  web/      # React SPA
```

## License

MIT
