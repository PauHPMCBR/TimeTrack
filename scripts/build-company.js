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
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const brandingDir = join(repoRoot, "branding");

export function readCompanyConfig(path) {
  return JSON.parse(readFileSync(resolve(path), "utf8"));
}

export function resolveDomain({ repoRoot: root = repoRoot, flag, env }) {
  let domain = flag || env;
  const cfgPath = join(root, "deploy-docs", "config.json");
  if (!domain && existsSync(cfgPath)) {
    try {
      domain = JSON.parse(readFileSync(cfgPath, "utf8")).domain;
    } catch {
      domain = undefined;
    }
  }
  return domain;
}

export function stageBranding(cfg, dir = brandingDir) {
  mkdirSync(dir, { recursive: true });
  rmSync(join(dir, "icon.png"), { force: true });
  rmSync(join(dir, "favicon.png"), { force: true });
  if (cfg.iconFile) {
    cpSync(resolve(cfg.iconFile), join(dir, "icon.png"));
  }
  if (cfg.faviconFile) {
    cpSync(resolve(cfg.faviconFile), join(dir, "favicon.png"));
  }
}

export function buildFrontend(cfg, domain, root = repoRoot) {
  const appName = cfg.name || "TimeTrack360";
  const backendUrl = cfg.backendUrl || `https://api.${cfg.subdomain}.${domain}`;
  stageBranding(cfg);
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
      `registre-jornada-frontend:${cfg.subdomain}`,
      ".",
    ],
    { cwd: root, stdio: "inherit" }
  );
}

export function buildBackend(root = repoRoot) {
  execFileSync("docker", ["build", "-f", "backend/Dockerfile", "-t", "registre-jornada-backend:latest", "."], {
    cwd: root,
    stdio: "inherit",
  });
}

export function printInfo(cfg, domain) {
  const frontendTag = `registre-jornada-frontend:${cfg.subdomain}`;
  const backendTag = "registre-jornada-backend:latest";
  const backendUrl = cfg.backendUrl || `https://api.${cfg.subdomain}.${domain}`;
  const frontendUrl = cfg.frontendUrl || `https://${cfg.subdomain}.${domain}`;

  console.log(`\n=== ${cfg.subdomain}.${domain} ===
frontend:  ${frontendTag}
backend:   ${backendTag}
frontendUrl: ${frontendUrl}
backendUrl:  ${backendUrl}

Caddyfile entries to append (Caddyfile):
${cfg.subdomain}.${domain}         { reverse_proxy ${cfg.subdomain}-frontend:3000 }
api.${cfg.subdomain}.${domain}     { reverse_proxy ${cfg.subdomain}-backend:3001 }

Per-company compose (companies/${cfg.subdomain}/compose.yml):
  container_name: "${cfg.subdomain}-frontend"
  container_name: "${cfg.subdomain}-backend"
  FRONTEND_URL: ${frontendUrl}
  MONGODB_URI: mongodb://${cfg.subdomain}:<db-password>@mongodb:27017/myapp_${cfg.subdomain}?authSource=myapp_${cfg.subdomain}`);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
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

  const cfg = readCompanyConfig(args.config);
  if (!cfg.subdomain) {
    console.error("Config must include 'subdomain'.");
    process.exit(1);
  }

  const domain = resolveDomain({ flag: args.domain, env: process.env.DEPLOY_DOMAIN });
  if (!domain) {
    console.error(
      "No root domain configured. Pass --domain <root-domain>, set DEPLOY_DOMAIN,\n" +
        "or create deploy-docs/config.json with { \"domain\": \"example.com\" }."
    );
    process.exit(1);
  }

  buildFrontend(cfg, domain);

  if (args.backend) {
    buildBackend();
  }
  if (args.pushTag) {
    execFileSync("docker", ["tag", `registre-jornada-frontend:${cfg.subdomain}`, `${args.pushTag}:${cfg.subdomain}`], {
      stdio: "inherit",
    });
    execFileSync("docker", ["push", `${args.pushTag}:${cfg.subdomain}`], { stdio: "inherit" });
    if (args.backend) {
      execFileSync("docker", ["tag", "registre-jornada-backend:latest", `${args.pushTag}:backend`], { stdio: "inherit" });
      execFileSync("docker", ["push", `${args.pushTag}:backend`], { stdio: "inherit" });
    }
  }

  printInfo(cfg, domain);
}
