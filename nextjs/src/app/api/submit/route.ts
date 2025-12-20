/**
 * VeilForms - Form Submission Endpoint
 * POST /api/submit - Stores encrypted submissions
 */

import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@netlify/blobs";
import { apiLogger } from "@/lib/logger";
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
import { sendSubmissionNotification, sendSubmissionConfirmation, BASE_URL } from "@/lib/email";
import { checkEmailRateLimit } from "@/lib/email-rate-limit";
import { storeEncryptedFile, validateFileSize, validateFileType, FILE_STORAGE_CONFIG } from "@/lib/file-storage";
import type { EncryptedFileMetadata } from "@/lib/file-storage";
import { assignVariant, type ABTest, type VariantAssignment } from "@/lib/ab-testing";

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
    apiLogger.warn({ submissionId, error: e }, 'Index update failed');
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
    apiLogger.error({ error }, 'reCAPTCHA verification error');
    return {
      success: false,
      reason: "Verification service error",
    };
  }
}

/**
 * Extract email field value from encrypted submission payload
 * Returns null if no email field found (we can't read encrypted data)
 */
function findEmailInSubmission(
  formFields: Array<{ type: string; name: string }> | undefined,
  payload: unknown
): string | null {
  // Since data is encrypted, we can only check if form has email field
  // The actual email would need to be passed separately or in metadata
  // For now, return null - this can be enhanced later
  return null;
}

/**
 * Get active A/B test for a form
 */
async function getActiveABTest(formId: string): Promise<ABTest | null> {
  const abTestStore = getStore({ name: "vf-ab-tests", consistency: "strong" });
  const indexKey = `form_tests_${formId}`;

  try {
    const testIds =
      ((await abTestStore.get(indexKey, { type: "json" })) as string[] | null) || [];

    // Find first running test
    for (const testId of testIds) {
      const test = (await abTestStore.get(`test_${testId}`, {
        type: "json",
      })) as ABTest | null;
      if (test && test.status === "running") {
        return test;
      }
    }
    return null;
  } catch (error) {
    apiLogger.warn({ formId, error }, "Failed to check for active A/B test");
    return null;
  }
}

/**
 * Get or create variant assignment for a user
 */
async function getOrAssignVariant(
  test: ABTest,
  userId: string
): Promise<{ variantId: string | null; isNewAssignment: boolean }> {
  const abTestStore = getStore({ name: "vf-ab-tests", consistency: "strong" });
  const assignmentKey = `assignment_${test.id}_${userId}`;

  try {
    // Check for existing assignment
    const existing = (await abTestStore.get(assignmentKey, {
      type: "json",
    })) as VariantAssignment | null;

    if (existing) {
      return { variantId: existing.variantId, isNewAssignment: false };
    }

    // Assign new variant
    const { variantId, inTest } = assignVariant(test, userId);

    if (!inTest || !variantId) {
      return { variantId: null, isNewAssignment: false };
    }

    // Store assignment
    const assignment: VariantAssignment = {
      testId: test.id,
      variantId,
      userId,
      assignedAt: Date.now(),
    };
    await abTestStore.setJSON(assignmentKey, assignment);

    return { variantId, isNewAssignment: true };
  } catch (error) {
    apiLogger.error({ testId: test.id, userId, error }, "Variant assignment failed");
    return { variantId: null, isNewAssignment: false };
  }
}

/**
 * Update A/B test metrics (impressions and conversions)
 */
async function updateABTestMetrics(
  test: ABTest,
  variantId: string,
  isImpression: boolean,
  isConversion: boolean
): Promise<void> {
  const abTestStore = getStore({ name: "vf-ab-tests", consistency: "strong" });

  try {
    // Find the variant to update
    const variantIndex = test.variants.findIndex((v) => v.id === variantId);
    if (variantIndex === -1) {
      apiLogger.warn({ testId: test.id, variantId }, "Variant not found in test");
      return;
    }

    // Update metrics
    const variant = test.variants[variantIndex];
    if (!variant) {
      apiLogger.warn({ testId: test.id, variantIndex }, "Variant at index not found");
      return;
    }

    if (isImpression) {
      variant.impressions += 1;
    }
    if (isConversion) {
      variant.conversions += 1;
    }

    // Save updated test
    await abTestStore.setJSON(`test_${test.id}`, test);

    apiLogger.debug(
      {
        testId: test.id,
        variantId,
        impressions: variant.impressions,
        conversions: variant.conversions,
      },
      "Updated A/B test metrics"
    );
  } catch (error) {
    apiLogger.error(
      { testId: test.id, variantId, error },
      "Failed to update A/B test metrics"
    );
  }
}

