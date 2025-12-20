/**
 * VeilForms - Submissions Management Endpoint
 * GET /api/submissions/:formId - List submissions
 * DELETE /api/submissions/:formId - Bulk delete all
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getSubmissionsPaginated,
  deleteAllSubmissions,
  updateForm,
} from "@/lib/storage";
import { isValidFormId } from "@/lib/validation";
import { errorResponse, ErrorCodes } from "@/lib/errors";
import { authRoute } from "@/lib/route-handler";
import { verifyFormOwnership } from "@/lib/form-helpers";

type RouteParams = { params: Promise<{ formId: string }> };

export const GET = authRoute<RouteParams>(
  async (req: NextRequest, { user }, routeCtx) => {
    const { formId } = await routeCtx!.params;

    // Validate formId
    if (!isValidFormId(formId)) {
      return NextResponse.json(
        { error: "Valid formId required" },
        { status: 400 }
      );
    }

    try {
      // Get form and verify ownership
      const { form, error } = await verifyFormOwnership(formId, user.userId);
      if (error) {
        return error;
      }

      const { searchParams } = new URL(req.url);
      const cursor = searchParams.get("cursor") || undefined;
      const limit = Math.min(
        parseInt(searchParams.get("limit") || "50", 10),
        100
      );
      const startDate = searchParams.get("startDate");
      const endDate = searchParams.get("endDate");

      // Use cursor-based pagination
      let result = await getSubmissionsPaginated(formId, { cursor, limit });

      // Apply date filtering if specified
      if (startDate || endDate) {
        const start = startDate ? new Date(startDate).getTime() : 0;
        const end = endDate ? new Date(endDate).getTime() : Infinity;

        result.items = result.items.filter((s) => {
          const sub = s as { createdAt?: string; timestamp?: number; receivedAt?: number };
          const ts = sub.timestamp || sub.receivedAt || new Date(sub.createdAt || 0).getTime();
          return ts >= start && ts <= end;
        });
      }

      return NextResponse.json({
        formId,
        submissions: result.items,
        pagination: {
          total: result.total,
          nextCursor: result.nextCursor,
          hasMore: result.hasMore,
        },
      });
    } catch (err) {
      console.error("List submissions error:", err);
      return errorResponse(ErrorCodes.SERVER_ERROR);
    }
  },
  { rateLimit: { keyPrefix: "submissions-api", maxRequests: 60 } }
);

export const DELETE = authRoute<RouteParams>(
  async (req: NextRequest, { user }, routeCtx) => {
    const { formId } = await routeCtx!.params;

    // Validate formId
    if (!isValidFormId(formId)) {
      return NextResponse.json(
        { error: "Valid formId required" },
        { status: 400 }
      );
    }

    try {
      // Get form and verify ownership
      const { form, error } = await verifyFormOwnership(formId, user.userId);
      if (error) {
        return error;
      }

      const deletedCount = await deleteAllSubmissions(formId);

      // Reset form submission count
      await updateForm(formId, { submissionCount: 0 });

      return NextResponse.json({ success: true, deletedCount });
    } catch (err) {
      console.error("Delete all submissions error:", err);
      return errorResponse(ErrorCodes.SERVER_ERROR);
    }
  },
  { rateLimit: { keyPrefix: "submissions-api", maxRequests: 60 } }
);
