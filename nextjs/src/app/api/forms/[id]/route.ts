/**
 * VeilForms - Single Form Management
 * GET /api/forms/:id - Get single form
 * PUT /api/forms/:id - Update form
 * DELETE /api/forms/:id - Soft delete form
 */

import { NextRequest, NextResponse } from "next/server";
import { updateForm } from "@/lib/storage";
import { logAudit, AuditEvents, getAuditContext } from "@/lib/audit";
import {
  isValidFormId,
  validateFormName,
  validateBranding,
  validateRetention,
  validateRecipients,
  isValidWebhookUrl,
  sanitizeString,
} from "@/lib/validation";
import { errorResponse, ErrorCodes } from "@/lib/errors";
import { verifyFormOwnership } from "@/lib/form-helpers";
import { authRoute } from "@/lib/route-handler";

type RouteParams = { params: Promise<{ id: string }> };

export const GET = authRoute<RouteParams>(
  async (req: NextRequest, { user }, routeCtx) => {
    const { id: formId } = await routeCtx!.params;

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
        return NextResponse.json({ error: "Form not found" }, { status: 404 });
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
  },
  { rateLimit: { keyPrefix: "forms-api", maxRequests: 30 } }
);

export const PUT = authRoute<RouteParams>(
  async (req: NextRequest, { user }, routeCtx) => {
    const { id: formId } = await routeCtx!.params;

    // Validate formId format
    if (!isValidFormId(formId)) {
      return NextResponse.json(
        { error: "Valid form ID required" },
        { status: 400 }
      );
    }

    try {
      // Get form and verify ownership (requires edit permission)
      const { form, error } = await verifyFormOwnership(formId, user.userId, 'forms:edit');
      if (error) {
        return error;
      }
      if (!form) {
        return NextResponse.json({ error: "Form not found" }, { status: 404 });
      }

      const body = await req.json();
      const { name, status, settings } = body;

      const updates: Record<string, unknown> = {};
      const changes: string[] = [];

      if (name !== undefined) {
        // Sanitize form name to prevent XSS
        const sanitizedName = sanitizeString(name, { maxLength: 100 });
        if (!sanitizedName) {
          return NextResponse.json(
            { error: "Form name is required" },
            { status: 400 }
          );
        }

        const nameValidation = validateFormName(sanitizedName);
        if (!nameValidation.valid) {
          return NextResponse.json(
            { error: nameValidation.error },
            { status: 400 }
          );
        }
        updates.name = sanitizedName;
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
        user.userId,
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
  },
  { rateLimit: { keyPrefix: "forms-api", maxRequests: 30 }, csrf: true }
);

export const DELETE = authRoute<RouteParams>(
  async (req: NextRequest, { user }, routeCtx) => {
    const { id: formId } = await routeCtx!.params;

    // Validate formId format
    if (!isValidFormId(formId)) {
      return NextResponse.json(
        { error: "Valid form ID required" },
        { status: 400 }
      );
    }

    try {
      // Get form and verify ownership (requires delete permission)
      const { form, error } = await verifyFormOwnership(formId, user.userId, 'forms:delete');
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
        user.userId,
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
  },
  { rateLimit: { keyPrefix: "forms-api", maxRequests: 30 }, csrf: true }
);
