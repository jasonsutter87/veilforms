/**
 * VeilForms - Zapier Integration Utilities
 * Handles formatting submissions for Zapier webhooks
 */

import { apiLogger } from "./logger";

export interface ZapierPayload {
  form_id: string;
  form_name: string;
  submission_id: string;
  submitted_at: string;
  // Additional metadata fields
  [key: string]: string | number | boolean | null;
}

interface Submission {
  id: string;
  formId: string;
  timestamp: number;
  payload?: unknown;
  meta?: Record<string, unknown>;
}

interface Form {
  id: string;
  name: string;
  fields?: Array<{ type: string; name: string; label: string }>;
}

/**
 * Format submission data for Zapier
 *
 * IMPORTANT: Zapier receives metadata only by default (Option A).
 * This is because VeilForms uses client-side encryption and the server
 * doesn't have access to the private key to decrypt submissions.
 *
 * For decrypted data (Option B), the form owner would need to:
 * 1. Store their private key on the server (less secure)
 * 2. Allow server-side decryption for Zapier webhooks
 *
 * Current implementation: Metadata only (secure)
 */
export function formatForZapier(
  form: Form,
  submission: Submission,
  decryptedData?: Record<string, unknown>
): ZapierPayload {
  const payload: ZapierPayload = {
    form_id: form.id,
    form_name: form.name,
    submission_id: submission.id,
    submitted_at: new Date(submission.timestamp).toISOString(),
  };

  // Add metadata fields
  if (submission.meta) {
    Object.entries(submission.meta).forEach(([key, value]) => {
      // Prefix metadata fields to avoid conflicts
      const fieldKey = `meta_${key}`;
      payload[fieldKey] = convertValueForZapier(value);
    });
  }

  // If decrypted data is provided (Option B - less common)
  if (decryptedData) {
    Object.entries(decryptedData).forEach(([key, value]) => {
      // Prefix field names with "field_" for clarity
      const fieldKey = `field_${key}`;
      payload[fieldKey] = convertValueForZapier(value);
    });
  }

  // Add view URL for accessing full submission in dashboard
  const dashboardUrl = process.env.NEXT_PUBLIC_BASE_URL ||
                       process.env.NEXT_PUBLIC_SITE_URL ||
                       "https://veilforms.com";
  payload.submission_url = `${dashboardUrl}/dashboard/forms/${form.id}/submissions/${submission.id}`;

  return payload;
}

/**
 * Convert values to Zapier-friendly format
 * Zapier prefers strings, numbers, and booleans
 */
function convertValueForZapier(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.join(", ");
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

/**
 * Generate sample data for Zapier app setup
 * This helps users configure their Zaps by showing example field structure
 */
export function generateZapierSampleData(form: Form): ZapierPayload {
  const sampleSubmission: Submission = {
    id: "sub_sample_123abc",
    formId: form.id,
    timestamp: Date.now(),
    meta: {
      sdkVersion: "1.0.0",
      formVersion: "1",
      userAgent: "Mozilla/5.0 (Sample Browser)",
      region: "US",
    },
  };

  const sampleDecryptedData: Record<string, unknown> = {};

  // Generate sample field data based on form fields
  if (form.fields && form.fields.length > 0) {
    form.fields.forEach((field) => {
      sampleDecryptedData[field.name] = getSampleValueForFieldType(field.type);
    });
  } else {
    // Generic sample data if no fields defined
    sampleDecryptedData["email"] = "user@example.com";
    sampleDecryptedData["name"] = "John Doe";
    sampleDecryptedData["message"] = "This is a sample submission";
  }

  return formatForZapier(form, sampleSubmission, sampleDecryptedData);
}

/**
 * Get sample value based on field type
 */
function getSampleValueForFieldType(fieldType: string): string | number | boolean {
  const samples: Record<string, string | number | boolean> = {
    email: "user@example.com",
    text: "Sample text input",
    textarea: "This is a sample long-form text response",
    number: 42,
    tel: "+1-555-123-4567",
    url: "https://example.com",
    date: "2025-01-15",
    time: "14:30",
    checkbox: true,
    radio: "Option 1",
    select: "Selected Option",
    file: "https://example.com/files/sample.pdf",
  };

  return samples[fieldType] || "Sample value";
}

/**
 * Send webhook to Zapier
 * Similar to standard webhook but with Zapier-specific formatting
 */
export async function sendZapierWebhook(
  zapierUrl: string,
  form: Form,
  submission: Submission,
  decryptedData?: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  try {
    const payload = formatForZapier(form, submission, decryptedData);

    const response = await fetch(zapierUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "VeilForms-Zapier/1.0",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      apiLogger.error(
        {
          formId: form.id,
          submissionId: submission.id,
          status: response.status,
          error: errorText
        },
        'Zapier webhook failed'
      );

      return {
        success: false,
        error: `Zapier webhook returned ${response.status}: ${errorText}`,
      };
    }

    apiLogger.info(
      { formId: form.id, submissionId: submission.id },
      'Zapier webhook delivered successfully'
    );

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    apiLogger.error(
      { formId: form.id, submissionId: submission.id, error: errorMessage },
      'Zapier webhook error'
    );

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Validate Zapier webhook URL format
 */
export function isValidZapierUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    // Zapier webhook URLs typically use hooks.zapier.com domain
    // But we'll allow any HTTPS URL for flexibility
    if (parsed.protocol !== "https:") {
      return false;
    }

    // Check if it's a Zapier URL (optional - can be any webhook)
    const isZapierDomain = parsed.hostname.includes("zapier.com");

    return true;
  } catch {
    return false;
  }
}

/**
 * Get Zapier webhook status/info from URL
 */
export function getZapierWebhookInfo(url: string): {
  isZapierUrl: boolean;
  provider: string;
} {
  try {
    const parsed = new URL(url);
    const isZapierUrl = parsed.hostname.includes("zapier.com");

    return {
      isZapierUrl,
      provider: isZapierUrl ? "Zapier" : "Custom Webhook",
    };
  } catch {
    return {
      isZapierUrl: false,
      provider: "Unknown",
    };
  }
}
