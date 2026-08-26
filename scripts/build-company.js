#!/usr/bin/env node
// Builds a company's frontend (and optionally backend) Docker images from a
// single per-company config file.
//
// The config lives anywhere (e.g. deploy-docs/companies/<company>.json) and
// holds the company subdomain, name and absolute paths to the branding files.
// The root DOMAIN is intentionally NOT part of company configs: it is resolved
// from (highest priority first):
//   1. the --domain CLI flag,
//   2. the DEPLOY_DOMAIN environment variable,
//   3. a gitignored deployment config at deploy-docs/config.json
//      ({ "domain": "example.com" }).
// This keeps company configs deployment-agnostic and keeps the real domain out
// of anything pushed to a public repo.
//
// This script:
//   1. stages icon.png / favicon.png into branding/ (clearing any previous
//      files first so one company's logo can never leak into another build),
//   2. builds the frontend image with the name and backend URL baked in,
//   3. optionally builds the backend image and/or tags+pushes to a registry,
//   4. prints the Caddyfile entries and compose env values the operator needs.
//
// Usage:
//   node scripts/build-company.js --config <company.json> [--backend] [--domain x.com]
//   node scripts/build-company.js --config <company.json> --push-tag ghcr.io/me
//
// Config schema (see scripts/company.example.json):
//   {
//     "subdomain": "acme",            // required
//     "name": "ACME",                 // optional, default TimeTrack360
//     "iconFile": "/abs/path/icon.png",      // optional
//     "faviconFile": "/abs/path/favicon.png" // optional
//   }
import { readFileSync, cpSync, rmSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const brandingDir = join(repoRoot, "branding");
const deployConfigPath = join(repoRoot, "deploy-docs", "config.json");

function usage() {
  console.error(
    "Usage: node scripts/build-company.js --config <company.json> [--backend] [--domain <root-domain>] [--push-tag <registry>]"
  );
  process.exit(1);
}

const argv = process.argv.slice(2);
const args = {};
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--config") args.config = argv[++i];
  else if (argv[i] === "--backend") args.backend = true;
  else if (argv[i] === "--push-tag") args.pushTag = argv[++i];
  else if (argv[i] === "--domain") args.domain = argv[++i];
  else usage();
}
if (!args.config) usage();

const cfg = JSON.parse(readFileSync(resolve(args.config), "utf8"));
const { subdomain } = cfg;
if (!subdomain) {
  console.error("Config must include 'subdomain'.");
  process.exit(1);
}

// Resolve the root domain (deployment context, never part of company config).
let domain = args.domain || process.env.DEPLOY_DOMAIN;
if (!domain && existsSync(deployConfigPath)) {
  try {
    domain = JSON.parse(readFileSync(deployConfigPath, "utf8")).domain;
  } catch {
    domain = undefined;
  }
}
if (!domain) {
  console.error(
    "No root domain configured. Pass --domain <root-domain>, set DEPLOY_DOMAIN,\n" +
      "or create deploy-docs/config.json with { \"domain\": \"example.com\" }."
  );
  process.exit(1);
}

const frontendTag = `registre-jornada-frontend:${subdomain}`;
const backendTag = "registre-jornada-backend:latest";
const appName = cfg.name || "TimeTrack360";
const backendUrl = cfg.backendUrl || `https://api.${subdomain}.${domain}`;
const frontendUrl = cfg.frontendUrl || `https://${subdomain}.${domain}`;

// 1. Stage branding files (absolute paths) into branding/ for the build.
//    Clear previous files first so stale logos never leak across companies.
mkdirSync(brandingDir, { recursive: true });
rmSync(join(brandingDir, "icon.png"), { force: true });
rmSync(join(brandingDir, "favicon.png"), { force: true });
if (cfg.iconFile) {
  cpSync(resolve(cfg.iconFile), join(brandingDir, "icon.png"));
}
if (cfg.faviconFile) {
  cpSync(resolve(cfg.faviconFile), join(brandingDir, "favicon.png"));
}

// 2. Build the frontend image.
execFileSync(
  "docker",
  [
    "build",
    "-f",
    "frontend/Dockerfile",
    "--build-arg",
    `NEXT_PUBLIC_BACKEND_URL=${backendUrl}`,
    "--build-arg",
    `NEXT_PUBLIC_APP_NAME=${appName}`,
    "-t",
    frontendTag,
    ".",
  ],
  { cwd: repoRoot, stdio: "inherit" }
);

// 3. Optionally build the backend and/or push.
if (args.backend) {
  execFileSync("docker", ["build", "-f", "backend/Dockerfile", "-t", backendTag, "."], {
    cwd: repoRoot,
    stdio: "inherit",
  });
}
if (args.pushTag) {
  execFileSync("docker", ["tag", frontendTag, `${args.pushTag}:${subdomain}`], { stdio: "inherit" });
  execFileSync("docker", ["push", `${args.pushTag}:${subdomain}`], { stdio: "inherit" });
  if (args.backend) {
    execFileSync("docker", ["tag", backendTag, `${args.pushTag}:backend`], { stdio: "inherit" });
    execFileSync("docker", ["push", `${args.pushTag}:backend`], { stdio: "inherit" });
  }
}

// 4. Print what the operator needs for compose + Caddy.
console.log(`\n=== ${subdomain}.${domain} ===
frontend:  ${frontendTag}
backend:   ${backendTag}
frontendUrl: ${frontendUrl}
backendUrl:  ${backendUrl}

Caddyfile entries to append (Caddyfile):
${subdomain}.${domain}         { reverse_proxy ${subdomain}-frontend:3000 }
api.${subdomain}.${domain}     { reverse_proxy ${subdomain}-backend:3001 }

Per-company compose (companies/${subdomain}/compose.yml):
  container_name: "${subdomain}-frontend"
  container_name: "${subdomain}-backend"
  FRONTEND_URL: ${frontendUrl}
  MONGODB_URI: mongodb://${subdomain}:<db-password>@mongodb:27017/myapp_${subdomain}?authSource=myapp_${subdomain}`);