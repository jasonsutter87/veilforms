/**
 * VeilForms - Domain Verification Endpoint
 * POST /api/domains/[domain]/verify - Trigger DNS verification
 */

import { NextRequest, NextResponse } from "next/server";
import { authRoute } from "@/lib/route-handler";
import {
  getCustomDomain,
  triggerDomainVerification,
} from "@/lib/custom-domains";
import { errorResponse, ErrorCodes } from "@/lib/errors";
import { logAudit, AuditEvents, getAuditContext } from "@/lib/audit";

interface RouteContext {
  params: Promise<{ domain: string }>;
}

export const POST = authRoute<RouteContext>(
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

      // Check if already verified
      if (domainData.status === "active") {
        return NextResponse.json({
          success: true,
          message: "Domain is already verified",
          domain: {
            domain: domainData.domain,
            status: domainData.status,
            verifiedAt: domainData.verifiedAt,
          },
        });
      }

      // Trigger verification
      const result = await triggerDomainVerification(domain);

      // Log audit event
      const auditCtx = getAuditContext(req);
      if (result.success) {
        await logAudit(
          user.userId,
          AuditEvents.DOMAIN_VERIFIED,
          {
            domain: domainData.domain,
          },
          auditCtx
        );
      } else {
        await logAudit(
          user.userId,
          AuditEvents.DOMAIN_VERIFICATION_FAILED,
          {
            domain: domainData.domain,
            reason: result.error,
          },
          auditCtx
        );
      }

      if (result.success && result.domain) {
        return NextResponse.json({
          success: true,
          message: "Domain verified successfully",
          domain: {
            domain: result.domain.domain,
            status: result.domain.status,
            sslStatus: result.domain.sslStatus,
            verifiedAt: result.domain.verifiedAt,
          },
        });
      } else {
        return NextResponse.json(
          {
            success: false,
            error: result.error || "Verification failed",
            domain: result.domain
              ? {
                  domain: result.domain.domain,
                  status: result.domain.status,
                  failureReason: result.domain.failureReason,
                }
              : undefined,
          },
          { status: 400 }
        );
      }
    } catch (err) {
      console.error("Verify domain error:", err);
      return errorResponse(ErrorCodes.SERVER_ERROR);
    }
  },
  {
    rateLimit: { keyPrefix: "domains-verify", maxRequests: 5 },
    csrf: true,
  }
);
