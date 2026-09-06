# Deployment scripts

Shared environment variables (no defaults baked into the scripts — configure
them per environment):

| Variable        | Used by                | Purpose |
|-----------------|------------------------|---------|
| `INFRA_DIR`     | `build-company.js`, `deploy-all.js` | Directory holding the shared infra `.env` (root `DOMAIN=`, secrets). |
| `COMPANIES_DIR` | `deploy-all.js` (or `--dir`)        | Base dir with one subdirectory per company, each containing `compose.yml`. |
| `DEPLOY_DOMAIN` | both (or `--domain`)                | Root domain override; otherwise read from `DOMAIN=` in `<INFRA_DIR>/.env`. |

Landing site build (`build-landing.js`):

| Variable         | Purpose (defaults keep real domains out of the repo) |
|------------------|------------------------------------------------------|
| `EXAMPLE_DOMAIN` | Example company subdomain shown in the copy (default `empresa.example.com`). |
| `CONTACT_EMAIL`  | Contact address on the page (default `contact@example.com`). |
| `TYPST`          | Optional override for the typst binary used for the guide PDF. |
