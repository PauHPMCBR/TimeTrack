import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Determine the allowed origin dynamically
  const requestOrigin = request.headers.get('origin');
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    'http://frontend:3000',           // Docker container name
    'http://localhost:3000',          // Browser access
    'http://127.0.0.1:3000',          // Alternative localhost
    'http://10.4.41.75:3000',        // Local network IP
    'http://host.docker.internal:3000' // Docker host (fallback)
  ].filter(Boolean);

  // Use the request origin if it's allowed, otherwise use the first allowed origin
  const allowedOrigin = (requestOrigin !== null && allowedOrigins.includes(requestOrigin))
    ? requestOrigin 
    : allowedOrigins[0] || 'http://localhost:3000';

  if (request.method === 'OPTIONS') {
    const response = new Response(null, { status: 200 });
    response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    return response;
  }
  
  const response = NextResponse.next();

  // CORS headers
  response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.headers.set('Access-Control-Allow-Credentials', 'true');

  // Security headers (similar to helmet)
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return response;
}

export const config = {
  matcher: '/api/:path*',
};