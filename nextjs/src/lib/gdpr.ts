/**
 * VeilForms - GDPR Compliance Module
 * Data export, deletion, and retention enforcement
 */

import {
  getUserById,
  getUser,
  getUserForms,
  getSubmissions,
  deleteSubmission,
  deleteForm,
  updateUser,
  Form,
  User,
  Submission,
} from "./storage";
import { getStore } from "@netlify/blobs";
import { logAudit, AuditEvents, getAuditLogs } from "./audit";
import { cancelSubscription } from "./stripe";
import { sendEmail } from "./email";

const API_KEYS_STORE = "vf-api-keys";

/**
 * Export all user data in JSON format
 * Required for GDPR Right to Portability (Article 20)
 */
export async function exportUserData(userId: string): Promise<{
  user: Partial<User>;
  forms: Array<{
    id: string;
    name: string;
    createdAt: string;
    updatedAt?: string;
    submissionCount: number;
    settings: Record<string, unknown>;
  }>;
  apiKeys: Array<{
    name: string;
    createdAt: string;
    lastUsed: string | null;
    permissions: string[];
  }>;
  auditLogs: Array<{
    event: string;
    timestamp: string;
    details: Record<string, unknown>;
  }>;
  subscription: {
    plan: string;
    status?: string;
    currentPeriodEnd?: string;
  };
  exportedAt: string;
}> {
  // Get user data
  const user = await getUserById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  // Get all forms (metadata only, not encrypted submissions)
  const forms = await getUserForms(userId);
  const formsExport = forms.map((form) => ({
    id: form.id,
    name: form.name,
    createdAt: form.createdAt,
    updatedAt: form.updatedAt,
    submissionCount: form.submissionCount || 0,
    settings: {
      encryption: form.settings.encryption,
      piiStrip: form.settings.piiStrip,
      allowedOrigins: form.settings.allowedOrigins,
      spamProtection: form.settings.spamProtection,
    },
  }));

  // Get API keys (names only, not secrets)
  const apiKeysStore = getStore({ name: API_KEYS_STORE, consistency: "strong" });
  const apiKeysExport: Array<{
    name: string;
    createdAt: string;
    lastUsed: string | null;
    permissions: string[];
  }> = [];

  try {
    const userApiKeysData = await apiKeysStore.get(`user_${userId}`, {
      type: "json",
    });
    if (userApiKeysData && typeof userApiKeysData === "object") {
      const apiKeys = userApiKeysData as Record<
        string,
        {
          name?: string;
          createdAt: string;
          lastUsed: string | null;
          permissions: string[];
        }
      >;
      for (const [keyId, keyData] of Object.entries(apiKeys)) {
        apiKeysExport.push({
          name: keyData.name || keyId.substring(0, 8),
          createdAt: keyData.createdAt,
          lastUsed: keyData.lastUsed,
          permissions: keyData.permissions || [],
        });
      }
    }
  } catch {
    // No API keys
  }

  // Get audit logs
  const { logs } = await getAuditLogs(userId, 1000, 0);
  const auditLogsExport = logs.map((log) => ({
    event: log.event,
    timestamp: log.timestamp,
    details: log.details,
  }));

  // Prepare user data (exclude sensitive fields)
  const userExport = {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    emailVerified: user.emailVerified,
    emailVerifiedAt: user.emailVerifiedAt,
    oauthProvider: user.oauthProvider,
  };

  // Subscription info
  const subscriptionExport = {
    plan: user.subscription || "free",
  };

  return {
    user: userExport,
    forms: formsExport,
    apiKeys: apiKeysExport,
    auditLogs: auditLogsExport,
    subscription: subscriptionExport,
    exportedAt: new Date().toISOString(),
  };
}

/**
 * Delete all user data permanently
 * Required for GDPR Right to Erasure (Article 17)
 */
