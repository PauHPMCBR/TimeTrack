import { NextApiRequest, NextApiResponse } from 'next';

interface RateLimitEntry {
  count: number;
  lastReset: number;
}

// In-memory, single-process rate limiting. Adequate for the single-backend
// deployment this project targets (one Next.js container per company). If the
// backend is ever scaled horizontally, move this to Redis.
const rateLimitMap = new Map<string, RateLimitEntry>();
const MAX_ENTRIES = 10_000;

// Keys on the client IP. Behind a reverse proxy every request shares the
// proxy's socket address, so prefer the left-most (client) X-Forwarded-For
// entry when present.
function clientIp(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }
  return req.socket?.remoteAddress || 'unknown';
}

// Prune stale entries so the map can't grow unboundedly.
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
  limit: number = 100,
  windowMs: number = 15 * 60 * 1000
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
    const windowMs = options.windowMs ?? 15 * 60 * 1000;
    const limit = options.limit ?? 100;

    if (!rateLimit(req, res, limit, windowMs)) {
      res.setHeader('Retry-After', String(Math.ceil(windowMs / 1000)));
      return res.status(429).json({
        error: 'RateLimited',
        details: { retryAfterSeconds: Math.ceil(windowMs / 1000) },
      });
    }

    return handler(req, res);
  };
};