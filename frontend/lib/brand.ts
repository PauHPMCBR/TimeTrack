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
