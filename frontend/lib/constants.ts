import { DEFAULT_FILE_MAX_BYTES } from 'shared/src/lib/constants';

// Frontend-only UI constants. Values shared with the backend live in
// `shared/src/lib/constants.ts` instead.
export const NOW_REFRESH_INTERVAL_MS = 30_000;
export const COPIED_LINK_FEEDBACK_MS = 2000;

export function getFileMaxBytes(): number {
    const raw = process.env.NEXT_PUBLIC_FILE_MAX_BYTES;
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0
        ? Math.floor(parsed)
        : DEFAULT_FILE_MAX_BYTES;
}
