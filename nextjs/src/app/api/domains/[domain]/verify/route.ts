/**
 * VeilForms - Domain Verification Endpoint
 * POST /api/domains/[domain]/verify - Trigger DNS verification
 *
 * This route uses Node.js runtime for DNS verification.
 */

// Force Node.js runtime (not Edge) for DNS module
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { authRoute } from "@/lib/route-handler";
import {
  getCustomDomain,
  updateCustomDomain,
} from "@/lib/custom-domains";
import { verifyDnsTxtRecord } from "@/lib/dns-verification";
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

      // Mark as verifying
      await updateCustomDomain(domain, { status: "verifying" });

      // Perform DNS verification
      const verification = await verifyDnsTxtRecord(domain, domainData.verificationToken);

      // Log audit event
      const auditCtx = getAuditContext(req);

      if (verification.verified) {
        // Mark as active
        const updated = await updateCustomDomain(domain, {
          status: "active",
          verifiedAt: Date.now(),
          sslStatus: "provisioning",
        });

        await logAudit(
          user.userId,
          AuditEvents.DOMAIN_VERIFIED,
          {
            domain: domainData.domain,
          },
          auditCtx
        );

        return NextResponse.json({
          success: true,
          message: "Domain verified successfully",
          domain: {
            domain: updated?.domain || domain,
            status: updated?.status || "active",
            sslStatus: updated?.sslStatus || "provisioning",
            verifiedAt: updated?.verifiedAt,
          },
        });
      } else {
        // Mark as failed
        const updated = await updateCustomDomain(domain, {
          status: "failed",
          failureReason: verification.error,
        });

        await logAudit(
          user.userId,
          AuditEvents.DOMAIN_VERIFICATION_FAILED,
          {
            domain: domainData.domain,
            reason: verification.error,
          },
          auditCtx
        );

        return NextResponse.json(
          {
            success: false,
            error: verification.error || "Verification failed",
            domain: {
              domain: updated?.domain || domain,
              status: updated?.status || "failed",
              failureReason: updated?.failureReason,
            },
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
