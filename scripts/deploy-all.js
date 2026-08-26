#!/usr/bin/env node
// Deploys every company on the server in one shot. Meant to run on the VPS
// where /opt/timetrack lives (after `git pull` in the repo):
//
//   node scripts/deploy-all.js
//
// What it does, per company config found in deploy-docs/companies/*.json:
//   1. builds the shared backend image once (tag registre-jornada-backend:latest),
//   2. builds the company's frontend image (branding + baked backend URL),
//   3. recreates the company's stack: docker compose up -d --force-recreate,
//   4. polls GET /api/health and reports whether the company came up healthy.
//
// Options:
//   --pull            run `git pull` in the repo first
//   --skip-backend    don't rebuild the shared backend image
//   --skip-health     don't wait for /api/health after recreating
//   --dir <path>      companies base dir (default: $COMPANIES_DIR or /opt/timetrack/companies)
//   --domain <d>      root domain override (default: deploy-docs/config.json)
import { readdirSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import {
  readCompanyConfig,
  resolveDomain,
  buildFrontend,
  buildBackend,
} from "./build-company.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const companiesConfigDir = join(repoRoot, "deploy-docs", "companies");
const DEFAULT_COMPANIES_DIR = "/opt/timetrack/companies";

function usage() {
  console.error(
    "Usage: node scripts/deploy-all.js [--pull] [--skip-backend] [--skip-health] [--dir <path>] [--domain <root-domain>]"
  );
  process.exit(1);
}

const argv = process.argv.slice(2);
const args = { pull: false, backend: true, health: true, companiesDir: process.env.COMPANIES_DIR };
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--pull") args.pull = true;
  else if (argv[i] === "--skip-backend") args.backend = false;
  else if (argv[i] === "--skip-health") args.health = false;
  else if (argv[i] === "--dir") args.companiesDir = argv[++i];
  else if (argv[i] === "--domain") args.domain = argv[++i];
  else usage();
}
if (!args.companiesDir) args.companiesDir = DEFAULT_COMPANIES_DIR;

const domain = resolveDomain({ flag: args.domain, env: process.env.DEPLOY_DOMAIN });
if (!domain) {
  console.error(
    "No root domain configured. Pass --domain <root-domain>, set DEPLOY_DOMAIN,\n" +
      "or create deploy-docs/config.json with { \"domain\": \"example.com\" }."
  );
  process.exit(1);
}

if (args.pull) {
  console.log("== git pull ==");
  execFileSync("git", ["pull"], { cwd: repoRoot, stdio: "inherit" });
}

const configFiles = readdirSync(companiesConfigDir).filter((f) => f.endsWith(".json")).sort();
if (configFiles.length === 0) {
  console.error(`No company configs found in ${companiesConfigDir}`);
  process.exit(1);
}

const companies = configFiles.map((f) => {
  const cfg = readCompanyConfig(join(companiesConfigDir, f));
  if (!cfg.subdomain) {
    console.error(`Invalid config ${f}: missing 'subdomain'.`);
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
  console.log(`\n== ${cfg.subdomain}: building frontend image ==");
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

  console.log(`== ${cfg.subdomain}: recreating stack ==");
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
