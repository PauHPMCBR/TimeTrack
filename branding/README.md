# Branding folder

This folder is a **build staging area** — do not edit it by hand. The
`scripts/build-company.js` script manages it: for each company it copies
`icon.png` / `favicon.png` from the paths given in the company's config file
(clearing any previous files first), then the `frontend/Dockerfile` bakes them
into the image.

If you build the frontend manually (without the script), drop the files here
before `docker build`:

- `icon.png` — company logo. **~480px tall is the target** (any aspect ratio;
  wider logos are rendered taller-than-narrow by keeping the **height** fixed
  and letting the width follow). Used on the login page, in the email footer
  (via `EMAIL_LOGO_URL`) and as the source for the top-toolbar logo.
- `favicon.png` — browser-tab favicon (must be square; 32x32 or 64x64 is fine)

The build generates a **128px-height toolbar variant** (`icon-toolbar.png`) from
`icon.png` automatically (ImageMagick, in the Dockerfile), so small renders
don't download the full image.

Both files are optional. If absent, the stock TimeTrack360 branding (clock logo
+ default favicon) is used. These files are git-ignored on purpose — they are
per-company artifacts, not source code.

The deployment-specific instructions live in `deploy-docs/` (not pushed).