export async function deleteUserData(
  userId: string,
  cancelStripeSubscription = true
): Promise<{
  deleted: {
    user: boolean;
    forms: number;
    submissions: number;
    apiKeys: number;
    auditLogs: number;
  };
}> {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  let deletedForms = 0;
  let deletedSubmissions = 0;

  // 1. Delete all forms and their submissions
  const forms = await getUserForms(userId);
  for (const form of forms) {
    // Delete all submissions for this form
    const submissionsResult = await getSubmissions(form.id);
    for (const submission of submissionsResult.submissions) {
      await deleteSubmission(form.id, submission.id);
      deletedSubmissions++;
    }

    // Delete the form
    await deleteForm(form.id, userId);
    deletedForms++;
  }

  // 2. Delete API keys
  const apiKeysStore = getStore({ name: API_KEYS_STORE, consistency: "strong" });
  let deletedApiKeys = 0;
  try {
    const userApiKeysData = await apiKeysStore.get(`user_${userId}`, {
      type: "json",
    });
    if (userApiKeysData) {
      const apiKeys = userApiKeysData as Record<string, unknown>;
      deletedApiKeys = Object.keys(apiKeys).length;
      await apiKeysStore.delete(`user_${userId}`);
    }
  } catch {
    // No API keys to delete
  }

  // 3. Cancel Stripe subscription if active
  if (cancelStripeSubscription) {
    const extUser = user as User & {
      stripeSubscriptionId?: string;
      stripeCustomerId?: string;
    };
    if (extUser.stripeSubscriptionId) {
      try {
        await cancelSubscription(extUser.stripeSubscriptionId, true);
      } catch (error) {
        console.error("Failed to cancel Stripe subscription:", error);
        // Continue with deletion even if Stripe cancellation fails
      }
    }
  }

  // 4. Delete audit logs
  const auditStore = getStore({ name: "vf-audit-logs", consistency: "strong" });
  let deletedAuditLogs = 0;
  try {
    const userIndexKey = `user_${userId}`;
    const userIndex = await auditStore.get(userIndexKey, { type: "json" });
    if (userIndex && Array.isArray(userIndex)) {
      deletedAuditLogs = userIndex.length;
      // Delete individual audit entries
      for (const entry of userIndex as Array<{ id: string }>) {
        try {
          await auditStore.delete(entry.id);
        } catch {
          // Continue if individual entry deletion fails
        }
      }
      // Delete the index
      await auditStore.delete(userIndexKey);
    }
  } catch {
    // No audit logs to delete
  }

  // 5. Delete user record
  const usersStore = getStore({ name: "vf-users", consistency: "strong" });
  await usersStore.delete(user.email.toLowerCase());
  await usersStore.delete(`id_${userId}`);

  return {
    deleted: {
      user: true,
      forms: deletedForms,
      submissions: deletedSubmissions,
      apiKeys: deletedApiKeys,
      auditLogs: deletedAuditLogs,
    },
  };
}

/**
 * Enforce retention policy for a specific form
 * Delete submissions older than the retention period
 */
export async function enforceFormRetention(form: Form): Promise<number> {
  const retentionDays = (form.settings.retentionDays as number) || 0;

  // If retention is 0, keep forever
  if (retentionDays === 0) {
    return 0;
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  const cutoffTimestamp = cutoffDate.toISOString();

  // Get all submissions for this form
  const submissionsResult = await getSubmissions(form.id);
  let deletedCount = 0;

  for (const submission of submissionsResult.submissions) {
    if (submission.createdAt < cutoffTimestamp) {
      await deleteSubmission(form.id, submission.id);
      deletedCount++;
    }
  }

  return deletedCount;
}

/**
 * Enforce retention policies across all forms
 * Run this as a cron job
 */
export async function enforceAllRetentionPolicies(): Promise<{
  formsProcessed: number;
  submissionsDeleted: number;
  errors: Array<{ formId: string; error: string }>;
}> {
  const formsStore = getStore({ name: "vf-forms", consistency: "strong" });

  let formsProcessed = 0;
  let submissionsDeleted = 0;
  const errors: Array<{ formId: string; error: string }> = [];

  try {
    // Get all forms
    const { blobs } = await formsStore.list();

    for (const blob of blobs) {
      // Skip non-form keys (like indices)
      if (blob.key.startsWith("user_") || blob.key.startsWith("id_")) {
        continue;
      }

      try {
        const form = (await formsStore.get(blob.key, { type: "json" })) as Form;
        if (!form || !form.id) continue;

        const deleted = await enforceFormRetention(form);
        if (deleted > 0) {
          formsProcessed++;
          submissionsDeleted += deleted;

          // Log the retention enforcement
          await logAudit(
            form.userId,
            "retention.enforced",
            {
              formId: form.id,
              formName: form.name,
              submissionsDeleted: deleted,
              retentionDays: form.settings.retentionDays,
            },
            {
              ip: "system",
              userAgent: "retention-cron",
              region: "system",
            }
          );
        }
      } catch (error) {
        errors.push({
          formId: blob.key,
          error: (error as Error).message,
        });
      }
    }
  } catch (error) {
    errors.push({
      formId: "all",
      error: `Failed to list forms: ${(error as Error).message}`,
    });
  }

  return {
    formsProcessed,
    submissionsDeleted,
    errors,
  };
}

/**
 * Send account deletion confirmation email
 */
export async function sendAccountDeletionEmail(
  email: string,
  name?: string
): Promise<void> {
  await sendEmail({
    to: email,
    subject: "VeilForms Account Deleted",
    text: `Hello${name ? " " + name : ""},

Your VeilForms account has been permanently deleted as requested.

All your data has been removed:
- User account
- All forms
- All submissions
- API keys
- Audit logs
- Subscription (if active)

If you did not request this deletion, please contact support immediately at support@veilforms.com.

Thank you for using VeilForms.

Best regards,
The VeilForms Team`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Account Deleted</h2>
        <p>Hello${name ? " " + name : ""},</p>
        <p>Your VeilForms account has been permanently deleted as requested.</p>
        <p><strong>All your data has been removed:</strong></p>
        <ul>
          <li>User account</li>
          <li>All forms</li>
          <li>All submissions</li>
          <li>API keys</li>
          <li>Audit logs</li>
          <li>Subscription (if active)</li>
        </ul>
        <p>If you did not request this deletion, please contact support immediately at <a href="mailto:support@veilforms.com">support@veilforms.com</a>.</p>
        <p>Thank you for using VeilForms.</p>
        <p>Best regards,<br>The VeilForms Team</p>
      </div>
    `,
  });
}