/**
 * Send email notifications for submission (fire and forget)
 */
async function handleEmailNotifications(
  form: {
    id: string;
    name: string;
    userId: string;
    settings?: { notifications?: { emailOnSubmission: boolean; sendConfirmation: boolean; recipients: string[] } };
    fields?: Array<{ type: string; name: string }>;
  },
  submissionId: string,
  timestamp: number,
  userEmail: string | null
): Promise<void> {
  try {
    const notifications = form.settings?.notifications;

    // Skip if notifications not configured
    if (!notifications) {
      return;
    }

    // Send notification to form owner
    if (notifications.emailOnSubmission && userEmail) {
      // Check rate limit
      const rateLimit = await checkEmailRateLimit(userEmail, "submissionNotification");

      if (rateLimit.allowed) {
        const dashboardUrl = `${BASE_URL}/dashboard/forms/${form.id}/submissions/${submissionId}`;

        await sendSubmissionNotification(
          userEmail,
          form.name,
          submissionId,
          dashboardUrl,
          timestamp,
          notifications.recipients
        ).catch((err) => {
          apiLogger.warn(
            { formId: form.id, submissionId, error: err.message },
            'Failed to send submission notification email'
          );
        });
      } else {
        apiLogger.warn(
          { formId: form.id, email: userEmail, resetAt: rateLimit.resetAt },
          'Email rate limit exceeded for submission notifications'
        );
      }
    }

    // Send confirmation to respondent
    if (notifications.sendConfirmation) {
      // Extract respondent email from submission
      // Note: This requires the email to be in plain metadata or form structure
      const respondentEmail = findEmailInSubmission(form.fields, {});

      if (respondentEmail) {
        await sendSubmissionConfirmation(
          respondentEmail,
          form.name
        ).catch((err) => {
          apiLogger.warn(
            { formId: form.id, submissionId, error: err.message },
            'Failed to send confirmation email to respondent'
          );
        });
      } else {
        apiLogger.debug(
          { formId: form.id, submissionId },
          'Confirmation email enabled but no email field found in submission'
        );
      }
    }
  } catch (error) {
    // Never fail submission due to email errors
    apiLogger.error(
      { formId: form.id, submissionId, error },
      'Email notification handler error'
    );
  }
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin") || "*";

  // Rate limit: 10 requests per minute per IP (prevent spam)
  const rateLimit = await checkRateLimit(req, {
    keyPrefix: "form-submit",
    maxRequests: 10,
    windowMs: 60000, // 1 minute
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: rateLimit.retryAfter },
      { status: 429, headers: getRateLimitHeaders(rateLimit) }
    );
  }

  // Check content-length header first (quick reject)
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength) > MAX_PAYLOAD_SIZE) {
    return NextResponse.json(
      { error: "Payload too large" },
      { status: 413 }
    );
  }

  // Then read body with size limit
  let body;
  try {
    const text = await req.text();
    if (text.length > MAX_PAYLOAD_SIZE) {
      return NextResponse.json(
        { error: "Payload too large" },
        { status: 413 }
      );
    }
    body = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 }
    );
  }

  let formId = '';
  let submissionId = '';
  try {
    formId = body.formId;
    submissionId = body.submissionId;
    const { payload, files, timestamp, meta, spamProtection, abTest } = body;

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
    if (!form) {
      return errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, {
        message: "Form not found",
      });
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
        apiLogger.warn({ formId }, 'Honeypot triggered - spam detected');
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
        apiLogger.error({ formId }, 'reCAPTCHA enabled but no secret key configured');
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
        apiLogger.warn(
          { formId, reason: recaptchaValid.reason },
          'reCAPTCHA verification failed - spam detected'
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

    // A/B Testing: Check for active test and track metrics
    let activeTest: ABTest | null = null;
    let assignedVariantId: string | null = null;

    // Check if there's an active A/B test for this form
    activeTest = await getActiveABTest(formId);

    if (activeTest) {
      // Get user ID from abTest data (client should send this for consistency)
      const userId = abTest?.userId || submissionId; // Fallback to submissionId as anonymous ID

      // Get or assign variant
      const { variantId, isNewAssignment } = await getOrAssignVariant(
        activeTest,
        userId
      );

      assignedVariantId = variantId;

      if (variantId) {
        // Track impression if this is a new assignment
        if (isNewAssignment) {
          await updateABTestMetrics(activeTest, variantId, true, false);
        }

        // Track conversion (submission completed)
        await updateABTestMetrics(activeTest, variantId, false, true);

        apiLogger.info(
          {
            formId,
            testId: activeTest.id,
            variantId,
            isNewAssignment,
          },
          "A/B test metrics updated"
        );
      }
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
        // Include A/B test info if applicable
        ...(activeTest && assignedVariantId
          ? {
              abTest: {
                testId: activeTest.id,
                variantId: assignedVariantId,
              },
            }
          : {}),
      },
    };

    // Store submission
    await store.setJSON(submissionId, submission);

    // Store encrypted files if present
    if (files && typeof files === 'object') {
      for (const [fieldId, fieldFiles] of Object.entries(files)) {
        if (!Array.isArray(fieldFiles)) continue;

        // Find field configuration
        const field = form.fields?.find((f: { name: string }) => f.name === fieldId);
        const maxSizeMB = (field?.validation as { maxSize?: number })?.maxSize || FILE_STORAGE_CONFIG.DEFAULT_MAX_SIZE_MB;
        const allowedTypes = (field?.validation as { allowedTypes?: string[] })?.allowedTypes;

        // Validate and store each file
        for (let index = 0; index < fieldFiles.length; index++) {
          const fileMetadata = fieldFiles[index] as EncryptedFileMetadata;

          // Server-side validation
          const sizeValidation = validateFileSize(fileMetadata.size, maxSizeMB);
          if (!sizeValidation.valid) {
            apiLogger.warn(
              { formId, submissionId, fieldId, filename: fileMetadata.filename },
              'File size validation failed'
            );
            continue; // Skip invalid file
          }

          const typeValidation = validateFileType(fileMetadata.mimeType, allowedTypes);
          if (!typeValidation.valid) {
            apiLogger.warn(
              { formId, submissionId, fieldId, filename: fileMetadata.filename },
              'File type validation failed'
            );
            continue; // Skip invalid file
          }

          // Store encrypted file
          try {
            await storeEncryptedFile(submissionId, fieldId, fileMetadata, index);
          } catch (fileError) {
            apiLogger.error(
              { formId, submissionId, fieldId, filename: fileMetadata.filename, error: fileError },
              'Failed to store encrypted file'
            );
            // Continue with other files even if one fails
          }
        }
      }
    }

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
          apiLogger.error({ formId, submissionId, error: err.message }, 'Webhook delivery error');
        }
      );
    }

    // Fire Zapier webhook if configured (async, don't wait)
    if (form.settings?.zapier?.enabled && form.settings.zapier.webhookUrl) {
      const { sendZapierWebhook } = await import("@/lib/zapier");
      sendZapierWebhook(
        form.settings.zapier.webhookUrl,
        {
          id: form.id,
          name: form.name,
          fields: (form as { fields?: Array<{ type: string; name: string; label: string }> }).fields,
        },
        submission
      ).catch((err) => {
        apiLogger.error(
          { formId, submissionId, error: err.message || err },
          'Zapier webhook delivery error'
        );
      });
    }

    // Send email notifications (async, don't wait)
    handleEmailNotifications(
      form,
      submissionId,
      submission.timestamp,
      user?.email || null
    ).catch((err) => {
      // Error already logged in handleEmailNotifications
    });

    // CRM INTEGRATIONS: Sync to connected CRMs (async, don't wait)
    // NOTE: CRM integrations follow same pattern as Zapier - metadata only by default
    // Full data sync requires user's private key (see CRM_INTEGRATION_GUIDE.md)
    //
    // Uncomment this section when CRM sync library is ready:
    /*
    try {
      const { getFormIntegrations } = await import("@/lib/storage");
      const formIntegrations = await getFormIntegrations(formId);
      const enabledIntegrations = formIntegrations.filter(
        (fi) => fi.enabled && fi.syncOnSubmit
      );

      if (enabledIntegrations.length > 0) {
        const { syncToCRM } = await import("@/lib/crm-sync");

        for (const formInt of enabledIntegrations) {
          // Sync metadata only (secure mode, no private key needed)
          syncToCRM(formInt, submission.meta || {}).catch((err) => {
            apiLogger.error(
              { formId, submissionId, integrationId: formInt.id, error: err.message },
              "CRM sync error"
            );
          });
        }
      }
    } catch (err) {
      // CRM integration optional - don't fail submission
      apiLogger.warn({ formId, submissionId, error: err }, "CRM integration not available");
    }
    */

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
    apiLogger.error({ error, formId, submissionId }, 'Submission failed');
    return errorResponse(ErrorCodes.SERVER_ERROR, {
      message: "Submission failed",
    });
  }
}
