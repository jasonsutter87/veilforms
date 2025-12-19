/**
 * VeilForms - Custom Domains Management Endpoint
 * GET /api/domains - List user's custom domains
 * POST /api/domains - Add new custom domain
 */

import { NextRequest, NextResponse } from "next/server";
import { authRoute } from "@/lib/route-handler";
import {
  createCustomDomain,
  getUserDomains,
  validateDomain,
  getVerificationRecordName,
} from "@/lib/custom-domains";
import { getUserById } from "@/lib/storage";
import { getCustomDomainLimit } from "@/lib/subscription-limits";
import { errorResponse, ErrorCodes } from "@/lib/errors";
import { logAudit, AuditEvents, getAuditContext } from "@/lib/audit";

export const GET = authRoute(
  async (req, { user }) => {
    try {
      const domains = await getUserDomains(user.userId);

      return NextResponse.json({
        domains: domains.map((d) => ({
          domain: d.domain,
          status: d.status,
          sslStatus: d.sslStatus,
          verifiedAt: d.verifiedAt,
          createdAt: d.createdAt,
          failureReason: d.failureReason,
        })),
        total: domains.length,
      });
    } catch (err) {
      console.error("List domains error:", err);
      return errorResponse(ErrorCodes.SERVER_ERROR);
    }
  },
  { rateLimit: { keyPrefix: "domains-api", maxRequests: 30 } }
);

export const POST = authRoute(
  async (req, { user }) => {
    try {
      const body = await req.json();
      const { domain } = body;

      // Validate domain format
      const validation = validateDomain(domain);
      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.error || "Invalid domain" },
          { status: 400 }
        );
      }

      const sanitizedDomain = validation.sanitized!;

      // Check custom domain limits based on subscription
      const userRecord = await getUserById(user.userId);
      const subscription = userRecord?.subscription || "free";
      const limit = getCustomDomainLimit(subscription);

      if (limit === 0) {
        return NextResponse.json(
          {
            error: "Custom domains not available on your plan",
            subscription,
            message: "Upgrade to Business for 1 custom domain or Enterprise for up to 5 custom domains",
          },
          { status: 402 }
        );
      }

      // Get current domain count
      const existingDomains = await getUserDomains(user.userId);
      if (existingDomains.length >= limit) {
        return NextResponse.json(
          {
            error: "Custom domain limit reached",
            limit,
            current: existingDomains.length,
            subscription,
            message:
              subscription === "business"
                ? "Upgrade to Enterprise for up to 5 custom domains"
                : "Contact support for additional domains",
          },
          { status: 402 }
        );
      }

      // Create custom domain
      const customDomain = await createCustomDomain(sanitizedDomain, user.userId);

      // Log audit event
      const auditCtx = getAuditContext(req);
      await logAudit(
        user.userId,
        AuditEvents.DOMAIN_ADDED,
        {
          domain: customDomain.domain,
        },
        auditCtx
      );

      // Provide verification instructions
      const verificationRecordName = getVerificationRecordName(customDomain.domain);

      return NextResponse.json(
        {
          domain: {
            domain: customDomain.domain,
            status: customDomain.status,
            sslStatus: customDomain.sslStatus,
            createdAt: customDomain.createdAt,
          },
          verification: {
            type: "TXT",
            name: verificationRecordName,
            value: customDomain.verificationToken,
            instructions: [
              `1. Add a TXT record to your DNS settings`,
              `2. Name: ${verificationRecordName}`,
              `3. Value: ${customDomain.verificationToken}`,
              `4. Wait for DNS propagation (can take up to 48 hours)`,
              `5. Click "Verify" to check the DNS record`,
            ],
          },
        },
        { status: 201 }
      );
    } catch (err) {
      console.error("Add domain error:", err);

      // Handle specific errors
      if (err instanceof Error) {
        if (err.message === "Domain already registered") {
          return NextResponse.json(
            { error: "This domain is already registered" },
            { status: 409 }
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
