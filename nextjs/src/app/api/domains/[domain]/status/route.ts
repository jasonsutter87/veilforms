/**
 * VeilForms - Domain Status Endpoint
 * GET /api/domains/[domain]/status - Get SSL and DNS status
 */

import { NextRequest, NextResponse } from "next/server";
import { authRoute } from "@/lib/route-handler";
import { getCustomDomain } from "@/lib/custom-domains";
import { errorResponse, ErrorCodes } from "@/lib/errors";

interface RouteContext {
  params: Promise<{ domain: string }>;
}

export const GET = authRoute<RouteContext>(
  async (req, { user }, routeCtx) => {
    try {
      const { domain } = await routeCtx!.params;

      const domainData = await getCustomDomain(domain);
      if (!domainData) {
        return NextResponse.json(
          { error: "Domain not found" },
          { status: 404 }
        );
      }

      // Verify ownership
      if (domainData.userId !== user.userId) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 403 }
        );
      }

      // Calculate SSL status details
      const sslStatusDetails = {
        status: domainData.sslStatus,
        expiresAt: domainData.sslExpiresAt,
        daysUntilExpiry: domainData.sslExpiresAt
          ? Math.floor((domainData.sslExpiresAt - Date.now()) / (1000 * 60 * 60 * 24))
          : null,
      };

      // DNS verification status
      const dnsStatus = {
        verified: domainData.status === "active",
        status: domainData.status,
        verifiedAt: domainData.verifiedAt,
        lastCheckedAt: domainData.lastCheckedAt,
        failureReason: domainData.failureReason,
      };

      return NextResponse.json({
        domain: domainData.domain,
        dns: dnsStatus,
        ssl: sslStatusDetails,
        overall: {
          ready: domainData.status === "active" && domainData.sslStatus === "active",
          status:
            domainData.status === "active" && domainData.sslStatus === "active"
              ? "ready"
              : domainData.status === "active"
              ? "ssl-pending"
              : domainData.status === "verifying"
              ? "verifying"
              : domainData.status === "failed"
              ? "failed"
              : "pending",
        },
      });
    } catch (err) {
      console.error("Get domain status error:", err);
      return errorResponse(ErrorCodes.SERVER_ERROR);
    }
  },
  { rateLimit: { keyPrefix: "domains-api", maxRequests: 30 } }
);
