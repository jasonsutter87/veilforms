/**
 * VeilForms - Integration Connect API
 * Initiate OAuth flow for connecting an integration
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { apiLogger } from "@/lib/logger";
import { errorResponse, ErrorCodes } from "@/lib/errors";
import { getOAuthUrl } from "@/lib/crm-integrations";

const SUPPORTED_INTEGRATIONS = ["salesforce", "hubspot", "pipedrive", "zapier", "webhook"];

/**
 * POST /api/integrations/[id]/connect - Start OAuth flow
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await requireAuth(req);
  if (!authResult.authenticated) {
    return errorResponse(ErrorCodes.AUTH_TOKEN_MISSING);
  }

  const { id } = params;
  const userId = authResult.userId;

  if (!SUPPORTED_INTEGRATIONS.includes(id)) {
    return errorResponse(ErrorCodes.VALIDATION_ERROR, {
      message: `Integration '${id}' is not supported`,
    });
  }

  try {
    // Handle webhooks differently - no OAuth needed
    if (id === "webhook") {
      return NextResponse.json({
        type: "configuration",
        message: "Webhooks can be configured in form settings",
      });
    }

    // Handle Zapier differently
    if (id === "zapier") {
      return NextResponse.json({
        type: "external",
        message: "Please configure this integration from Zapier",
        url: "https://zapier.com/apps/veilforms",
      });
    }

    // Get OAuth URL for CRM integrations
    const provider = id as "salesforce" | "hubspot" | "pipedrive";
    const authUrl = getOAuthUrl(provider, userId);

    if (!authUrl) {
      return errorResponse(ErrorCodes.INTEGRATION_NOT_CONFIGURED, {
        provider: id,
        message: "This integration is not yet configured. Please set up the required API keys.",
      });
    }

    apiLogger.info({ userId, integrationId: id }, "Starting OAuth flow");

    return NextResponse.json({ authUrl });
  } catch (error) {
    apiLogger.error({ userId, integrationId: id, error }, "Failed to initiate connection");
    return errorResponse(ErrorCodes.SERVER_ERROR);
  }
}
