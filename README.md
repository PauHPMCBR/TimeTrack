# TimeTrack — Registre de jornada

A full-stack employee time-tracking application: check-in/check-out registration,
vacation management, groups, and an admin panel.

## Tech Stack

| Component | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS |
| Backend | Next.js API routes (Node runtime), TypeScript, JWT auth |
| Shared | Zod schemas (API + database via `@zodyac/zod-mongoose`) |
| Database | MongoDB with Mongoose ODM |
| Tests | Vitest (+ React Testing Library, jsdom) |
| Package manager | npm (workspaces monorepo) |
| Containerization | Docker / docker-compose |

## Project Structure

```
shared/     Zod schemas & shared types (source of truth for API + DB shapes)
backend/    API-only Next.js app on port 3001
frontend/   UI Next.js app on port 3000
database/   MongoDB init script + local dev Docker setup
```

Authentication is a hand-rolled email/password flow issuing stateless JWTs
(stored in `localStorage` by the frontend). There is no NextAuth/SAML.

## Getting Started

### Prerequisites

- Node.js 20+ (with npm 10+)
- Docker + docker compose
- A MongoDB instance (local Docker is easiest)

### 1. Install dependencies

```bash
npm install
```

### 2. Environment configuration

Copy the examples and fill in real values:

```bash
cp .env.example .env          # docker-compose secrets (mongo users, JWT secret)
```

Backend (`backend/.env`, git-ignored):

```env
MONGODB_URI=mongodb://alumne:<password>@localhost:27018/myapp?authSource=myapp
JWT_SECRET=<openssl rand -base64 48>
FRONTEND_URL=http://localhost:3000
# Optional:
# BLOCK_MINUTES=10
# MAX_FAILED_LOGIN_ATTEMPTS=5
```

Frontend (`frontend/.env.local`, git-ignored):

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

> **Note:** `JWT_SECRET` is mandatory. The backend refuses to sign or verify
> tokens without it.

### 3. Run everything

`npm run dev` starts MongoDB (Docker, host port **27018**), the backend
(**:3001**) and the frontend (**:3000**) all at once:

```bash
npm run dev
```

Set `MONGO_ROOT_PASSWORD` and `MONGO_APP_PASSWORD` in `.env` first (see
`.env.example`). Optionally set `SEED_DEMO=1` to create demo groups/reasons and
an unregistered admin account — the init script prints a registration link you
can open to set the admin's password.

Or run the pieces individually:

```bash
npm run db:up              # just the MongoDB container
cd backend && npm run dev
cd frontend && npm run dev
```

## Testing & Quality

```bash
npm run lint       # eslint across all workspaces
npm run test:run   # vitest across all workspaces (CI mode)
npm run test       # vitest watch mode
```

Type checking per workspace:

```bash
cd shared && npx tsc --noEmit
cd backend && npx tsc --noEmit
cd frontend && npx tsc --noEmit
```

Backend tests mock MongoDB and do not require a running database.

CI (GitHub Actions) runs lint, typecheck, tests, docker builds and a secret scan
on every push/PR — see `.github/workflows/ci.yml`.

## Docker Compose (full stack)

From the repo root:

```bash
cp .env.example .env   # then fill in the values
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001 (health check at `/api/health`)
- MongoDB: host port 27018 (bound to localhost only)

The frontend bakes `NEXT_PUBLIC_BACKEND_URL` into client JS at build time — pass
it as a build arg when building the image:

```bash
docker build -f frontend/Dockerfile \
  --build-arg NEXT_PUBLIC_BACKEND_URL=http://localhost:3001 .
```

## API Overview

All endpoints return `{ success?: boolean, data?: T, error?: ErrorCode, details? }`.
Error codes are defined in `shared/src/types/response-errors.ts`.

| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/login`, `POST /api/auth/register` |
| Profile | `GET /api/profile/me`, `GET /api/profile/[userId]`, `POST /api/profile/create` (admin) |
| Work sessions | `POST /api/work-sessions/add-timestamp`, `GET /api/work-sessions/[userId]/day/[date]`, `GET /api/work-sessions/[userId]/month/[year]/[month]`, `GET /api/work-sessions/reasons` |
| Vacations | `POST /api/vacations/create`, `POST /api/vacations/[vacationId]/cancel`, `GET /api/vacations/user/[userId]/[year]`, `GET /api/vacations/yearly/[year]` |
| Groups | `GET /api/groups/[groupId]`, `POST /api/groups/create`, `PUT|DELETE /api/groups/update/[groupId]`, `GET /api/groups/user/[userId]`, `GET /api/groups/team-vacations` |
| Admin | `GET /api/admin/users`, `GET /api/admin/groups`, `GET /api/admin/currently-working`, vacation review endpoints under `/api/admin/vacations/*` |
| Health | `GET /api/health` |

All endpoints except `login`, `register` and `health` require a
`Authorization: Bearer <token>` header. Admin endpoints additionally require the
admin role.
