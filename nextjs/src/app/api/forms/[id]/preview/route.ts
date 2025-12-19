/**
 * VeilForms - Form Preview API
 * GET /api/forms/:id/preview - Get form for preview mode
 * POST /api/forms/:id/preview - Generate preview token
 */

import { NextRequest, NextResponse } from "next/server";
import { getForm } from "@/lib/storage";
import { isValidFormId } from "@/lib/validation";
import { errorResponse, ErrorCodes } from "@/lib/errors";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";
import { verifyPreviewToken, generatePreviewToken, generatePreviewUrl } from "@/lib/preview-tokens";
import { authRoute } from "@/lib/route-handler";
import { verifyFormOwnership } from "@/lib/form-helpers";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/forms/:id/preview
 * Get form schema for preview (public endpoint with token validation)
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id: formId } = await params;

  // Rate limit: 30 requests per minute per IP
  const rateLimit = await checkRateLimit(req, {
    keyPrefix: "form-preview",
    maxRequests: 30,
    windowMs: 60000, // 1 minute
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: rateLimit.retryAfter },
      { status: 429, headers: getRateLimitHeaders(rateLimit) }
    );
  }

  // Validate formId format
  if (!isValidFormId(formId)) {
    return errorResponse(ErrorCodes.VALIDATION_INVALID_FORMAT, {
      field: "formId",
      hint: "Form ID must be a valid format.",
    });
  }

  // Get token from query string
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json(
      { error: "Preview token required" },
      { status: 401 }
    );
  }

  // Verify preview token
  const payload = verifyPreviewToken(token);
  if (!payload) {
    return NextResponse.json(
      { error: "Invalid or expired preview token" },
      { status: 401 }
    );
  }

  // Verify token matches form
  if (payload.formId !== formId) {
    return NextResponse.json(
      { error: "Token does not match form" },
      { status: 403 }
    );
  }

  try {
    const form = await getForm(formId);

    if (!form) {
      return errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, {
        message: "Form not found",
      });
    }

    // Check if form is deleted
    const formStatus = (form as { status?: string }).status;
    if (formStatus === "deleted") {
      return errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, {
        message: "Form not found",
      });
    }

    // Return form data for preview (including fields, even if paused)
    return NextResponse.json({
      id: form.id,
      name: form.name,
      status: formStatus || "active",
      fields: form.fields || [],
      settings: {
        encryption: form.settings.encryption,
        spamProtection: {
          honeypot: form.settings.spamProtection?.honeypot || false,
          recaptcha: {
            enabled: form.settings.spamProtection?.recaptcha?.enabled || false,
            siteKey: form.settings.spamProtection?.recaptcha?.siteKey || "",
          },
        },
        branding: (form.settings as { branding?: unknown }).branding,
      },
    });
  } catch (err) {
    console.error("Get form preview error:", err);
    return errorResponse(ErrorCodes.SERVER_ERROR);
  }
}

/**
 * POST /api/forms/:id/preview
 * Generate a preview token for a form (authenticated)
 */
export const POST = authRoute<RouteParams>(
  async (req: NextRequest, { user }, { params }: RouteParams) => {
    const { id: formId } = await params;

    // Validate formId format
    if (!isValidFormId(formId)) {
      return NextResponse.json(
        { error: "Valid form ID required" },
        { status: 400 }
      );
    }

    try {
      // Get form and verify ownership
      const { form, error } = await verifyFormOwnership(formId, user.userId);
      if (error) {
        return error;
      }

      if (!form) {
        return NextResponse.json(
          { error: "Form not found" },
          { status: 404 }
        );
      }

      // Generate preview token
      const token = generatePreviewToken(formId, user.userId);

      // Generate preview URL
      const previewUrl = generatePreviewUrl(formId, token);

      return NextResponse.json({
        token,
        url: previewUrl,
        expiresIn: "24h",
        formId: form.id,
      });
    } catch (err) {
      console.error("Generate preview token error:", err);
      return errorResponse(ErrorCodes.SERVER_ERROR);
    }
  },
  { rateLimit: { keyPrefix: "preview-token", maxRequests: 30 }, csrf: true }
);
