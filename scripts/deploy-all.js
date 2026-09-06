#!/usr/bin/env node
// Deploys every company on the server in one shot. Meant to run on the VPS
// where /opt/timetrack lives (after `git pull` in the repo):
//
//   node scripts/deploy-all.js
//
// What it does, per company compose file under /opt/timetrack/companies/*/:
//   1. builds the shared backend image once (tag registre-jornada-backend:latest),
//   2. builds the company's frontend image (branding + baked backend URL) from
//      the `x-company` block in the company's compose file,
//   3. recreates the company's stack: docker compose up -d --force-recreate,
//   4. polls GET /api/health and reports whether the company came up healthy.
//
// Options:
//   --pull            run `git pull` in the repo first
//   --skip-backend    don't rebuild the shared backend image
//   --skip-health     don't wait for /api/health after recreating
//   --skip-index-sync don't POST /api/admin/indexes/sync after recreating
//   --dir <path>      companies base dir (default: $COMPANIES_DIR or /opt/timetrack/companies)
//   --domain <d>      root domain override (default: /opt/timetrack/.env DOMAIN=)
import { readdirSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import {
  readCompanyFromCompose,
  resolveDomain,
  buildFrontend,
  buildBackend,
} from "./build-company.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const DEFAULT_COMPANIES_DIR = "/opt/timetrack/companies";

function usage() {
  console.error(
    "Usage: node scripts/deploy-all.js [--pull] [--skip-backend] [--skip-health] [--dir <path>] [--domain <root-domain>]"
  );
  process.exit(1);
}

const argv = process.argv.slice(2);
const args = { pull: false, backend: true, health: true, indexSync: true, companiesDir: process.env.COMPANIES_DIR };
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--pull") args.pull = true;
  else if (argv[i] === "--skip-backend") args.backend = false;
  else if (argv[i] === "--skip-health") args.health = false;
  else if (argv[i] === "--skip-index-sync") args.indexSync = false;
  else if (argv[i] === "--dir") args.companiesDir = argv[++i];
  else if (argv[i] === "--domain") args.domain = argv[++i];
  else usage();
}
if (!args.companiesDir) args.companiesDir = DEFAULT_COMPANIES_DIR;

const domain = resolveDomain({ flag: args.domain, env: process.env.DEPLOY_DOMAIN });
if (!domain) {
  console.error(
    "No root domain configured. Pass --domain <root-domain>, set DEPLOY_DOMAIN,\n" +
      "or add DOMAIN=<root-domain> to /opt/timetrack/.env."
  );
  process.exit(1);
}

if (args.pull) {
  console.log("== git pull ==");
  execFileSync("git", ["pull"], { cwd: repoRoot, stdio: "inherit" });
}

const composeFiles = readdirSync(args.companiesDir)
  .map((name) => join(args.companiesDir, name, "compose.yml"))
  .filter((p) => existsSync(p))
  .sort();
if (composeFiles.length === 0) {
  console.error(
    `No company compose files found under ${args.companiesDir} (expected <dir>/<company>/compose.yml)`
  );
  process.exit(1);
}

const companies = composeFiles.map((f) => {
  const cfg = readCompanyFromCompose(f);
  if (!cfg.subdomain) {
    console.error(`Invalid x-company block in ${f}: missing 'subdomain'.`);
    process.exit(1);
  }
  return cfg;
});

console.log(`Deploying ${companies.length} company(ies) under ${args.companiesDir}\n`);

if (args.backend) {
  console.log("== Building backend image (registre-jornada-backend:latest) ==");
  buildBackend();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Applies missing Mongo indexes via /api/admin/indexes/sync, authenticated with
// the company's CRON_SECRET (the endpoint also accepts admin tokens for manual
// runs). Index changes are NOT applied automatically in production (autoIndex
// off), so this runs after every stack recreation. Non-fatal: reported, not
// counted as a deploy failure.
function syncIndexes(composeDir, cfg) {
  if (!cfg.cronSecret) {
    console.log(
      `  ${cfg.subdomain}: index sync skipped (no CRON_SECRET in compose file)`
    );
    return false;
  }
  try {
    const out = execFileSync(
      "docker",
      [
        "compose",
        "exec",
        "-T",
        "-e",
        `SYNC_SECRET=${cfg.cronSecret}`,
        "backend",
        "sh",
        "-c",
        'wget -qO- --header "x-cron-secret: $SYNC_SECRET" --post-data \'sync=1\' http://localhost:3001/api/admin/indexes/sync',
      ],
      { cwd: composeDir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    );
    return out.includes('"success":true');
  } catch {
    return false;
  }
}

async function waitHealthy(composeDir, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const out = execFileSync(
        "docker",
        ["compose", "exec", "-T", "backend", "sh", "-c", "wget -qO- http://localhost:3001/api/health || true"],
        { cwd: composeDir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
      );
      if (out.includes('"ok"')) return true;
    } catch {
      // container not up yet — retry
    }
    await sleep(5000);
  }
  return false;
}

const failed = [];

for (const cfg of companies) {
  console.log(`\n== ${cfg.subdomain}: building frontend image ==`);
  try {
    buildFrontend(cfg, domain);
  } catch {
    console.error(`  build failed for ${cfg.subdomain}`);
    failed.push(cfg.subdomain);
    continue;
  }

  const composeDir = join(args.companiesDir, cfg.subdomain);
  if (!existsSync(join(composeDir, "compose.yml"))) {
    console.error(`  no compose file at ${join(composeDir, "compose.yml")} — onboard this company first (guide 4)`);
    failed.push(cfg.subdomain);
    continue;
  }

  console.log(`== ${cfg.subdomain}: recreating stack ==`);
  try {
    execFileSync("docker", ["compose", "up", "-d", "--force-recreate"], { cwd: composeDir, stdio: "inherit" });
  } catch {
    console.error(`  compose up failed for ${cfg.subdomain}`);
    failed.push(cfg.subdomain);
    continue;
  }

  if (args.health) {
    const healthy = await waitHealthy(composeDir);
    console.log(`  ${cfg.subdomain}: ${healthy ? "healthy" : "NOT healthy (check docker compose logs)"}`);
    if (!healthy) failed.push(cfg.subdomain);
  }

  if (args.indexSync) {
    console.log(`== ${cfg.subdomain}: syncing Mongo indexes ==`);
    const ok = syncIndexes(composeDir, cfg);
    console.log(
      `  ${cfg.subdomain}: ${ok ? "indexes synced" : "index sync FAILED (run manually: curl -X POST -H \"x-cron-secret: <CRON_SECRET>\" http://localhost:3001/api/admin/indexes/sync)"}`
    );
  }
}

console.log("\n=== Deploy summary ===");
for (const cfg of companies) {
  const status = failed.includes(cfg.subdomain) ? "FAILED" : "ok";
  console.log(`  ${cfg.subdomain}: ${status}`);
}

if (failed.length > 0) {
  console.error(`\n${failed.length} company(ies) failed: ${failed.join(", ")}`);
  process.exit(1);
}
