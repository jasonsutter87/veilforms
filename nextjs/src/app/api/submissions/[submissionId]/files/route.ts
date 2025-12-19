/**
 * VeilForms - Submission Files API
 * GET /api/submissions/[submissionId]/files - List all files for a submission
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { listSubmissionFiles } from "@/lib/file-storage";
import { apiLogger } from "@/lib/logger";
import { errorResponse, ErrorCodes } from "@/lib/errors";

export async function GET(
  req: NextRequest,
  { params }: { params: { submissionId: string } }
) {
  // Require authentication
  const authResult = await requireAuth(req);
  if (!authResult.authenticated) {
    return errorResponse(ErrorCodes.AUTH_TOKEN_MISSING);
  }

  const { submissionId } = params;

  try {
    // List all files for this submission
    const files = await listSubmissionFiles(submissionId);

    return NextResponse.json({
      submissionId,
      files: files.map((f) => ({
        fieldId: f.fieldId,
        index: f.index,
        filename: f.metadata.filename,
        mimeType: f.metadata.mimeType,
        size: f.metadata.size,
        uploadedAt: f.metadata.uploadedAt,
      })),
    });
  } catch (error) {
    apiLogger.error({ submissionId, error }, "Failed to list submission files");
    return errorResponse(ErrorCodes.SERVER_ERROR, {
      message: "Failed to list files",
    });
  }
}
