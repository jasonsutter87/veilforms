/**
 * VeilForms - Test Zapier Webhook
 * POST /api/forms/:id/zapier/test - Send test webhook to Zapier
 *
 * Allows users to test their Zapier webhook connection before going live.
 */

import { NextRequest, NextResponse } from "next/server";
import { isValidFormId } from "@/lib/validation";
import { errorResponse, ErrorCodes } from "@/lib/errors";
import { verifyFormOwnership } from "@/lib/form-helpers";
import { authRoute } from "@/lib/route-handler";
import { generateZapierSampleData, sendZapierWebhook } from "@/lib/zapier";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/forms/:id/zapier/test
 * Send a test webhook to verify Zapier connection
 */
export const POST = authRoute<RouteParams>(
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

      // Check if Zapier is configured
      const zapierSettings = (form.settings as { zapier?: { enabled: boolean; webhookUrl: string | null } }).zapier;

      if (!zapierSettings?.webhookUrl) {
        return NextResponse.json(
          { error: "Zapier webhook URL not configured" },
          { status: 400 }
        );
      }

      // Generate sample submission data
      const sampleData = generateZapierSampleData({
        id: form.id,
        name: form.name,
        fields: (form as { fields?: Array<{ type: string; name: string; label: string }> }).fields,
      });

      // Create a test submission object
      const testSubmission = {
        id: "test_" + Date.now(),
        formId: form.id,
        timestamp: Date.now(),
        meta: {
          isTest: true,
          sdkVersion: "test",
          formVersion: "1",
        },
      };

      // Extract decrypted data from sample
      const decryptedData: Record<string, unknown> = {};
      Object.entries(sampleData).forEach(([key, value]) => {
        if (key.startsWith("field_")) {
          const fieldName = key.replace("field_", "");
          decryptedData[fieldName] = value;
        }
      });

      // Send test webhook
      const result = await sendZapierWebhook(
        zapierSettings.webhookUrl,
        {
          id: form.id,
          name: form.name,
          fields: (form as { fields?: Array<{ type: string; name: string; label: string }> }).fields,
        },
        testSubmission,
        decryptedData
      );

      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            error: "Webhook delivery failed",
            details: result.error,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Test webhook sent successfully",
        testData: sampleData,
      });
    } catch (err) {
      console.error("Test Zapier webhook error:", err);
      return errorResponse(ErrorCodes.SERVER_ERROR);
    }
  },
  { rateLimit: { keyPrefix: "zapier-test", maxRequests: 5, windowMs: 60000 } }
);
