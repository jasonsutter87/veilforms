/**
 * VeilForms - Webhook Test API
 * Send a test payload to a webhook
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { apiLogger } from "@/lib/logger";
import { errorResponse, ErrorCodes } from "@/lib/errors";
import { formWebhooks } from "../../route";
import crypto from "crypto";

/**
 * POST /api/forms/[id]/webhooks/[webhookId]/test - Send test webhook
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; webhookId: string }> }
) {
  const authResult = await requireAuth(req);
  if (!authResult.authenticated) {
    return errorResponse(ErrorCodes.AUTH_TOKEN_MISSING);
  }

  const { id: formId, webhookId } = await params;

  try {
    const webhooks = formWebhooks.get(formId) || [];
    const webhook = webhooks.find((w) => w.id === webhookId);

    if (!webhook) {
      return errorResponse(ErrorCodes.NOT_FOUND, { message: "Webhook not found" });
    }

    // Create test payload
    const testPayload = {
      event: "test",
      formId,
      webhookId,
      timestamp: new Date().toISOString(),
      data: {
        message: "This is a test webhook from VeilForms",
        submissionId: `test_${crypto.randomBytes(8).toString("hex")}`,
        fields: {
          name: "Test User",
          email: "test@example.com",
          message: "This is a test submission",
        },
      },
    };

    // Create signature
    const payloadString = JSON.stringify(testPayload);
    const signature = crypto
      .createHmac("sha256", webhook.secret)
      .update(payloadString)
      .digest("hex");

    // Send webhook (with timeout)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-VeilForms-Signature": `sha256=${signature}`,
          "X-VeilForms-Event": "test",
          "X-VeilForms-Delivery": crypto.randomBytes(16).toString("hex"),
        },
        body: payloadString,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      apiLogger.info(
        { formId, webhookId, status: response.status },
        "Test webhook sent"
      );

      return NextResponse.json({
        success: response.ok,
        statusCode: response.status,
        message: response.ok
          ? "Test webhook sent successfully"
          : `Webhook returned status ${response.status}`,
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);

      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        return NextResponse.json({
          success: false,
          statusCode: 408,
          message: "Webhook request timed out after 10 seconds",
        });
      }

      throw fetchError;
    }
  } catch (error) {
    apiLogger.error({ formId, webhookId, error }, "Failed to send test webhook");
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to send test webhook",
    });
  }
}
