# Deployment scripts

Shared environment variables (no defaults baked into the scripts — configure
them per environment):

| Variable        | Used by                | Purpose |
|-----------------|------------------------|---------|
| `INFRA_DIR`     | `build-company.js`, `deploy-all.js` | Directory holding the shared infra `.env` (root `DOMAIN=`, secrets). |
| `COMPANIES_DIR` | `deploy-all.js` (or `--dir`)        | Base dir with one subdirectory per company, each containing `compose.yml`. |
| `DEPLOY_DOMAIN` | both (or `--domain`)                | Root domain override; otherwise read from `DOMAIN=` in `<INFRA_DIR>/.env`. |

The usage guide PDF (`docs/guide.pdf`) is compiled from `docs/guide.typ` and
committed; the frontend Dockerfile bakes it into every image as `/guide.pdf`.
