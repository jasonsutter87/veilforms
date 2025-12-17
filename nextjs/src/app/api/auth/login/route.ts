/**
 * VeilForms - Login Endpoint
 * POST /api/auth/login - Authenticate user and return JWT token
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyPassword, createToken } from "@/lib/auth";
import { getUser } from "@/lib/storage";
import {
  checkRateLimit,
  getRateLimitHeaders,
  recordFailedAttempt,
  clearFailedAttempts,
  isAccountLocked,
} from "@/lib/rate-limit";
import { errorResponse, ErrorCodes } from "@/lib/errors";

export async function POST(req: NextRequest) {
  // Check rate limit
  const rateLimit = await checkRateLimit(req, { keyPrefix: "login" });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: "Too many requests. Please try again later.",
        retryAfter: rateLimit.retryAfter,
      },
      {
        status: 429,
        headers: getRateLimitHeaders(rateLimit),
      }
    );
  }

  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        {
          error: "Email and password are required",
          code: ErrorCodes.VALIDATION_MISSING_FIELD,
          details: { required: ["email", "password"] },
        },
        {
          status: 400,
          headers: getRateLimitHeaders(rateLimit),
        }
      );
    }

    // Check account lockout
    const lockout = await isAccountLocked(email);
    if (lockout.locked) {
      return NextResponse.json(
        {
          error: `Account temporarily locked. Try again in ${lockout.remainingMinutes} minutes.`,
          lockedMinutes: lockout.remainingMinutes,
        },
        {
          status: 423,
          headers: getRateLimitHeaders(rateLimit),
        }
      );
    }

    // Get user
    const user = await getUser(email);
    if (!user) {
      // Record failed attempt (even for non-existent users to prevent enumeration)
      await recordFailedAttempt(email);
      return errorResponse(ErrorCodes.AUTH_INVALID_CREDENTIALS);
    }

    // OAuth users cannot login with password
    if (!user.passwordHash) {
      return NextResponse.json(
        {
          error: "Please sign in with your OAuth provider",
          code: ErrorCodes.AUTH_INVALID_CREDENTIALS,
          hint: `This account uses ${user.oauthProvider || "OAuth"} for authentication.`,
        },
        { status: 401 }
      );
    }

    // Verify password
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      const attempt = await recordFailedAttempt(email);
      const remaining = 5 - attempt.count;

      return NextResponse.json(
        {
          error: "Invalid email or password",
          code: ErrorCodes.AUTH_INVALID_CREDENTIALS,
          ...(remaining > 0 && remaining <= 3
            ? { attemptsRemaining: remaining }
            : {}),
        },
        {
          status: 401,
          headers: getRateLimitHeaders(rateLimit),
        }
      );
    }

    // Success - clear any failed attempts
    await clearFailedAttempts(email);

    // Check email verification status (commented out until email service is configured)
    // if (!user.emailVerified) {
    //   return errorResponse(ErrorCodes.AUTH_EMAIL_NOT_VERIFIED, {
    //     details: { email: user.email }
    //   });
    // }

    // Create JWT token
    const token = createToken({ userId: user.id, email: user.email });

    return NextResponse.json(
      {
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          subscription: user.subscription,
          emailVerified: user.emailVerified,
        },
      },
      { headers: getRateLimitHeaders(rateLimit) }
    );
  } catch (err) {
    console.error("Login error:", err);
    return errorResponse(ErrorCodes.SERVER_ERROR, {
      message: "Login failed",
    });
  }
}
