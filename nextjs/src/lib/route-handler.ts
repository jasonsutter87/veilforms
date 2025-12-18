/**
 * VeilForms - Route Handler Middleware Factory
 * DRY up API routes by eliminating repetitive boilerplate
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "./auth";
import { checkRateLimit, getRateLimitHeaders } from "./rate-limit";
import { validateCsrfToken } from "./csrf";
import { errorResponse, ErrorCodes } from "./errors";

// Types
export interface AuthResult {
  user: { userId: string; email: string } | null;
  error?: string;
  status?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter?: number;
}

export interface RouteOptions {
  // Rate limiting
  rateLimit?: {
    keyPrefix: string;
    maxRequests?: number;
    windowMs?: number;
  };
  // Require CSRF token (for mutations)
  csrf?: boolean;
}

export interface AuthenticatedContext {
  user: { userId: string; email: string };
  rateLimit?: RateLimitResult;
}

// Handler types
type PublicHandler = (req: NextRequest) => Promise<NextResponse>;
type AuthenticatedHandler = (
  req: NextRequest,
  ctx: AuthenticatedContext
) => Promise<NextResponse>;

/**
 * Wrap a public route with optional rate limiting
 */
export function publicRoute(
  handler: PublicHandler,
  options?: RouteOptions
): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest) => {
    // Rate limiting
    if (options?.rateLimit) {
      const result = await checkRateLimit(req, options.rateLimit);
      if (!result.allowed) {
        return rateLimitResponse(result);
      }
    }

    return handler(req);
  };
}

/**
 * Wrap an authenticated route with rate limiting, auth, and optional CSRF
 */
export function authRoute(
  handler: AuthenticatedHandler,
  options?: RouteOptions
): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest) => {
    // Rate limiting
    let rateLimitResult: RateLimitResult | undefined;
    if (options?.rateLimit) {
      rateLimitResult = await checkRateLimit(req, options.rateLimit);
      if (!rateLimitResult.allowed) {
        return rateLimitResponse(rateLimitResult);
      }
    }

    // Authentication
    const auth = await authenticateRequest(req);
    if (auth.error || !auth.user) {
      return NextResponse.json(
        { error: auth.error || "Authentication required" },
        { status: auth.status || 401 }
      );
    }

    // CSRF validation (for mutations)
    if (options?.csrf && !validateCsrfToken(req)) {
      return NextResponse.json(
        { error: "CSRF token validation failed" },
        { status: 403 }
      );
    }

    return handler(req, { user: auth.user, rateLimit: rateLimitResult });
  };
}

/**
 * Standard rate limit error response
 */
export function rateLimitResponse(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    { error: "Too many requests", retryAfter: result.retryAfter },
    { status: 429, headers: getRateLimitHeaders(result) }
  );
}
