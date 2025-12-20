/**
 * VeilForms - Integration Management API
 * Get, update, or delete a specific integration
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { apiLogger } from "@/lib/logger";
import { errorResponse, ErrorCodes } from "@/lib/errors";
import { userIntegrations } from "../route";

/**
 * GET /api/integrations/[id] - Get integration details
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(req);
  if (!authResult.authenticated) {
    return errorResponse(ErrorCodes.AUTH_TOKEN_MISSING);
  }

  const { id } = await params;
  const userId = authResult.userId;

  try {
    const integrations = userIntegrations.get(userId) || [];
    const integration = integrations.find((i) => i.integrationId === id);

    if (!integration) {
      return errorResponse(ErrorCodes.NOT_FOUND, { message: "Integration not found" });
    }

    // Remove sensitive data
    const { accessToken, refreshToken, ...safeIntegration } = integration;

    return NextResponse.json({ integration: safeIntegration });
  } catch (error) {
    apiLogger.error({ userId, integrationId: id, error }, "Failed to get integration");
    return errorResponse(ErrorCodes.SERVER_ERROR);
  }
}

/**
 * DELETE /api/integrations/[id] - Disconnect integration
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(req);
  if (!authResult.authenticated) {
    return errorResponse(ErrorCodes.AUTH_TOKEN_MISSING);
  }

  const { id } = await params;
  const userId = authResult.userId;

  try {
    const integrations = userIntegrations.get(userId) || [];
    const index = integrations.findIndex((i) => i.integrationId === id);

    if (index === -1) {
      return errorResponse(ErrorCodes.NOT_FOUND, { message: "Integration not found" });
    }

    // Remove the integration
    integrations.splice(index, 1);
    userIntegrations.set(userId, integrations);

    apiLogger.info({ userId, integrationId: id }, "Integration disconnected");

    return NextResponse.json({ success: true });
  } catch (error) {
    apiLogger.error({ userId, integrationId: id, error }, "Failed to disconnect integration");
    return errorResponse(ErrorCodes.SERVER_ERROR);
  }
}
