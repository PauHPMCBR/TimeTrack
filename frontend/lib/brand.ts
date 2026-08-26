// Per-deployment branding. Values are NEXT_PUBLIC_* so they are inlined at
// build time (each company gets its own frontend image, so its build args
// define its branding). See frontend/Dockerfile for the build args.

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "TimeTrack360";

export const APP_ICON_URL = process.env.NEXT_PUBLIC_APP_ICON_URL || null;

export const FAVICON_URL = process.env.NEXT_PUBLIC_FAVICON_URL || null;