import { NextApiRequest, NextApiResponse } from 'next';
import { MS_PER_MINUTE } from 'shared/src/lib/constants';

interface RateLimitEntry {
    count: number;
    lastReset: number;
}

// In-memory, single-process rate limiting. Adequate for the single-backend
// deployment this project targets (one Next.js container per company). If the
// backend is ever scaled horizontally, move this to Redis.
const rateLimitMap = new Map<string, RateLimitEntry>();
const MAX_ENTRIES = 10_000;
const DEFAULT_RATE_LIMIT = 100;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 15 * MS_PER_MINUTE;

// Keys on the client IP. When the backend sits behind a trusted reverse proxy
// (TRUST_PROXY=true), the proxy's socket address is shared by every client, so
// the real client IP is read from the *last* X-Forwarded-For entry (the one the
// trusted proxy appends). Otherwise X-Forwarded-For is never honored: a client
// could otherwise rotate the left-most value at will to reset its rate-limit
// budget.
function clientIp(req: NextApiRequest): string {
    if (process.env.TRUST_PROXY === 'true') {
        const forwarded = req.headers['x-forwarded-for'];
        if (typeof forwarded === 'string') {
            const parts = forwarded.split(',').map((p) => p.trim()).filter(Boolean);
            const last = parts[parts.length - 1];
            if (last) return last;
        }
    }
    return req.socket?.remoteAddress || 'unknown';
}

function prune(windowMs: number): void {
    if (rateLimitMap.size < MAX_ENTRIES) return;
    const cutoff = Date.now() - windowMs;
    rateLimitMap.forEach((entry, key) => {
        if (entry.lastReset < cutoff) rateLimitMap.delete(key);
    });
}

export const rateLimit = (
    req: NextApiRequest,
    res: NextApiResponse,
    limit: number = DEFAULT_RATE_LIMIT,
    windowMs: number = DEFAULT_RATE_LIMIT_WINDOW_MS
): boolean => {
    // Don't throttle the test suite, which shares one 'unknown' key across all
    // requests.
    if (process.env.NODE_ENV === 'test') return true;

    const now = Date.now();
    const ip = clientIp(req);

    let entry = rateLimitMap.get(ip);
    if (!entry) {
        entry = { count: 0, lastReset: now };
        rateLimitMap.set(ip, entry);
    }

    if (now - entry.lastReset > windowMs) {
        entry.count = 0;
        entry.lastReset = now;
    }

    prune(windowMs);

    if (entry.count >= limit) {
        return false;
    }

    entry.count++;
    return true;
};

interface RateLimitOptions {
    limit?: number;
    windowMs?: number;
}

// Wraps an API handler with a rate limit. Rejects excess requests with 429 +
// Retry-After, matching the standard response envelope.
export const withRateLimit = (
    handler: (req: NextApiRequest, res: NextApiResponse) => unknown,
    options: RateLimitOptions = {}
) => {
    return async (req: NextApiRequest, res: NextApiResponse) => {
        const windowMs = options.windowMs ?? DEFAULT_RATE_LIMIT_WINDOW_MS;
        const limit = options.limit ?? DEFAULT_RATE_LIMIT;

        if (!rateLimit(req, res, limit, windowMs)) {
            res.setHeader('Retry-After', String(Math.ceil(windowMs / 1000)));
            return res.status(429).json({
                success: false,
                error: 'RateLimited',
                details: { retryAfterSeconds: Math.ceil(windowMs / 1000) },
            });
        }

        return handler(req, res);
    };
};
