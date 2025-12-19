import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // Handle custom domain routing first
  const customDomainResponse = await handleCustomDomain(request);
  if (customDomainResponse) {
    return customDomainResponse;
  }

  // Only apply to API routes
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Handle preflight OPTIONS requests
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: getCorsHeaders(request),
    });
  }

  // Add CORS headers to response
  const response = NextResponse.next();
  const corsHeaders = getCorsHeaders(request);
  const securityHeaders = getSecurityHeaders();

  // Apply CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // Apply security headers
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

/**
 * Handle custom domain routing
 * Route incoming requests from custom domains to the appropriate user/form
 */
async function handleCustomDomain(request: NextRequest): Promise<NextResponse | null> {
  const hostname = request.headers.get('host') || '';
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://veilforms.com';
  const baseDomain = new URL(baseUrl).hostname;

  // Skip if this is the main VeilForms domain
  if (hostname === baseDomain || hostname.endsWith(`.${baseDomain}`)) {
    return null;
  }

  // Skip if localhost/development
  if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
    return null;
  }

  // Extract the clean domain (remove port if present)
  const domain = hostname.split(':')[0];

  // Dynamic import to avoid issues with edge runtime
  try {
    const { getUserIdByDomain, isDomainActive } = await import('@/lib/custom-domains');

    // Check if domain is registered and active
    const isActive = await isDomainActive(domain);
    if (!isActive) {
      // Return a helpful error page
      return new NextResponse(
        `
        <!DOCTYPE html>
        <html>
          <head><title>Domain Not Configured</title></head>
          <body style="font-family: system-ui; max-width: 600px; margin: 100px auto; padding: 20px;">
            <h1>Domain Not Configured</h1>
            <p>This domain is not yet verified or configured for VeilForms.</p>
            <p>If you own this domain, please verify it in your VeilForms dashboard.</p>
          </body>
        </html>
        `,
        {
          status: 404,
          headers: { 'Content-Type': 'text/html' },
        }
      );
    }

    // Get user ID for this domain
    const userId = await getUserIdByDomain(domain);
    if (!userId) {
      return new NextResponse('Domain configuration error', { status: 500 });
    }

    // Add custom domain headers to the request
    // These can be used by form submission endpoints to identify the domain
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-veilforms-custom-domain', domain);
    requestHeaders.set('x-veilforms-domain-user', userId);

    // Allow the request to proceed with the custom headers
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch (error) {
    console.error('Custom domain middleware error:', error);
    // On error, just pass through
    return null;
  }
}

/**
 * Get security headers for all responses
 */
function getSecurityHeaders(): Record<string, string> {
  const isProduction = process.env.NODE_ENV === 'production';

  const headers: Record<string, string> = {
    // Prevent MIME type sniffing
    'X-Content-Type-Options': 'nosniff',

    // Prevent clickjacking
    'X-Frame-Options': 'DENY',

    // Enable XSS protection in legacy browsers
    'X-XSS-Protection': '1; mode=block',

    // Control referrer information
    'Referrer-Policy': 'strict-origin-when-cross-origin',

    // Restrict browser features
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',

    // Content Security Policy - safe defaults
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  };

  // Add HSTS only in production
  if (isProduction) {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  }

  return headers;
}

function getCorsHeaders(request: NextRequest): Record<string, string> {
  const origin = request.headers.get('origin');
  const isProduction = process.env.NODE_ENV === 'production';

  // Get allowed origins from environment
  const allowedOriginsEnv = process.env.ALLOWED_ORIGINS;

  // In production, NEVER default to wildcard
  if (isProduction && !allowedOriginsEnv) {
    return {
      'Access-Control-Allow-Origin': 'null',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token, X-Idempotency-Key',
      'Access-Control-Allow-Credentials': 'false',
      'Access-Control-Max-Age': '86400',
    };
  }

  const allowedOrigins = allowedOriginsEnv?.split(',') || ['*'];

  // Validate origin against whitelist
  let allowedOrigin = 'null';
  let allowCredentials = 'false';

  if (origin && allowedOrigins.includes(origin)) {
    allowedOrigin = origin;
    allowCredentials = 'true';
  } else if (allowedOrigins.includes('*') && !isProduction) {
    // Only allow wildcard in non-production
    allowedOrigin = origin || '*';
    allowCredentials = origin ? 'true' : 'false';
  }

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token, X-Idempotency-Key',
    'Access-Control-Allow-Credentials': allowCredentials,
    'Access-Control-Max-Age': '86400',
  };
}

export const config = {
  matcher: [
    // Match all routes for custom domain handling
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
