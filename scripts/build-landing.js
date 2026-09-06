#!/usr/bin/node
// Builds the static site served by Caddy at the apex domain (see
// deploy-docs/03-infra-docker.md §3.4):
//
//   landing/src/index.html -> landing/dist/index.html  (as-is)
//   landing/dist/landing.css (Tailwind build over the landing templates using
//                             the frontend's tailwind.config.js + globals.css,
//                             so the page uses the exact same Catppuccin
//                             theme as the app; light/dark via the `dark`
//                             class, set by an inline script that follows
//                             prefers-color-scheme)
//   docs/guide.typ -> landing/dist/guide.pdf  (typst PDF export; also staged
//                     into branding/guide.pdf so the frontend Dockerfile bakes
//                     it into every company image at /guide.pdf — the guide
//                     links in the app point there, not to the apex domain)
//
// Requirements on PATH: typst (guide PDF), node + frontend/node_modules for
// the Tailwind CLI. Override the typst binary with TYPST=/path/to/typst.
//
// Usage: node scripts/build-landing.js [--minify]
// Deploy: copy the contents of landing/dist/ to the infra landing/ dir.
//
// Placeholders in landing/src/index.html are replaced at build time from env
// (generic defaults are used when unset — no real domains in the repo):
//   EXAMPLE_DOMAIN  example company subdomain shown in the copy
//                   (default: empresa.example.com)
//   CONTACT_EMAIL   contact address in the footer (default: contact@example.com)
import { readFileSync, writeFileSync, rmSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const srcDir = join(repoRoot, "landing", "src");
const distDir = join(repoRoot, "landing", "dist");

const argv = process.argv.slice(2);
const minify = argv.includes("--minify");

function fail(msg) {
  console.error(`build-landing: ${msg}`);
  process.exit(1);
}

// 0. Clean output.
rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

// 1. CSS: Tailwind build over the landing template using the app's config.
console.log("== tailwind: building landing.css ==");
execFileSync(
  "npx",
  [
    "tailwindcss",
    "-c",
    "tailwind.config.js",
    "-i",
    "app/globals.css",
    "-o",
    join(distDir, "landing.css"),
    "--content",
    "../landing/src/index.html",
    ...(minify ? ["--minify"] : []),
  ],
  { cwd: join(repoRoot, "frontend"), stdio: "inherit" }
);
writeFileSync(
  join(distDir, "landing.css"),
  readFileSync(join(distDir, "landing.css"), "utf8") +
    "\n" +
    readFileSync(join(srcDir, "extras.css"), "utf8")
);

// 2. Guide: PDF export via typst.
console.log("== typst: compiling guide.pdf ==");
const typst = process.env.TYPST || "typst";
const typstCheck = spawnSync(typst, ["--version"]);
if (typstCheck.error || typstCheck.status !== 0) {
  fail(
    `typst not found (PATH=${process.env.PATH}). Install it or pass TYPST=/path/to/typst.`
  );
}
try {
  execFileSync(
    typst,
    ["compile", join(repoRoot, "docs", "guide.typ"), join(distDir, "guide.pdf")],
    { stdio: ["ignore", "ignore", "pipe"] }
  );
  // Stage a copy for the frontend builds (baked into each company image).
  mkdirSync(join(repoRoot, "branding"), { recursive: true });
  execFileSync("cp", [join(distDir, "guide.pdf"), join(repoRoot, "branding", "guide.pdf")]);
} catch (err) {
  fail(`typst compile failed:\n${err.stderr || err.message}`);
}

// 3. Landing index: copy and substitute placeholders from env.
const html = readFileSync(join(srcDir, "index.html"), "utf8")
  .replaceAll("{{EXAMPLE_DOMAIN}}", process.env.EXAMPLE_DOMAIN || "empresa.example.com")
  .replaceAll("{{CONTACT_EMAIL}}", process.env.CONTACT_EMAIL || "contact@example.com");
writeFileSync(join(distDir, "index.html"), html);

console.log(`
== done ==
landing/dist/ contents (deploy to the landing dir Caddy serves at the apex domain):`);
for (const f of ["index.html", "landing.css", "guide.pdf"]) {
  const p = join(distDir, f);
  if (!existsSync(p)) fail(`expected output missing: ${p}`);
  console.log(`  ${f} (${Math.round(readFileSync(p).length / 1024)} KiB)`);
}
