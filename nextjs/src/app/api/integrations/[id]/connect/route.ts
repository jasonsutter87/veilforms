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
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(req);
  if (!authResult.authenticated) {
    return errorResponse(ErrorCodes.AUTH_TOKEN_MISSING);
  }

  const { id } = await params;
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
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://veilforms.com";
    const redirectUri = `${baseUrl}/api/integrations/${id}/callback`;
    const authUrl = getOAuthUrl(provider, redirectUri, userId);

    if (!authUrl) {
      return errorResponse(ErrorCodes.INTEGRATION_NOT_CONFIGURED, {
        message: `Integration '${id}' is not yet configured. Please set up the required API keys.`,
      });
    }

    apiLogger.info({ userId, integrationId: id }, "Starting OAuth flow");

    return NextResponse.json({ authUrl });
  } catch (error) {
    apiLogger.error({ userId, integrationId: id, error }, "Failed to initiate connection");
    return errorResponse(ErrorCodes.SERVER_ERROR);
  }
}
