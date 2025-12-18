/**
 * VeilForms - Form Submission Endpoint
 * POST /api/submit - Stores encrypted submissions
 */

import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@netlify/blobs";
import { updateForm, getUserById } from "@/lib/storage";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";
import { fireWebhookWithRetry } from "@/lib/webhook-retry";
import {
  checkIdempotencyKey,
  storeIdempotencyKey,
  getIdempotencyKeyFromRequest,
  getIdempotencyHeaders,
} from "@/lib/idempotency";
import { isValidFormId, isValidSubmissionId } from "@/lib/validation";
import { errorResponse, ErrorCodes } from "@/lib/errors";
import { getFormForSubmission } from "@/lib/form-helpers";
import { getSubmissionLimit } from "@/lib/subscription-limits";

const MAX_PAYLOAD_SIZE = 1024 * 1024; // 1MB

interface SubmissionIndex {
  submissions: Array<{ id: string; ts: number }>;
}

/**
 * Update submission index for efficient listing
 */
async function updateIndex(
  store: ReturnType<typeof getStore>,
  submissionId: string,
  timestamp: number
): Promise<void> {
  const indexKey = "_index";

  try {
    const index = ((await store.get(indexKey, { type: "json" })) as SubmissionIndex) || {
      submissions: [],
    };

    // Add new submission to index (newest first)
    index.submissions.unshift({
      id: submissionId,
      ts: timestamp,
    });

    // Keep index manageable (last 10000 entries)
    if (index.submissions.length > 10000) {
      index.submissions = index.submissions.slice(0, 10000);
    }

    await store.setJSON(indexKey, index);
  } catch (e) {
    console.warn("Index update failed:", e);
  }
}

/**
 * Verify reCAPTCHA v3 token with Google
 */
