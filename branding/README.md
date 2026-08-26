# Branding folder

This folder is a **build staging area** — do not edit it by hand. The
`scripts/build-company.js` script manages it: for each company it copies
`icon.png` / `favicon.png` from the paths given in the company's config file
(clearing any previous files first), then the `frontend/Dockerfile` bakes them
into the image.

If you build the frontend manually (without the script), drop the files here
before `docker build`:

- `icon.png` — login-page logo (square PNG; displayed at 40x40)
- `favicon.png` — browser-tab favicon (square PNG; 32x32 or 64x64 is fine)

Both files are optional. If absent, the stock TimeTrack360 branding (clock logo
+ default favicon) is used. These files are git-ignored on purpose — they are
per-company artifacts, not source code.

The deployment-specific instructions live in `deploy-docs/` (not pushed).