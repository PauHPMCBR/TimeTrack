#!/usr/bin/env node
// Runs the numbered DB migrations (database/migrations/*.cjs) for every
// company on the server, in order. Meant to run on the deployment host BEFORE
// `deploy-all.js` recreates the stacks — they are plain mongo operations and
// are safe while the old backend still serves (guide 10):
//
//   node scripts/migrate-all.js          # all migrations, all companies
//   node scripts/migrate-all.js 1 5      # migrations 001..005 only
//   node scripts/migrate-all.js 3        # just 003
//   node scripts/migrate-all.js --dir /opt/timetrack/companies
//
// Companies are discovered the same way deploy-all does it: one directory per
// company under COMPANIES_DIR (or --dir), each with a compose.yml whose backend
// environment carries MONGODB_URI (and ENCRYPTION_KEY/HASH_KEY for migration
// 003 — same values the backend runs with).
//
// Each migration runs INSIDE the company's backend container (docker compose
// run): mongo is internal-only on the VPS, so the in-network `mongodb`
// hostname only resolves there. The migrations dir is mounted read-only into
// the image's workspace (/app/backend) so require() finds the image's
// node_modules, and the company env is passed through explicitly.
//
// Failure semantics: per company, migrations stop at the first failure (order
// matters); other companies keep going. Exits non-zero if any failed.
import { readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { readCompanyFromCompose } from "./build-company.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const migrationsDir = join(repoRoot, "database", "migrations");

function usage() {
  console.error(
    "Usage: node scripts/migrate-all.js [<from> <to>] [--dir <companies-dir>] [--yes]\n" +
      "  <from>/<to>: migration numbers (1..9), e.g. `1 5` runs 001..005;\n" +
      "  a single number runs just that migration; no numbers = all."
  );
  process.exit(1);
}

const argv = process.argv.slice(2);
const args = { companiesDir: process.env.COMPANIES_DIR, yes: false };
const numbers = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--dir") args.companiesDir = argv[++i];
  else if (argv[i] === "--yes") args.yes = true;
  else if (/^[1-9]$/.test(argv[i])) numbers.push(Number(argv[i]));
  else usage();
}
if (numbers.length > 2) usage();
const [from, to] =
  numbers.length === 2
    ? [numbers[0], numbers[1]]
    : numbers.length === 1
      ? [numbers[0], numbers[0]]
      : [null, null];
if (from !== null && to < from) usage();

if (!args.companiesDir) {
  console.error(
    "No companies dir configured. Pass --dir <path> or set COMPANIES_DIR\n" +
      "(expected layout: <dir>/<company>/compose.yml; see scripts/README.md)."
  );
  process.exit(1);
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

// Migration files are numbered NNN-<name>.cjs; resolve the requested range
// against what actually exists.
const files = readdirSync(migrationsDir)
  .filter((f) => /^\d{3}-.+\.cjs$/.test(f))
  .sort();
const number = (f) => Number(f.slice(0, 3));
const selected =
  from === null
    ? files
    : files.filter((f) => number(f) >= from && number(f) <= to);
if (selected.length === 0) {
  console.error(
    `No migrations match the requested range ${
      from === null ? "" : `${from}..${to} `
    }in ${migrationsDir} (available: ${files.map((f) => number(f)).join(", ")})`
  );
  process.exit(1);
}

const DESTRUCTIVE = new Set([4]);

const destructive = selected.filter((f) => DESTRUCTIVE.has(number(f)));
if (destructive.length > 0 && !args.yes) {
  console.log(
    `WARNING: migration(s) ${destructive.map((f) => number(f)).join(", ")} ` +
      "are DESTRUCTIVE (old rows are deleted, not transformed).\n" +
      "Take a manual mongodump of every company DB first (guide 10.1).\n" +
      "Companies to migrate: " +
      companies.map((c) => c.subdomain).join(", ")
  );
  const rl = createInterface({ input: stdin, output: stdout });
  let answer;
  try {
    answer = await rl.question("Continue? [y/N] ");
  } catch {
    answer = ""; // stdin closed / EOF → do not run destructive migrations
  }
  rl.close();
  if (answer.trim().toLowerCase() !== "y") {
    console.log("Aborted.");
    process.exit(1);
  }
}

console.log(
  `Running migrations ${selected.map((f) => number(f)).join(", ")} for ` +
    `${companies.length} company(ies) under ${args.companiesDir}\n`
);

const failed = [];

for (const cfg of companies) {
  if (!cfg.mongoUri) {
    console.error(
      `== ${cfg.subdomain}: no MONGODB_URI in compose backend env — skipped`
    );
    failed.push(cfg.subdomain);
    continue;
  }
  console.log(`\n== ${cfg.subdomain} ==`);
  if (cfg.hashKey === undefined && selected.some((f) => number(f) === 3)) {
    console.error(
      `  WARNING: no ENCRYPTION_KEY/HASH_KEY in compose backend env — ` +
        "migration 003 will refuse to run (guide 10.3)"
    );
  }
  for (const file of selected) {
    console.log(`  -- ${file}`);
    try {
      // Runs in the backend container: only there does the in-network mongo
      // hostname resolve. Mount the migrations into the image's workspace so
      // the image's node_modules satisfies require(); compose run picks up
      // the service's env, with explicit -e as a deterministic override.
      execFileSync(
        "docker",
        [
          "compose",
          "-f",
          join(args.companiesDir, cfg.subdomain, "compose.yml"),
          "run",
          "--rm",
          "--no-deps",
          "-v",
          `${migrationsDir}:/app/backend/database/migrations:ro`,
          "-w",
          "/app/backend",
          "-e",
          `MONGODB_URI=${cfg.mongoUri}`,
          ...(cfg.encryptionKey ? ["-e", `ENCRYPTION_KEY=${cfg.encryptionKey}`] : []),
          ...(cfg.hashKey ? ["-e", `HASH_KEY=${cfg.hashKey}`] : []),
          "backend",
          "node",
          join("database", "migrations", file),
        ],
        {
          cwd: join(args.companiesDir, cfg.subdomain),
          stdio: "inherit",
        }
      );
    } catch {
      console.error(
        `  ${file} FAILED for ${cfg.subdomain} — stopping this company's ` +
          "remaining migrations (order matters)"
      );
      failed.push(cfg.subdomain);
      break;
    }
  }
}

console.log("\n=== Migration summary ===");
for (const cfg of companies) {
  const status = failed.includes(cfg.subdomain) ? "FAILED" : "ok";
  console.log(`  ${cfg.subdomain}: ${status}`);
}

if (failed.length > 0) {
  console.error(`\n${failed.length} company(ies) failed: ${failed.join(", ")}`);
  process.exit(1);
}
