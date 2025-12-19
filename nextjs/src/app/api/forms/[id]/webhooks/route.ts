/**
 * VeilForms - Form Webhooks API
 * Manage webhooks for a form
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { apiLogger } from "@/lib/logger";
import { errorResponse, ErrorCodes } from "@/lib/errors";
import crypto from "crypto";

// In-memory store for dev (would be database in production)
const formWebhooks = new Map<string, Webhook[]>();

interface Webhook {
  id: string;
  formId: string;
  url: string;
  events: string[];
  enabled: boolean;
  secret: string;
  createdAt: string;
  lastTriggered?: string;
  failureCount: number;
}

/**
 * GET /api/forms/[id]/webhooks - List webhooks for a form
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await requireAuth(req);
  if (!authResult.authenticated) {
    return errorResponse(ErrorCodes.AUTH_TOKEN_MISSING);
  }

  const { id: formId } = params;

  try {
    const webhooks = formWebhooks.get(formId) || [];

    return NextResponse.json({ webhooks });
  } catch (error) {
    apiLogger.error({ formId, error }, "Failed to list webhooks");
    return errorResponse(ErrorCodes.SERVER_ERROR);
  }
}

/**
 * POST /api/forms/[id]/webhooks - Create a new webhook
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await requireAuth(req);
  if (!authResult.authenticated) {
    return errorResponse(ErrorCodes.AUTH_TOKEN_MISSING);
  }

  const { id: formId } = params;

  try {
    const body = await req.json();
    const { url, events } = body;

    if (!url || !events || events.length === 0) {
      return errorResponse(ErrorCodes.VALIDATION_MISSING_FIELD, {
        message: "URL and at least one event are required",
      });
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return errorResponse(ErrorCodes.VALIDATION_INVALID_FORMAT, {
        message: "Invalid webhook URL",
      });
    }

    const webhook: Webhook = {
      id: `wh_${crypto.randomBytes(12).toString("hex")}`,
      formId,
      url,
      events,
      enabled: true,
      secret: `whsec_${crypto.randomBytes(24).toString("hex")}`,
      createdAt: new Date().toISOString(),
      failureCount: 0,
    };

    const existingWebhooks = formWebhooks.get(formId) || [];
    formWebhooks.set(formId, [...existingWebhooks, webhook]);

    apiLogger.info({ formId, webhookId: webhook.id }, "Webhook created");

    return NextResponse.json({ webhook }, { status: 201 });
  } catch (error) {
    apiLogger.error({ formId, error }, "Failed to create webhook");
    return errorResponse(ErrorCodes.SERVER_ERROR);
  }
}

// Export for use by other routes
export { formWebhooks };
export type { Webhook };
