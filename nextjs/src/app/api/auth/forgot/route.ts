/**
 * VeilForms - Forgot Password Endpoint
 * POST /api/auth/forgot - Request password reset email
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getUser, createPasswordResetToken } from "@/lib/storage";
import { sendPasswordResetEmail } from "@/lib/email";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";
import {
  checkEmailRateLimit,
  getEmailRateLimitHeaders,
} from "@/lib/email-rate-limit";
import { errorResponse, ErrorCodes } from "@/lib/errors";
import { buildResetUrl } from "@/lib/url-helpers";

export async function POST(req: NextRequest) {
  // Stricter rate limit for password reset (3 per minute)
  const rateLimit = await checkRateLimit(req, {
    keyPrefix: "forgot",
    maxRequests: 3,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: "Too many requests",
        retryAfter: rateLimit.retryAfter,
      },
      {
        status: 429,
        headers: getRateLimitHeaders(rateLimit),
      }
    );
  }

  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400, headers: getRateLimitHeaders(rateLimit) }
      );
    }

    // Check email-specific rate limit (3 per hour per email for password resets)
    const emailRateLimit = await checkEmailRateLimit(email, "passwordReset");
    if (!emailRateLimit.allowed) {
      return NextResponse.json(
        {
          error: emailRateLimit.message,
          retryAfter: emailRateLimit.retryAfter,
          resetAt: new Date(emailRateLimit.resetAt).toISOString(),
        },
        {
          status: 429,
          headers: {
            ...getRateLimitHeaders(rateLimit),
            ...getEmailRateLimitHeaders(emailRateLimit, "passwordReset"),
          },
        }
      );
    }

    // Always return success to prevent email enumeration
    const successResponse = () =>
      NextResponse.json(
        {
          success: true,
          message:
            "If an account with that email exists, we sent a password reset link.",
        },
        { headers: getRateLimitHeaders(rateLimit) }
      );

    // Check if user exists (silently)
    const user = await getUser(email);
    if (!user) {
      // Return success even if user doesn't exist (security)
      return successResponse();
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString("hex");

    // Store token
    await createPasswordResetToken(email, token);

    // Build reset URL
    const resetUrl = buildResetUrl(token);

    // Send email
    try {
      await sendPasswordResetEmail(email, resetUrl);
      if (process.env.NODE_ENV !== "production") {
        console.log(`Password reset email sent to ${email}`);
      }
    } catch (emailError) {
      console.error("Failed to send password reset email:", emailError);
      // Still return success to prevent enumeration
    }

    return successResponse();
  } catch (err) {
    console.error("Forgot password error:", err);
    return errorResponse(ErrorCodes.SERVER_ERROR, {
      message: "An error occurred",
    });
  }
}
