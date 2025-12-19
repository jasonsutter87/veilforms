/**
 * VeilForms - Zapier Sample Data
 * POST /api/forms/:id/zapier/sample - Generate sample submission data for Zapier
 *
 * This endpoint helps users set up their Zaps by providing example data
 * showing what fields will be available when a form receives a submission.
 */

import { NextRequest, NextResponse } from "next/server";
import { isValidFormId } from "@/lib/validation";
import { errorResponse, ErrorCodes } from "@/lib/errors";
import { verifyFormOwnership } from "@/lib/form-helpers";
import { authRoute } from "@/lib/route-handler";
import { generateZapierSampleData } from "@/lib/zapier";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/forms/:id/zapier/sample
 * Generate sample submission data in Zapier format
 */
export const POST = authRoute(
  async (req: NextRequest, { user }, { params }: RouteParams) => {
    const { id: formId } = await params;

    if (!isValidFormId(formId)) {
      return NextResponse.json(
        { error: "Valid form ID required" },
        { status: 400 }
      );
    }

    try {
      const { form, error } = await verifyFormOwnership(formId, user.userId);
      if (error) {
        return error;
      }

      // Generate sample data based on form structure
      const sampleData = generateZapierSampleData({
        id: form.id,
        name: form.name,
        fields: (form as { fields?: Array<{ type: string; name: string; label: string }> }).fields,
      });

      return NextResponse.json({
        sample: sampleData,
        note: "This is sample data showing the structure of submissions sent to Zapier. Actual submissions will contain real form data.",
      });
    } catch (err) {
      console.error("Generate Zapier sample data error:", err);
      return errorResponse(ErrorCodes.SERVER_ERROR);
    }
  },
  { rateLimit: { keyPrefix: "zapier-sample", maxRequests: 20 } }
);
