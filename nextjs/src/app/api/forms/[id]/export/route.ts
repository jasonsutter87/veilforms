/**
 * VeilForms - Export Submissions Endpoint
 * POST /api/forms/:id/export - Log export action for audit trail
 *
 * Note: Actual export happens client-side after decryption.
 * This endpoint only logs the export event for security auditing.
 */

import { NextRequest, NextResponse } from "next/server";
import { authRoute } from "@/lib/route-handler";
import { verifyFormOwnership } from "@/lib/form-helpers";
import { isValidFormId } from "@/lib/validation";
import { errorResponse, ErrorCodes } from "@/lib/errors";
import { logAudit, getAuditContext } from "@/lib/audit";

type RouteParams = { params: Promise<{ id: string }> };

interface ExportLogRequest {
  format: "csv" | "json";
  submissionCount: number;
  dateRange?: {
    start: string;
    end: string;
  } | null;
}

export const POST = authRoute<RouteParams>(
  async (req: NextRequest, { user }, { params }: RouteParams) => {
    const { id: formId } = await params;

    // Validate formId
    if (!isValidFormId(formId)) {
      return NextResponse.json({ error: "Valid formId required" }, { status: 400 });
    }

    try {
      // Verify form ownership
      const { form, error } = await verifyFormOwnership(formId, user.userId);
      if (error) {
        return error;
      }

      if (!form) {
        return NextResponse.json({ error: "Form not found" }, { status: 404 });
      }

      // Parse request body
      const body = (await req.json()) as ExportLogRequest;

      // Validate format
      if (!body.format || !["csv", "json"].includes(body.format)) {
        return NextResponse.json({ error: "Invalid format" }, { status: 400 });
      }

      // Log export to audit trail
      const auditContext = getAuditContext(req);
      await logAudit(
        user.userId,
        "submissions.exported",
        {
          formId,
          formName: form.name,
          format: body.format,
          submissionCount: body.submissionCount || 0,
          dateRange: body.dateRange || null,
        },
        auditContext
      );

      return NextResponse.json({
        success: true,
        message: "Export logged successfully",
      });
    } catch (err) {
      console.error("Export logging error:", err);
      return errorResponse(ErrorCodes.SERVER_ERROR);
    }
  },
  {
    rateLimit: {
      keyPrefix: "export-api",
      maxRequests: 10, // 10 exports per minute
      windowMs: 60 * 1000,
    },
  }
);
