/**
 * VeilForms - Forms Management Endpoint
 * GET /api/forms - List user's forms
 * POST /api/forms - Create new form
 */

import { NextRequest, NextResponse } from "next/server";
import { authRoute } from "@/lib/route-handler";
import { createForm, getUserForms, getUserById } from "@/lib/storage";
import { logAudit, AuditEvents, getAuditContext } from "@/lib/audit";
import { validateFormName } from "@/lib/validation";
import { errorResponse, ErrorCodes } from "@/lib/errors";
import { generateKeyPair } from "@/lib/encryption";
import { getFormLimit } from "@/lib/subscription-limits";

export const GET = authRoute(async (req, { user }) => {
  try {
    const forms = await getUserForms(user.userId);

    // Remove sensitive data and filter deleted forms
    const sanitizedForms = forms
      .filter((f) => (f as { status?: string }).status !== "deleted")
      .map((form) => ({
        id: form.id,
        name: form.name,
        status: (form as { status?: string }).status || "active",
        createdAt: form.createdAt,
        updatedAt: form.updatedAt,
        submissionCount: form.submissionCount || 0,
        lastSubmissionAt: (form as { lastSubmissionAt?: string }).lastSubmissionAt,
        settings: {
          encryption: form.settings?.encryption,
          piiStrip: form.settings?.piiStrip,
          allowedOrigins: form.settings?.allowedOrigins,
        },
      }));

    return NextResponse.json({
      forms: sanitizedForms,
      total: sanitizedForms.length,
    });
  } catch (err) {
    console.error("List forms error:", err);
    return errorResponse(ErrorCodes.SERVER_ERROR);
  }
}, { rateLimit: { keyPrefix: "forms-api", maxRequests: 30 } });

export const POST = authRoute(async (req, { user }) => {
  try {
    const body = await req.json();
    const { name, settings } = body;

    const nameValidation = validateFormName(name);
    if (!nameValidation.valid) {
      return NextResponse.json(
        { error: nameValidation.error },
        { status: 400 }
      );
    }

    // Check form creation limits based on subscription
    const userRecord = await getUserById(user.userId);
    const subscription = userRecord?.subscription || "free";
    const limit = getFormLimit(subscription);

    // Get current form count (excluding deleted forms)
    const existingForms = await getUserForms(user.userId);
    const activeFormCount = existingForms.filter(
      (f) => (f as { status?: string }).status !== "deleted"
    ).length;

    if (activeFormCount >= limit) {
      return NextResponse.json(
        {
          error: "Form creation limit reached",
          limit,
          current: activeFormCount,
          subscription,
          message:
            subscription === "free" || subscription === "starter"
              ? "Upgrade to Pro for up to 50 forms, or Business for unlimited forms"
              : subscription === "pro"
              ? "Upgrade to Business for unlimited forms"
              : "Contact support for assistance",
        },
        { status: 402 }
      );
    }

    // Generate encryption keys
    const { publicKey, privateKey } = await generateKeyPair();

    // Create form
    const form = await createForm(user.userId, {
      name: name.trim(),
      publicKey: JSON.stringify(publicKey),
      settings: {
        encryption: true,
        piiStrip: settings?.piiStrip || false,
        webhookUrl: settings?.webhookUrl || null,
        allowedOrigins: settings?.allowedOrigins || ["*"],
        spamProtection: {
          honeypot: settings?.spamProtection?.honeypot !== false,
          recaptcha: {
            enabled: settings?.spamProtection?.recaptcha?.enabled || false,
            siteKey: settings?.spamProtection?.recaptcha?.siteKey || "",
            secretKey: settings?.spamProtection?.recaptcha?.secretKey || "",
            threshold: settings?.spamProtection?.recaptcha?.threshold || 0.5,
          },
        },
        ...settings,
      },
    });

    // Log audit event
    const auditCtx = getAuditContext(req);
    await logAudit(
      user.userId,
      AuditEvents.FORM_CREATED,
      {
        formId: form.id,
        formName: form.name,
      },
      auditCtx
    );

    return NextResponse.json(
      {
        form: {
          id: form.id,
          name: form.name,
          status: "active",
          createdAt: form.createdAt,
          publicKey: form.publicKey,
          privateKey: JSON.stringify(privateKey), // Only returned on creation!
          settings: form.settings,
        },
        warning:
          "Save your private key immediately! This is the only time it will be shown. We cannot recover it.",
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Create form error:", err);
    return errorResponse(ErrorCodes.SERVER_ERROR);
  }
}, {
  rateLimit: { keyPrefix: "forms-api", maxRequests: 30 },
  csrf: true
});
