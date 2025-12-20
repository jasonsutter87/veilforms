/**
 * VeilForms - Zapier Integration Settings
 * GET /api/forms/:id/zapier - Get Zapier settings
 * PUT /api/forms/:id/zapier - Update Zapier settings
 * DELETE /api/forms/:id/zapier - Disconnect Zapier
 */

import { NextRequest, NextResponse } from "next/server";
import { updateForm } from "@/lib/storage";
import { isValidFormId, isValidWebhookUrl } from "@/lib/validation";
import { errorResponse, ErrorCodes } from "@/lib/errors";
import { verifyFormOwnership } from "@/lib/form-helpers";
import { authRoute } from "@/lib/route-handler";
import { isValidZapierUrl, getZapierWebhookInfo } from "@/lib/zapier";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/forms/:id/zapier
 * Get Zapier integration settings for a form
 */
export const GET = authRoute<RouteParams>(
  async (req: NextRequest, { user }, routeCtx) => {
    const { id: formId } = await routeCtx!.params;

    if (!isValidFormId(formId)) {
      return NextResponse.json(
        { error: "Valid form ID required" },
        { status: 400 }
      );
    }

    try {
      const { form, error } = await verifyFormOwnership(formId, user.userId);
      if (error) {
        return error;
      }
      if (!form) {
        return NextResponse.json({ error: "Form not found" }, { status: 404 });
      }

      const zapierSettings = (form.settings as { zapier?: { enabled: boolean; webhookUrl: string | null } }).zapier;

      return NextResponse.json({
        zapier: {
          enabled: zapierSettings?.enabled || false,
          webhookUrl: zapierSettings?.webhookUrl || null,
          connected: !!(zapierSettings?.enabled && zapierSettings?.webhookUrl),
        },
      });
    } catch (err) {
      console.error("Get Zapier settings error:", err);
      return errorResponse(ErrorCodes.SERVER_ERROR);
    }
  },
  { rateLimit: { keyPrefix: "zapier-settings", maxRequests: 30 } }
);

/**
 * PUT /api/forms/:id/zapier
 * Update Zapier integration settings
 */
export const PUT = authRoute<RouteParams>(
  async (req: NextRequest, { user }, routeCtx) => {
    const { id: formId } = await routeCtx!.params;

    if (!isValidFormId(formId)) {
      return NextResponse.json(
        { error: "Valid form ID required" },
        { status: 400 }
      );
    }

    try {
      const { form, error } = await verifyFormOwnership(formId, user.userId);
      if (error) {
        return error;
      }
      if (!form) {
        return NextResponse.json({ error: "Form not found" }, { status: 404 });
      }

      const body = await req.json();
      const { enabled, webhookUrl } = body;

      // Validate inputs
      if (enabled === undefined && webhookUrl === undefined) {
        return NextResponse.json(
          { error: "At least one field (enabled, webhookUrl) is required" },
          { status: 400 }
        );
      }

      // Validate webhook URL if provided
      if (webhookUrl !== undefined && webhookUrl !== null) {
        if (!isValidWebhookUrl(webhookUrl)) {
          return NextResponse.json(
            { error: "Invalid webhook URL format" },
            { status: 400 }
          );
        }

        if (!isValidZapierUrl(webhookUrl)) {
          return NextResponse.json(
            { error: "Webhook URL must use HTTPS" },
            { status: 400 }
          );
        }
      }

      // Get current Zapier settings
      const currentZapierSettings = (form.settings as { zapier?: { enabled: boolean; webhookUrl: string | null } }).zapier || {
        enabled: false,
        webhookUrl: null,
      };

      // Update settings
      const updatedZapierSettings = {
        enabled: enabled !== undefined ? enabled : currentZapierSettings.enabled,
        webhookUrl: webhookUrl !== undefined ? webhookUrl : currentZapierSettings.webhookUrl,
      };

      // Don't allow enabled=true without a webhook URL
      if (updatedZapierSettings.enabled && !updatedZapierSettings.webhookUrl) {
        return NextResponse.json(
          { error: "Webhook URL is required when enabling Zapier integration" },
          { status: 400 }
        );
      }

      // Update form settings
      await updateForm(formId, {
        settings: {
          ...form.settings,
          zapier: updatedZapierSettings,
        },
      });

      return NextResponse.json({
        success: true,
        zapier: {
          enabled: updatedZapierSettings.enabled,
          webhookUrl: updatedZapierSettings.webhookUrl,
          connected: !!(updatedZapierSettings.enabled && updatedZapierSettings.webhookUrl),
        },
      });
    } catch (err) {
      console.error("Update Zapier settings error:", err);
      return errorResponse(ErrorCodes.SERVER_ERROR);
    }
  },
  { rateLimit: { keyPrefix: "zapier-settings", maxRequests: 10 } }
);

/**
 * DELETE /api/forms/:id/zapier
 * Disconnect Zapier integration
 */
export const DELETE = authRoute<RouteParams>(
  async (req: NextRequest, { user }, routeCtx) => {
    const { id: formId } = await routeCtx!.params;

    if (!isValidFormId(formId)) {
      return NextResponse.json(
        { error: "Valid form ID required" },
        { status: 400 }
      );
    }

    try {
      const { form, error } = await verifyFormOwnership(formId, user.userId);
      if (error) {
        return error;
      }
      if (!form) {
        return NextResponse.json({ error: "Form not found" }, { status: 404 });
      }

      // Disable Zapier integration
      await updateForm(formId, {
        settings: {
          ...form.settings,
          zapier: {
            enabled: false,
            webhookUrl: null,
          },
        },
      });

      return NextResponse.json({
        success: true,
        message: "Zapier integration disconnected",
      });
    } catch (err) {
      console.error("Delete Zapier settings error:", err);
      return errorResponse(ErrorCodes.SERVER_ERROR);
    }
  },
  { rateLimit: { keyPrefix: "zapier-settings", maxRequests: 10 } }
);
