#!/usr/bin/env node
// Builds a company's frontend (and optionally backend) Docker images.
//
// The company's build info — subdomain, name and absolute paths to the
// branding files — comes from the `x-company` extension block in its docker
// compose file (the company's single source of truth; see
// deploy-docs/templates/company-compose.yml). The root DOMAIN is intentionally
// NOT part of company configs: it is resolved from (highest priority first):
//   1. the --domain CLI flag,
//   2. the DEPLOY_DOMAIN environment variable,
//   3. a gitignored deployment config at deploy-docs/config.json
//      ({ "domain": "example.com" }).
// This keeps company configs deployment-agnostic and keeps the real domain out
// of anything pushed to a public repo.
//
// This script:
//   1. reads the company's build info (subdomain, name, iconFile, faviconFile)
//      from the `x-company` extension block in its docker compose file (the
//      company's single source of truth — see company-compose.yml),
//   2. stages icon.png / favicon.png into branding/ (clearing any previous
//      files first so one company's logo can never leak into another build),
//   3. builds the frontend image with the name and backend URL baked in,
//   4. optionally builds the backend image and/or tags+pushes to a registry,
//   5. prints the Caddyfile entries the operator needs.
//
// Usage:
//   node scripts/build-company.js --compose /opt/timetrack/companies/mobe/compose.yml [--backend] [--domain x.com]
//   node scripts/build-company.js --compose /opt/timetrack/companies/mobe/compose.yml --push-tag ghcr.io/me
//
// The `x-company` block in the compose file carries the build metadata:
//   x-company:
//     subdomain: mobe            // required
//     name: MOBE                 // optional, default TimeTrack360
//     iconFile: /path/icon.png   // optional
//     faviconFile: /path/favicon.png  // optional
//
// (Legacy: `--config <company.json>` still works for a standalone JSON config,
// but the compose file is now the preferred, centralised source.)
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

// Reads the `x-company` extension block from a docker compose file via
// `docker compose config --format json` (extension fields are preserved in the
// canonical output, so no YAML parser is needed). Runs with the compose file's
// directory as cwd so a per-company `.env` next to it resolves ${VAR} refs.
export function readCompanyFromCompose(composePath) {
  const resolved = resolve(composePath);
  const out = execFileSync(
    "docker",
    ["compose", "-f", resolved, "config", "--format", "json"],
    { cwd: dirname(resolved), encoding: "utf8" }
  );
  const data = JSON.parse(out);
  const meta = data["x-company"];
  if (!meta || !meta.subdomain) {
    throw new Error(
      `No "x-company" block with a "subdomain" found in ${composePath}.\n` +
        "Add it at the top of the compose file — see deploy-docs/templates/company-compose.yml."
    );
  }
  return {
    subdomain: String(meta.subdomain),
    name: meta.name,
    iconFile: meta.iconFile,
    faviconFile: meta.faviconFile,
  };
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

export const COMPANY_LANGUAGES = ["ca", "en", "es"];

export function resolveCompanyLanguage(cfg) {
  const lang = String(cfg.language || "ca").toLowerCase();
  if (!COMPANY_LANGUAGES.includes(lang)) {
    console.warn(
      `Warning: unknown language "${cfg.language}" (supported: ${COMPANY_LANGUAGES.join(", ")}); using "ca".`
    );
    return "ca";
  }
  return lang;
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

Runtime config now lives in the company compose file. Remember to fill in its
secrets (MONGODB_URI, JWT_SECRET, SMTP_USER/SMTP_PASS, CRON_SECRET) and, if the
company has branding, set:
  EMAIL_LOGO_URL: ${frontendUrl}/brand/icon.png`);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  function usage() {
    console.error(
      "Usage: node scripts/build-company.js --compose /path/to/compose.yml [--backend] [--domain <root-domain>] [--push-tag <registry>]\n" +
        "       (legacy: --config /path/to/company.json)"
    );
    process.exit(1);
  }

  const argv = process.argv.slice(2);
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--config") args.config = argv[++i];
    else if (argv[i] === "--compose") args.compose = argv[++i];
    else if (argv[i] === "--backend") args.backend = true;
    else if (argv[i] === "--push-tag") args.pushTag = argv[++i];
    else if (argv[i] === "--domain") args.domain = argv[++i];
    else usage();
  }
  if (!args.config && !args.compose) usage();

  const cfg = args.compose
    ? readCompanyFromCompose(args.compose)
    : readCompanyConfig(args.config);
  if (!cfg.subdomain) {
    console.error("The company config must include 'subdomain'.");
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
