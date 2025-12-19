/**
 * VeilForms - Individual File API
 * GET /api/submissions/[submissionId]/files/[fieldId] - Get encrypted file by field ID
 * DELETE /api/submissions/[submissionId]/files/[fieldId] - Delete file
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getEncryptedFile, deleteFile } from "@/lib/file-storage";
import { apiLogger } from "@/lib/logger";
import { errorResponse, ErrorCodes } from "@/lib/errors";

export async function GET(
  req: NextRequest,
  { params }: { params: { submissionId: string; fieldId: string } }
) {
  // Require authentication
  const authResult = await requireAuth(req);
  if (!authResult.authenticated) {
    return errorResponse(ErrorCodes.AUTH_TOKEN_MISSING);
  }

  const { submissionId, fieldId } = params;
  const { searchParams } = new URL(req.url);
  const index = parseInt(searchParams.get("index") || "0", 10);

  try {
    // Get encrypted file metadata
    const fileMetadata = await getEncryptedFile(submissionId, fieldId, index);

    if (!fileMetadata) {
      return errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, {
        message: "File not found",
      });
    }

    // Return encrypted file data
    return NextResponse.json({
      submissionId,
      fieldId,
      index,
      ...fileMetadata,
    });
  } catch (error) {
    apiLogger.error({ submissionId, fieldId, error }, "Failed to get file");
    return errorResponse(ErrorCodes.SERVER_ERROR, {
      message: "Failed to retrieve file",
    });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { submissionId: string; fieldId: string } }
) {
  // Require authentication
  const authResult = await requireAuth(req);
  if (!authResult.authenticated) {
    return errorResponse(ErrorCodes.AUTH_TOKEN_MISSING);
  }

  const { submissionId, fieldId } = params;
  const { searchParams } = new URL(req.url);
  const index = parseInt(searchParams.get("index") || "0", 10);

  try {
    // Delete file
    await deleteFile(submissionId, fieldId, index);

    return NextResponse.json({
      success: true,
      submissionId,
      fieldId,
      index,
    });
  } catch (error) {
    apiLogger.error({ submissionId, fieldId, error }, "Failed to delete file");
    return errorResponse(ErrorCodes.SERVER_ERROR, {
      message: "Failed to delete file",
    });
  }
}
