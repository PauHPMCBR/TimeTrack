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
//   3. the `DOMAIN` line in /opt/timetrack/.env (the infra dir, overridable
//      with INFRA_DIR).
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
import { readFileSync, rmSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const brandingDir = join(repoRoot, "branding");

// Infra dir holds the shared compose + .env (root domain, secrets). Overridable
// with INFRA_DIR for other layouts.
export const DEFAULT_INFRA_DIR = process.env.INFRA_DIR || "/opt/timetrack";

// Reads KEY=VALUE lines from a .env file (no shell parsing, no exports).
export function readDotEnv(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
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

export function resolveDomain({ infraDir = DEFAULT_INFRA_DIR, flag, env }) {
  return flag || env || readDotEnv(join(infraDir, ".env")).DOMAIN;
}

// Normalizes a branding source into a true PNG (any input format: PNG, AVIF,
// WebP, JPEG, ...). This matters because the Dockerfile bakes the file as
// "icon.png" / "favicon.png" and serves it as image/png — an AVIF file just
// renamed to .png (a common mistake) would not render in strict browsers.
async function toPng(inputPath, outputPath) {
  await sharp(inputPath, { failOn: "none" }).png().toFile(outputPath);
}

export async function stageBranding(cfg, dir = brandingDir) {
  mkdirSync(dir, { recursive: true });
  rmSync(join(dir, "icon.png"), { force: true });
  rmSync(join(dir, "favicon.png"), { force: true });
  if (cfg.iconFile) {
    await toPng(resolve(cfg.iconFile), join(dir, "icon.png"));
  }
  if (cfg.faviconFile) {
    await toPng(resolve(cfg.faviconFile), join(dir, "favicon.png"));
  }
}

export async function buildFrontend(cfg, domain, root = repoRoot) {
  const appName = cfg.name || "TimeTrack360";
  const backendUrl = cfg.backendUrl || `https://api.${cfg.subdomain}.${domain}`;
  await stageBranding(cfg);
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

Runtime config now lives in the company compose file. Remember to fill in its
secrets (MONGODB_URI, JWT_SECRET, SMTP_USER/SMTP_PASS, CRON_SECRET) and, if the
company has branding, set:
  EMAIL_LOGO_URL: ${frontendUrl}/brand/icon.png`);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  function usage() {
    console.error(
      "Usage: node scripts/build-company.js --compose /path/to/compose.yml [--backend] [--domain <root-domain>] [--push-tag <registry>]"
    );
    process.exit(1);
  }

  const argv = process.argv.slice(2);
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--compose") args.compose = argv[++i];
    else if (argv[i] === "--backend") args.backend = true;
    else if (argv[i] === "--push-tag") args.pushTag = argv[++i];
    else if (argv[i] === "--domain") args.domain = argv[++i];
    else usage();
  }
  if (!args.compose) usage();

  const cfg = readCompanyFromCompose(args.compose);
  if (!cfg.subdomain) {
    console.error("The company compose's x-company block must include 'subdomain'.");
    process.exit(1);
  }

  const domain = resolveDomain({ flag: args.domain, env: process.env.DEPLOY_DOMAIN });
  if (!domain) {
    console.error(
      "No root domain configured. Pass --domain <root-domain>, set DEPLOY_DOMAIN,\n" +
        "or add DOMAIN=<root-domain> to /opt/timetrack/.env."
    );
    process.exit(1);
  }

  await buildFrontend(cfg, domain);

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
