import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Allowed frontend origins. Keep this list explicit — never reflect arbitrary
// origins, and don't ship dev-only hosts.
const allowedOrigins = [
    process.env.FRONTEND_URL,
    'http://frontend:3000', // Docker container name
    'http://localhost:3000', // Browser access
    'http://127.0.0.1:3000', // Alternative localhost
    'http://host.docker.internal:3000', // Docker host (fallback)
].filter(Boolean) as string[];

function applyCorsHeaders(response: NextResponse | Response, origin: string) {
    // Auth uses a JWT in localStorage, never cookies, so no
    // Access-Control-Allow-Credentials is needed.
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, OPTIONS'
    );
    response.headers.set(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization'
    );
}

export function middleware(request: NextRequest) {
    const requestOrigin = request.headers.get('origin');
    const allowedOrigin =
        requestOrigin !== null && allowedOrigins.includes(requestOrigin)
            ? requestOrigin
            : allowedOrigins[0] || 'http://localhost:3000';

    if (request.method === 'OPTIONS') {
        const response = new Response(null, { status: 200 });
        applyCorsHeaders(response, allowedOrigin);
        return response;
    }

    const response = NextResponse.next();
    applyCorsHeaders(response, allowedOrigin);
    // Vary: Origin so caches don't serve a response for one origin to another.
    response.headers.set('Vary', 'Origin');

    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

    return response;
}

export const config = {
    matcher: '/api/:path*',
};
