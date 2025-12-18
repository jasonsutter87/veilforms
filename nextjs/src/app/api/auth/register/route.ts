/**
 * VeilForms - Registration Endpoint
 * POST /api/auth/register - Create new user account
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  hashPassword,
  createToken,
  validatePasswordStrength,
  PASSWORD_REQUIREMENTS,
} from "@/lib/auth";
import { createUser, getUser, createEmailVerificationToken } from "@/lib/storage";
import { sendEmailVerification } from "@/lib/email";
import {
  checkEmailRateLimit,
  getEmailRateLimitHeaders,
} from "@/lib/email-rate-limit";
import { isValidEmail } from "@/lib/validation";
import { errorResponse, ErrorCodes } from "@/lib/errors";
import { buildVerificationUrl } from "@/lib/url-helpers";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password required" },
        { status: 400 }
      );
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Check email rate limit (5 verification emails per hour)
    const rateLimit = await checkEmailRateLimit(email, "verification");
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: rateLimit.message,
          retryAfter: rateLimit.retryAfter,
          resetAt: new Date(rateLimit.resetAt).toISOString(),
        },
        {
          status: 429,
          headers: getEmailRateLimitHeaders(rateLimit, "verification"),
        }
      );
    }

    // Validate password strength
    const passwordCheck = validatePasswordStrength(password);
    if (!passwordCheck.valid) {
      return NextResponse.json(
        {
          error: "Password does not meet requirements",
          details: passwordCheck.errors,
          requirements: PASSWORD_REQUIREMENTS,
        },
        { status: 400 }
      );
    }

    // Check if user exists
    const existing = await getUser(email);
    if (existing) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }

    // Create user
    const passwordHash = await hashPassword(password);
    const user = await createUser(email, passwordHash);

    // Create email verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    await createEmailVerificationToken(email, verificationToken);

    // Build verification URL
    const verifyUrl = buildVerificationUrl(verificationToken);

    // Send verification email (fire and forget)
    sendEmailVerification(email, verifyUrl).catch((err) => {
      console.error("Verification email failed:", err);
    });

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
          emailVerified: false,
        },
        message: "Please check your email to verify your account",
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Register error:", err);
    return errorResponse(ErrorCodes.SERVER_ERROR, {
      message: "Registration failed",
    });
  }
}
