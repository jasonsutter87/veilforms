/**
 * VeilForms - Single Submission Management Endpoint
 * GET /api/submissions/:formId/:submissionId - Get single submission
 * DELETE /api/submissions/:formId/:submissionId - Delete submission
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import {
  getForm,
  getSubmission,
  deleteSubmission,
  updateForm,
} from "@/lib/storage";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";
import { isValidFormId, isValidSubmissionId } from "@/lib/validation";
import { errorResponse, ErrorCodes } from "@/lib/errors";
import { deleteSubmissionFiles } from "@/lib/file-storage";

type RouteParams = { params: Promise<{ formId: string; submissionId: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { formId, submissionId } = await params;

  // Rate limit
  const rateLimit = await checkRateLimit(req, {
    keyPrefix: "submissions-api",
    maxRequests: 60,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: rateLimit.retryAfter },
      { status: 429, headers: getRateLimitHeaders(rateLimit) }
    );
  }

  // Authenticate
  const auth = await authenticateRequest(req);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // Validate formId
  if (!isValidFormId(formId)) {
    return NextResponse.json(
      { error: "Valid formId required" },
      { status: 400 }
    );
  }

  // Validate submissionId format
  if (!isValidSubmissionId(submissionId)) {
    return NextResponse.json(
      { error: "Invalid submission ID format" },
      { status: 400 }
    );
  }

  try {
    // Get form and verify ownership
    const form = await getForm(formId);
    if (!form) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }

    if (form.userId !== auth.user!.userId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const submission = await getSubmission(formId, submissionId);
    if (!submission) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ submission });
  } catch (err) {
    console.error("Get submission error:", err);
    return errorResponse(ErrorCodes.SERVER_ERROR);
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { formId, submissionId } = await params;

  // Rate limit
  const rateLimit = await checkRateLimit(req, {
    keyPrefix: "submissions-api",
    maxRequests: 60,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: rateLimit.retryAfter },
      { status: 429, headers: getRateLimitHeaders(rateLimit) }
    );
  }

  // Authenticate
  const auth = await authenticateRequest(req);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // Validate formId
  if (!isValidFormId(formId)) {
    return NextResponse.json(
      { error: "Valid formId required" },
      { status: 400 }
    );
  }

  // Validate submissionId format
  if (!isValidSubmissionId(submissionId)) {
    return NextResponse.json(
      { error: "Invalid submission ID format" },
      { status: 400 }
    );
  }

  try {
    // Get form and verify ownership
    const form = await getForm(formId);
    if (!form) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }

    if (form.userId !== auth.user!.userId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Check submission exists
    const submission = await getSubmission(formId, submissionId);
    if (!submission) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 }
      );
    }

    await deleteSubmission(formId, submissionId);

    // Delete associated files
    try {
      await deleteSubmissionFiles(submissionId);
    } catch (fileError) {
      // Log but don't fail the deletion if file cleanup fails
      console.error("Failed to delete submission files:", fileError);
    }

    // Decrement form submission count
    await updateForm(formId, {
      submissionCount: Math.max((form.submissionCount || 1) - 1, 0),
    });

    return NextResponse.json({ success: true, deleted: submissionId });
  } catch (err) {
    console.error("Delete submission error:", err);
    return errorResponse(ErrorCodes.SERVER_ERROR);
  }
}
