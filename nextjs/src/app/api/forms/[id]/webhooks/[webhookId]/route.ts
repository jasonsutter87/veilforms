/**
 * VeilForms - Individual Webhook API
 * Get, update, or delete a specific webhook
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { apiLogger } from "@/lib/logger";
import { errorResponse, ErrorCodes } from "@/lib/errors";
import { formWebhooks } from "../route";

/**
 * GET /api/forms/[id]/webhooks/[webhookId] - Get webhook details
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; webhookId: string } }
) {
  const authResult = await requireAuth(req);
  if (!authResult.authenticated) {
    return errorResponse(ErrorCodes.AUTH_TOKEN_MISSING);
  }

  const { id: formId, webhookId } = params;

  try {
    const webhooks = formWebhooks.get(formId) || [];
    const webhook = webhooks.find((w) => w.id === webhookId);

    if (!webhook) {
      return errorResponse(ErrorCodes.NOT_FOUND, { resource: "webhook" });
    }

    return NextResponse.json({ webhook });
  } catch (error) {
    apiLogger.error({ formId, webhookId, error }, "Failed to get webhook");
    return errorResponse(ErrorCodes.SERVER_ERROR);
  }
}

/**
 * PATCH /api/forms/[id]/webhooks/[webhookId] - Update webhook
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; webhookId: string } }
) {
  const authResult = await requireAuth(req);
  if (!authResult.authenticated) {
    return errorResponse(ErrorCodes.AUTH_TOKEN_MISSING);
  }

  const { id: formId, webhookId } = params;

  try {
    const body = await req.json();
    const webhooks = formWebhooks.get(formId) || [];
    const index = webhooks.findIndex((w) => w.id === webhookId);

    if (index === -1) {
      return errorResponse(ErrorCodes.NOT_FOUND, { resource: "webhook" });
    }

    // Update allowed fields
    const updated = { ...webhooks[index] };
    if (typeof body.enabled === "boolean") {
      updated.enabled = body.enabled;
    }
    if (body.url) {
      try {
        new URL(body.url);
        updated.url = body.url;
      } catch {
        return errorResponse(ErrorCodes.VALIDATION_INVALID_FORMAT, {
          message: "Invalid webhook URL",
        });
      }
    }
    if (Array.isArray(body.events) && body.events.length > 0) {
      updated.events = body.events;
    }

    webhooks[index] = updated;
    formWebhooks.set(formId, webhooks);

    apiLogger.info({ formId, webhookId }, "Webhook updated");

    return NextResponse.json({ webhook: updated });
  } catch (error) {
    apiLogger.error({ formId, webhookId, error }, "Failed to update webhook");
    return errorResponse(ErrorCodes.SERVER_ERROR);
  }
}

/**
 * DELETE /api/forms/[id]/webhooks/[webhookId] - Delete webhook
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; webhookId: string } }
) {
  const authResult = await requireAuth(req);
  if (!authResult.authenticated) {
    return errorResponse(ErrorCodes.AUTH_TOKEN_MISSING);
  }

  const { id: formId, webhookId } = params;

  try {
    const webhooks = formWebhooks.get(formId) || [];
    const index = webhooks.findIndex((w) => w.id === webhookId);

    if (index === -1) {
      return errorResponse(ErrorCodes.NOT_FOUND, { resource: "webhook" });
    }

    webhooks.splice(index, 1);
    formWebhooks.set(formId, webhooks);

    apiLogger.info({ formId, webhookId }, "Webhook deleted");

    return NextResponse.json({ success: true });
  } catch (error) {
    apiLogger.error({ formId, webhookId, error }, "Failed to delete webhook");
    return errorResponse(ErrorCodes.SERVER_ERROR);
  }
}
