# Deployment scripts

Shared environment variables (no defaults baked into the scripts — configure
them per environment):

| Variable        | Used by                | Purpose |
|-----------------|------------------------|---------|
| `INFRA_DIR`     | `build-company.js`, `deploy-all.js` | Directory holding the shared infra `.env` (root `DOMAIN=`, secrets). |
| `COMPANIES_DIR` | `deploy-all.js`, `migrate-all.js` (or `--dir`) | Base dir with one subdirectory per company, each containing `compose.yml`. |
| `DEPLOY_DOMAIN` | both (or `--domain`)                | Root domain override; otherwise read from `DOMAIN=` in `<INFRA_DIR>/.env`. |

## migrate-all.js

Runs the numbered DB migrations (`database/migrations/*.cjs`) against every
company DB, discovered from the companies dir (each compose's backend env must
carry `MONGODB_URI`, plus `ENCRYPTION_KEY`/`HASH_KEY` for migration 003):

```bash
node scripts/migrate-all.js          # all migrations, all companies
node scripts/migrate-all.js 1 5      # migrations 001..005 only
node scripts/migrate-all.js 3        # just 003
```

Per company, migrations stop at the first failure (order matters); other
companies continue. Destructive migrations (004) prompt for confirmation —
`--yes` skips the prompt. Run BEFORE `deploy-all.js` when the release includes
schema changes (guide 10).

The usage guide PDF (`docs/guide.pdf`) is compiled from `docs/guide.typ` and
committed; the frontend Dockerfile bakes it into every image as `/guide.pdf`.
