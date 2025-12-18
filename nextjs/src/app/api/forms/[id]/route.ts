/**
 * VeilForms - Single Form Management
 * GET /api/forms/:id - Get single form
 * PUT /api/forms/:id - Update form
 * DELETE /api/forms/:id - Soft delete form
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { updateForm } from "@/lib/storage";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";
import { logAudit, AuditEvents, getAuditContext } from "@/lib/audit";
import { validateCsrfToken } from "@/lib/csrf";
import {
  isValidFormId,
  validateFormName,
  validateBranding,
  validateRetention,
  validateRecipients,
  isValidWebhookUrl,
} from "@/lib/validation";
import { errorResponse, ErrorCodes } from "@/lib/errors";
import { verifyFormOwnership } from "@/lib/form-helpers";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id: formId } = await params;

  // Rate limit
  const rateLimit = await checkRateLimit(req, {
    keyPrefix: "forms-api",
    maxRequests: 30,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: rateLimit.retryAfter },
      { status: 429, headers: getRateLimitHeaders(rateLimit) }
    );
  }

  // Authenticate
  const auth = await authenticateRequest(req);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // Validate formId format
  if (!isValidFormId(formId)) {
    return NextResponse.json(
      { error: "Valid form ID required" },
      { status: 400 }
    );
  }

  try {
    // Get form and verify ownership
    const { form, error } = await verifyFormOwnership(formId, auth.user!.userId);
    if (error) {
      return error;
    }

    return NextResponse.json({
      form: {
        id: form.id,
        name: form.name,
        status: (form as { status?: string }).status || "active",
        createdAt: form.createdAt,
        updatedAt: form.updatedAt,
        submissionCount: form.submissionCount || 0,
        lastSubmissionAt: (form as { lastSubmissionAt?: string }).lastSubmissionAt,
        publicKey: form.publicKey,
        settings: form.settings,
      },
    });
  } catch (err) {
    console.error("Get form error:", err);
    return errorResponse(ErrorCodes.SERVER_ERROR);
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const { id: formId } = await params;

  // Rate limit
  const rateLimit = await checkRateLimit(req, {
    keyPrefix: "forms-api",
    maxRequests: 30,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: rateLimit.retryAfter },
      { status: 429, headers: getRateLimitHeaders(rateLimit) }
    );
  }

  // Authenticate
  const auth = await authenticateRequest(req);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // CSRF protection
  if (!validateCsrfToken(req)) {
    return NextResponse.json(
      { error: "CSRF token validation failed" },
      { status: 403 }
    );
  }

  // Validate formId format
  if (!isValidFormId(formId)) {
    return NextResponse.json(
      { error: "Valid form ID required" },
      { status: 400 }
    );
  }

  try {
    // Get form and verify ownership
    const { form, error } = await verifyFormOwnership(formId, auth.user!.userId);
    if (error) {
      return error;
    }

    const body = await req.json();
    const { name, status, settings } = body;

    const updates: Record<string, unknown> = {};
    const changes: string[] = [];

    if (name !== undefined) {
      const nameValidation = validateFormName(name);
      if (!nameValidation.valid) {
        return NextResponse.json(
          { error: nameValidation.error },
          { status: 400 }
        );
      }
      updates.name = name.trim();
      changes.push("name");
    }

    if (status !== undefined) {
      if (!["active", "paused"].includes(status)) {
        return NextResponse.json(
          { error: 'Invalid status. Must be "active" or "paused"' },
          { status: 400 }
        );
      }
      updates.status = status;
      changes.push("status");
    }

    if (settings !== undefined) {
      updates.settings = {
        ...form.settings,
        ...settings,
      };

      // Validate webhook URL if provided
      if (settings.webhookUrl && !isValidWebhookUrl(settings.webhookUrl)) {
        return NextResponse.json(
          { error: "Invalid webhook URL" },
          { status: 400 }
        );
      }

      // Validate allowed origins
      if (settings.allowedOrigins && !Array.isArray(settings.allowedOrigins)) {
        return NextResponse.json(
          { error: "allowedOrigins must be an array" },
          { status: 400 }
        );
      }

      // Validate branding settings
      if (settings.branding) {
        const brandingValidation = validateBranding(settings.branding);
        if (!brandingValidation.valid) {
          return NextResponse.json(
            { error: brandingValidation.error },
            { status: 400 }
          );
        }
        changes.push("branding");
      }

      // Validate retention settings
      if (settings.retention) {
        const retentionValidation = validateRetention(settings.retention);
        if (!retentionValidation.valid) {
          return NextResponse.json(
            { error: retentionValidation.error },
            { status: 400 }
          );
        }
        changes.push("retention");
      }

      // Validate notification settings
      if (settings.notifications?.recipients) {
        const recipientsValidation = validateRecipients(
          settings.notifications.recipients
        );
        if (!recipientsValidation.valid) {
          return NextResponse.json(
            { error: recipientsValidation.error },
            { status: 400 }
          );
        }
        changes.push("notifications");
      }

      changes.push("settings");
    }

    const updated = await updateForm(formId, updates);

    // Log audit event
    const auditCtx = getAuditContext(req);
    await logAudit(
      auth.user!.userId,
      AuditEvents.FORM_UPDATED,
      { formId, changes },
      auditCtx
    );

    return NextResponse.json({
      form: {
        id: updated!.id,
        name: updated!.name,
        status: (updated as { status?: string })?.status || "active",
        createdAt: updated!.createdAt,
        updatedAt: updated!.updatedAt,
        submissionCount: updated!.submissionCount || 0,
        lastSubmissionAt: (updated as { lastSubmissionAt?: string })?.lastSubmissionAt,
        publicKey: updated!.publicKey,
        settings: updated!.settings,
      },
    });
  } catch (err) {
    console.error("Update form error:", err);
    return errorResponse(ErrorCodes.SERVER_ERROR);
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { id: formId } = await params;

  // Rate limit
  const rateLimit = await checkRateLimit(req, {
    keyPrefix: "forms-api",
    maxRequests: 30,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: rateLimit.retryAfter },
      { status: 429, headers: getRateLimitHeaders(rateLimit) }
    );
  }

  // Authenticate
  const auth = await authenticateRequest(req);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // CSRF protection
  if (!validateCsrfToken(req)) {
    return NextResponse.json(
      { error: "CSRF token validation failed" },
      { status: 403 }
    );
  }

  // Validate formId format
  if (!isValidFormId(formId)) {
    return NextResponse.json(
      { error: "Valid form ID required" },
      { status: 400 }
    );
  }

  try {
    // Get form and verify ownership
    const { form, error } = await verifyFormOwnership(formId, auth.user!.userId);
    if (error) {
      return error;
    }

    // Soft delete by marking status
    await updateForm(formId, {
      status: "deleted",
      deletedAt: new Date().toISOString(),
    });

    // Log audit event
    const auditCtx = getAuditContext(req);
    await logAudit(
      auth.user!.userId,
      AuditEvents.FORM_DELETED,
      { formId },
      auditCtx
    );

    return NextResponse.json({
      success: true,
      deleted: formId,
    });
  } catch (err) {
    console.error("Delete form error:", err);
    return errorResponse(ErrorCodes.SERVER_ERROR);
  }
}
