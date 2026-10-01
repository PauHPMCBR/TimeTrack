// Per-deployment branding. Values are NEXT_PUBLIC_* so they are inlined at
// build time (each company gets its own frontend image, so its build args
// define its branding). See frontend/Dockerfile for the build args.

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'TimeTrack360';

export const APP_ICON_URL = process.env.NEXT_PUBLIC_APP_ICON_URL || null;

// Small (32px height) variant of the logo, auto-generated at build time for
// tight spots like the top toolbar. Falls back to APP_ICON_URL when absent.
export const APP_ICON_TOOLBAR_URL =
    process.env.NEXT_PUBLIC_APP_ICON_TOOLBAR_URL || null;

export const FAVICON_URL = process.env.NEXT_PUBLIC_FAVICON_URL || null;

// Usage guide PDF, compiled from docs/guide.typ and baked into public/ at
// build time (NEXT_PUBLIC_GUIDE_URL=/guide.pdf). See frontend/Dockerfile.
// In dev the PDFs are copied into public/ by scripts/sync-guides.mjs (run
// before `next dev`). Null when absent => guide links are hidden.
const isDev = process.env.NODE_ENV === 'development';

export const GUIDE_URL =
    process.env.NEXT_PUBLIC_GUIDE_URL || (isDev ? '/guide.pdf' : null);

// Administration guide PDF, compiled from docs/guide_admin.typ and baked into
// public/ at build time (NEXT_PUBLIC_ADMIN_GUIDE_URL=/guide_admin.pdf). Only
// linked from the admin panel. Null when absent => the link is hidden.
export const ADMIN_GUIDE_URL =
    process.env.NEXT_PUBLIC_ADMIN_GUIDE_URL ||
    (isDev ? '/guide_admin.pdf' : null);
