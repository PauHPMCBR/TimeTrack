# Database

Local MongoDB for development: MongoDB 6.0 in a `mongodb` container, host port
**27018** → container 27017 (bound to localhost only). `mongo-init.js` runs
automatically on first start: it creates the app user (`alumne`) and, with
`SEED_DEMO=1` + `DEMO_PASSWORD_HASH`, the demo data (see the root `.env.example`).

```
database/
├── docker-compose.yml   MongoDB service (init script mounted read-only)
├── mongo-init.js        App user, collections + indexes, optional demo seed
├── package.json         npm scripts for the migrations
└── migrations/          Numbered migration scripts (see "Migrations")
```

## Run / reset

From the repo root (requires `MONGO_ROOT_PASSWORD` / `MONGO_APP_PASSWORD` in `.env`):

```bash
npm run db:up      # start and wait until healthy
npm run db:down
docker compose -f database/docker-compose.yml down -v   # reset (deletes data)
```

## Connect

```
mongodb://alumne:<MONGO_APP_PASSWORD>@localhost:27018/myapp?authSource=myapp
```

For an interactive shell:
`docker exec -it mongodb mongosh -u alumne -p <MONGO_APP_PASSWORD> --authenticationDatabase myapp`

## Migrations

`migrations/` holds self-contained, numbered Node scripts (one-time data
transformations between schema versions; each file's header says what it does).
They read `MONGODB_URI` from the environment (falling back to `backend/.env`)
and operate on the database named in that URI — run each once per company
database, in order:

```bash
node database/migrations/001-…cjs     # or: npm run migrate:<name> -w database
```
