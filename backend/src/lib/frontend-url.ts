import { DEFAULT_FRONTEND_URL } from 'shared/src/lib/defaults';

/** Base URL of the frontend, used to build registration / reset / deep links. */
export function getFrontendUrl(): string {
    return process.env.FRONTEND_URL || DEFAULT_FRONTEND_URL;
}
