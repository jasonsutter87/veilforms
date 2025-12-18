/**
 * VeilForms - Regenerate Encryption Keys Endpoint
 * POST /api/forms/:id/regenerate-keys - Regenerate form encryption keys
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { updateForm } from "@/lib/storage";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";
import { logAudit, AuditEvents, getAuditContext } from "@/lib/audit";
import { validateCsrfToken } from "@/lib/csrf";
import { isValidFormId } from "@/lib/validation";
import { errorResponse, ErrorCodes } from "@/lib/errors";
import { generateKeyPair } from "@/lib/encryption";
import { verifyFormOwnership } from "@/lib/form-helpers";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id: formId } = await params;

  // Rate limit
  const rateLimit = await checkRateLimit(req, {
    keyPrefix: "forms-api",
    maxRequests: 30,
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

  // CSRF protection
  if (!validateCsrfToken(req)) {
    return NextResponse.json(
      { error: "CSRF token validation failed" },
      { status: 403 }
    );
  }

  // Validate formId format
  if (!isValidFormId(formId)) {
    return NextResponse.json(
      { error: "Valid form ID required" },
      { status: 400 }
    );
  }

  try {
    // Get form and verify ownership
    const { form, error } = await verifyFormOwnership(formId, auth.user!.userId);
    if (error) {
      return error;
    }

    // Generate new encryption keys
    const { publicKey, privateKey } = await generateKeyPair();

    // Update form with new public key
    const updated = await updateForm(formId, {
      publicKey: JSON.stringify(publicKey),
      keyRotatedAt: new Date().toISOString(),
    });

    // Log audit event (critical security action)
    const auditCtx = getAuditContext(req);
    await logAudit(
      auth.user!.userId,
      AuditEvents.FORM_KEYS_REGENERATED,
      {
        formId,
        keyRotatedAt: (updated as { keyRotatedAt?: string })?.keyRotatedAt,
      },
      auditCtx
    );

    return NextResponse.json({
      form: {
        id: updated!.id,
        publicKey: updated!.publicKey,
        privateKey: JSON.stringify(privateKey), // Only returned on regeneration!
        keyRotatedAt: (updated as { keyRotatedAt?: string })?.keyRotatedAt,
      },
      warning:
        "Save your new private key immediately! Old submissions will no longer be decryptable with this key.",
    });
  } catch (err) {
    console.error("Regenerate keys error:", err);
    return errorResponse(ErrorCodes.SERVER_ERROR);
  }
}
