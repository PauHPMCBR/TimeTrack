# TimeTrack — Registre de jornada

> [!TIP]
> Per a una introducció a alt nivell en **català**, visiteu la web [registrejornada.fyi](registrejornada.fyi).

A full-stack employee time-tracking application: check-in/check-out registration,
vacation management, groups, and an admin panel.

## Introduction

This tool has been made to provide an open source option for the mandatory time tracking of worked hours in Spain, specially after the new laws on September 2026.

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

Copy the examples and then edit each file with real values:

```bash
cp .env.example .env                              # docker-compose / mongo seed
cp backend/.env.example backend/.env              # backend API (git-ignored)
cp frontend/.env.local.example frontend/.env.local  # frontend (git-ignored)
```

`backend/.env` requires at least `MONGODB_URI`, `JWT_SECRET`, `ENCRYPTION_KEY`,
`HASH_KEY` and `FRONTEND_URL` — the example file documents each one and how to
generate the secrets. `frontend/.env.local` only needs
`NEXT_PUBLIC_BACKEND_URL` (defaults are sensible for local dev).

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
