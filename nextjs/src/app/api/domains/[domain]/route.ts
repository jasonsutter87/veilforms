/**
 * VeilForms - Single Custom Domain Endpoint
 * GET /api/domains/[domain] - Get domain details
 * DELETE /api/domains/[domain] - Delete custom domain
 */

import { NextRequest, NextResponse } from "next/server";
import { authRoute } from "@/lib/route-handler";
import {
  getCustomDomain,
  deleteCustomDomain,
  getVerificationRecordName,
} from "@/lib/custom-domains";
import { errorResponse, ErrorCodes } from "@/lib/errors";
import { logAudit, AuditEvents, getAuditContext } from "@/lib/audit";

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

      const verificationRecordName = getVerificationRecordName(domainData.domain);

      return NextResponse.json({
        domain: {
          domain: domainData.domain,
          status: domainData.status,
          sslStatus: domainData.sslStatus,
          verifiedAt: domainData.verifiedAt,
          createdAt: domainData.createdAt,
          lastCheckedAt: domainData.lastCheckedAt,
          failureReason: domainData.failureReason,
        },
        verification: {
          type: "TXT",
          name: verificationRecordName,
          value: domainData.verificationToken,
        },
      });
    } catch (err) {
      console.error("Get domain error:", err);
      return errorResponse(ErrorCodes.SERVER_ERROR);
    }
  },
  { rateLimit: { keyPrefix: "domains-api", maxRequests: 30 } }
);

export const DELETE = authRoute<RouteContext>(
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

      await deleteCustomDomain(domain, user.userId);

      // Log audit event
      const auditCtx = getAuditContext(req);
      await logAudit(
        user.userId,
        AuditEvents.DOMAIN_DELETED,
        {
          domain: domainData.domain,
        },
        auditCtx
      );

      return NextResponse.json({
        success: true,
        message: "Domain deleted successfully",
      });
    } catch (err) {
      console.error("Delete domain error:", err);

      if (err instanceof Error) {
        if (err.message.includes("Unauthorized")) {
          return NextResponse.json(
            { error: "Unauthorized" },
            { status: 403 }
          );
        }
      }

      return errorResponse(ErrorCodes.SERVER_ERROR);
    }
  },
  {
    rateLimit: { keyPrefix: "domains-api", maxRequests: 10 },
    csrf: true,
  }
);
