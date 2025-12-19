/**
 * VeilForms - Integrations API
 * List connected integrations for the current user
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { apiLogger } from "@/lib/logger";
import { errorResponse, ErrorCodes } from "@/lib/errors";

// In-memory store for dev (would be database in production)
const userIntegrations = new Map<string, ConnectedIntegration[]>();

interface ConnectedIntegration {
  integrationId: string;
  provider: string;
  connectedAt: string;
  accountName?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
}

/**
 * GET /api/integrations - List all connected integrations
 */
export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (!authResult.authenticated) {
    return errorResponse(ErrorCodes.AUTH_TOKEN_MISSING);
  }

  const userId = authResult.userId;

  try {
    const integrations = userIntegrations.get(userId) || [];

    // Remove sensitive data before returning
    const safeIntegrations = integrations.map(({ accessToken, refreshToken, ...rest }) => rest);

    return NextResponse.json({ integrations: safeIntegrations });
  } catch (error) {
    apiLogger.error({ userId, error }, "Failed to list integrations");
    return errorResponse(ErrorCodes.SERVER_ERROR);
  }
}

// Export for use by other routes
export { userIntegrations };
export type { ConnectedIntegration };
