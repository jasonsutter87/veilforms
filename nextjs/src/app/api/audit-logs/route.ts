/**
 * VeilForms - Audit Logs Endpoint
 * GET /api/audit-logs - List user's audit logs
 * GET /api/audit-logs?formId=xxx - List form-specific logs
 */

import { NextRequest, NextResponse } from "next/server";
import { authRoute } from "@/lib/route-handler";
import { getAuditLogs, getFormAuditLogs } from "@/lib/audit";
import { getForm } from "@/lib/storage";
import { errorResponse, ErrorCodes } from "@/lib/errors";

export const GET = authRoute(async (req, { user }) => {
  try {
    const { searchParams } = new URL(req.url);
    const formId = searchParams.get("formId");
    const eventType = searchParams.get("event");
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "50", 10),
      100
    );
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // If formId specified, verify ownership
    if (formId) {
      const form = await getForm(formId);
      if (!form || form.userId !== user.userId) {
        return NextResponse.json(
          { error: "Form not found or access denied" },
          { status: 404 }
        );
      }

      const result = await getFormAuditLogs(user.userId, formId, limit);
      return NextResponse.json(result);
    }

    // Get all audit logs for user
    const result = await getAuditLogs(
      user.userId,
      limit,
      offset,
      eventType
    );

    return NextResponse.json(result);
  } catch (err) {
    console.error("Audit logs error:", err);
    return errorResponse(ErrorCodes.SERVER_ERROR);
  }
}, { rateLimit: { keyPrefix: "audit-logs", maxRequests: 30 } });
