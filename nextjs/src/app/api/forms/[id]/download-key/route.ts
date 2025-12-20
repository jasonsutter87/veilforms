/**
 * VeilForms - Private Key Download Endpoint
 * GET /api/forms/[id]/download-key - Download private key with one-time token
 */

import { NextRequest, NextResponse } from "next/server";
import { consumePrivateKeyDownloadToken } from "@/lib/private-key-tokens";
import { errorResponse, ErrorCodes } from "@/lib/errors";
import { authRoute } from "@/lib/route-handler";

type RouteParams = { params: Promise<{ id: string }> };

export const GET = authRoute<RouteParams>(
  async (req: NextRequest, { user, rateLimit }, routeCtx) => {
    try {
      const { id: formId } = await routeCtx!.params;
      const { searchParams } = new URL(req.url);
      const token = searchParams.get("token");

      if (!token) {
        return NextResponse.json(
          { error: "Download token required" },
          { status: 400 }
        );
      }

      // Consume token and get private key
      const tokenData = await consumePrivateKeyDownloadToken(token);

      if (!tokenData) {
        return NextResponse.json(
          {
            error: "Invalid or expired download token",
            hint: "Download tokens expire after 15 minutes and can only be used once.",
          },
          { status: 400 }
        );
      }

      // Verify form ID matches
      if (tokenData.formId !== formId) {
        return NextResponse.json(
          { error: "Token does not match form ID" },
          { status: 400 }
        );
      }

      // Verify user owns the form
      if (tokenData.userId !== user.userId) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 403 }
        );
      }

      // Return private key
      return NextResponse.json({
        formId: tokenData.formId,
        privateKey: tokenData.privateKey,
        warning:
          "This is the only time you will see this private key. Save it securely!",
      });
    } catch (err) {
      console.error("Download key error:", err);
      return errorResponse(ErrorCodes.SERVER_ERROR);
    }
  },
  {
    rateLimit: {
      keyPrefix: "download-key",
      maxRequests: 10,
      windowMs: 60 * 60 * 1000, // 1 hour
    },
  }
);