async function verifyRecaptcha(
  token: string,
  secretKey: string,
  threshold = 0.5
): Promise<{ success: boolean; score?: number; reason?: string }> {
  try {
    const response = await fetch(
      "https://www.google.com/recaptcha/api/siteverify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `secret=${encodeURIComponent(secretKey)}&response=${encodeURIComponent(token)}`,
      }
    );

    const data = await response.json();

    if (!data.success) {
      return {
        success: false,
        reason: data["error-codes"]?.join(", ") || "Verification failed",
      };
    }

    const score = data.score || 0;
    if (score < threshold) {
      return {
        success: false,
        reason: `Score too low: ${score} (threshold: ${threshold})`,
      };
    }

    return {
      success: true,
      score: score,
    };
  } catch (error) {
    console.error("reCAPTCHA verification error:", error);
    return {
      success: false,
      reason: "Verification service error",
    };
  }
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin") || "*";

  // Rate limit submissions (30 per minute per IP)
  const rateLimit = await checkRateLimit(req, {
    keyPrefix: "submit",
    maxRequests: 30,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: rateLimit.retryAfter },
      { status: 429, headers: getRateLimitHeaders(rateLimit) }
    );
  }

  // Check payload size before parsing
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength) > MAX_PAYLOAD_SIZE) {
    return NextResponse.json(
      { error: "Payload too large. Maximum size is 1MB" },
      { status: 413 }
    );
  }

  try {
    // Read body with size validation
    const rawBody = await req.text();
    const bodySize = new TextEncoder().encode(rawBody).length;
    if (bodySize > MAX_PAYLOAD_SIZE) {
      return NextResponse.json(
        { error: "Payload too large. Maximum size is 1MB" },
        { status: 413 }
      );
    }

    const body = JSON.parse(rawBody);
    const { formId, submissionId, payload, timestamp, meta, spamProtection } =
      body;

    // Validate required fields
    if (!formId || !submissionId || !payload) {
      return errorResponse(ErrorCodes.VALIDATION_MISSING_FIELD, {
        details: { required: ["formId", "submissionId", "payload"] },
      });
    }

    // Validate formId format
    if (!isValidFormId(formId)) {
      return errorResponse(ErrorCodes.VALIDATION_INVALID_FORMAT, {
        field: "formId",
        hint: "Form ID must be a valid format.",
      });
    }

    // Check for idempotency key (prevents duplicate submissions)
    const idempotencyKey = getIdempotencyKeyFromRequest(req);
    if (idempotencyKey) {
      try {
        const idempotencyCheck = await checkIdempotencyKey(
          idempotencyKey,
          formId
        );
        if (idempotencyCheck.exists) {
          // Return cached response - this is a duplicate request
          return NextResponse.json(idempotencyCheck.response, {
            headers: getIdempotencyHeaders(idempotencyCheck),
          });
        }
      } catch (idempotencyError) {
        return NextResponse.json(
          { error: (idempotencyError as Error).message },
          { status: 400 }
        );
      }
    }

    // Validate submissionId format
    if (!isValidSubmissionId(submissionId)) {
      return errorResponse(ErrorCodes.VALIDATION_INVALID_FORMAT, {
        field: "submissionId",
        hint: "Submission ID must be a valid UUID format.",
      });
    }

    // Get form and validate it exists and is active
    const { form, error } = await getFormForSubmission(formId);
    if (error) {
      return error;
    }

    // Check if form is paused (getFormForSubmission already checks for deleted)
    const formStatus = (form as { status?: string }).status;
    if (formStatus === "paused") {
      return errorResponse(ErrorCodes.RESOURCE_FORBIDDEN, {
        message: "Form is not accepting submissions",
        hint: "This form is currently paused.",
      });
    }

    // Check origin is allowed
    if (
      form.settings?.allowedOrigins &&
      !form.settings.allowedOrigins.includes("*")
    ) {
      if (!form.settings.allowedOrigins.includes(origin)) {
        return NextResponse.json(
          { error: "Origin not allowed" },
          { status: 403 }
        );
      }
    }

    // SPAM PROTECTION VALIDATION

    // 1. Honeypot validation (if enabled)
    if (form.settings?.spamProtection?.honeypot) {
      const honeypotValue = spamProtection?.honeypot;

      if (honeypotValue === undefined) {
        return NextResponse.json(
          { error: "Spam protection validation failed" },
          { status: 400 }
        );
      }

      if (honeypotValue !== "") {
        console.warn("[SPAM] Honeypot triggered for form:", formId);
        return NextResponse.json({ error: "Spam detected" }, { status: 403 });
      }
    }

    // 2. reCAPTCHA validation (if enabled)
    if (form.settings?.spamProtection?.recaptcha?.enabled) {
      const recaptchaToken = spamProtection?.recaptchaToken;
      const recaptchaSecretKey = form.settings.spamProtection.recaptcha.secretKey;
      const threshold = form.settings.spamProtection.recaptcha.threshold || 0.5;

      if (!recaptchaToken) {
        return NextResponse.json(
          { error: "reCAPTCHA token required" },
          { status: 400 }
        );
      }

      if (!recaptchaSecretKey) {
        console.error(
          "[CONFIG] reCAPTCHA enabled but no secret key configured"
        );
        return NextResponse.json(
          { error: "reCAPTCHA not properly configured" },
          { status: 500 }
        );
      }

      const recaptchaValid = await verifyRecaptcha(
        recaptchaToken,
        recaptchaSecretKey,
        threshold
      );

      if (!recaptchaValid.success) {
        console.warn(
          "[SPAM] reCAPTCHA verification failed:",
          recaptchaValid.reason
        );
        return NextResponse.json(
          {
            error: "Spam protection verification failed",
            reason: recaptchaValid.reason,
          },
          { status: 403 }
        );
      }
    }

    // Check submission limits based on user's subscription
    const user = await getUserById(form.userId);
    const subscription = user?.subscription || "free";
    const limit = getSubmissionLimit(subscription);
    if ((form.submissionCount || 0) >= limit) {
      return errorResponse(ErrorCodes.QUOTA_EXCEEDED, {
        message: "Submission limit reached for this form",
        hint: "The form owner has reached their plan limit.",
        details: {
          limit,
          current: form.submissionCount,
          subscription,
        },
      });
    }

    // Validate encrypted payload structure
    const encryptedKey = payload.encryptedKey || payload.key;
    if (!payload.encrypted || !encryptedKey || !payload.iv || !payload.version) {
      return errorResponse(ErrorCodes.ENCRYPTION_INVALID_KEY, {
        message: "Invalid encrypted payload structure",
        hint: "The submission must be encrypted using the VeilForms SDK.",
        details: { required: ["encrypted", "encryptedKey", "iv", "version"] },
      });
    }

    // Normalize payload to use encryptedKey
    if (payload.key && !payload.encryptedKey) {
      payload.encryptedKey = payload.key;
      delete payload.key;
    }

    // Get blob store for this form
    const store = getStore({ name: `veilforms-${formId}`, consistency: "strong" });

    // Build submission record
    const submission = {
      id: submissionId,
      formId,
      payload,
      timestamp: timestamp || Date.now(),
      receivedAt: Date.now(),
      meta: {
        sdkVersion: meta?.sdkVersion || "unknown",
        formVersion: meta?.formVersion || "1",
        userAgent: req.headers.get("user-agent")?.substring(0, 200) || "unknown",
        region: req.headers.get("x-vercel-ip-country") || "unknown",
        ...meta,
      },
    };

    // Store submission
    await store.setJSON(submissionId, submission);

    // Update submission index
    await updateIndex(store, submissionId, submission.timestamp);

    // Increment form submission count
    await updateForm(formId, {
      submissionCount: (form.submissionCount || 0) + 1,
      lastSubmissionAt: new Date().toISOString(),
    });

    // Fire webhook if configured (async, don't wait)
    if (form.settings?.webhookUrl) {
      const webhookSecret = (form.settings as { webhookSecret?: string }).webhookSecret;
      fireWebhookWithRetry(form.settings.webhookUrl, submission, webhookSecret).catch(
        (err) => {
          console.error("Webhook delivery error:", err.message);
        }
      );
    }

    // Prepare success response
    const successResponse = {
      success: true,
      submissionId,
      timestamp: submission.timestamp,
    };

    // Store idempotency key if provided (24hr TTL)
    if (idempotencyKey) {
      await storeIdempotencyKey(idempotencyKey, formId, successResponse);
    }

    return NextResponse.json(successResponse);
  } catch (error) {
    console.error("Submission error:", error);
    return errorResponse(ErrorCodes.SERVER_ERROR, {
      message: "Submission failed",
    });
  }
}
