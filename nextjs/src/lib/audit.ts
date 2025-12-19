/**
 * VeilForms - Audit Logging Module
 * Records important actions for compliance and debugging
 */

import { getStore } from "@netlify/blobs";
import { NextRequest } from "next/server";

const AUDIT_STORE = "vf-audit-logs";

// Audit event types
export const AuditEvents = {
  // Form events
  FORM_CREATED: "form.created",
  FORM_UPDATED: "form.updated",
  FORM_DELETED: "form.deleted",
  FORM_KEYS_REGENERATED: "form.keys_regenerated",

  // Submission events
  SUBMISSION_RECEIVED: "submission.received",
  SUBMISSION_DELETED: "submission.deleted",
  SUBMISSIONS_BULK_DELETED: "submissions.bulk_deleted",

  // Auth events
  USER_REGISTERED: "user.registered",
  USER_LOGIN: "user.login",
  USER_LOGIN_FAILED: "user.login_failed",
  USER_PASSWORD_RESET: "user.password_reset",
  USER_EMAIL_VERIFIED: "user.email_verified",

  // API key events
  API_KEY_CREATED: "api_key.created",
  API_KEY_REVOKED: "api_key.revoked",
  API_KEY_USED: "api_key.used",

  // Settings events
  SETTINGS_UPDATED: "settings.updated",
  BRANDING_UPDATED: "branding.updated",
  RETENTION_UPDATED: "retention.updated",

  // Billing events
  BILLING_CHECKOUT_STARTED: "billing.checkout_started",
  BILLING_CHECKOUT_COMPLETED: "billing.checkout_completed",
  SUBSCRIPTION_CREATED: "subscription.created",
  SUBSCRIPTION_PLAN_CHANGED: "subscription.plan_changed",
  SUBSCRIPTION_CANCELED: "subscription.canceled",
  SUBSCRIPTION_REACTIVATED: "subscription.reactivated",
  PAYMENT_SUCCEEDED: "payment.succeeded",
  PAYMENT_FAILED: "payment.failed",

  // GDPR events
  USER_DATA_EXPORTED: "user.data_exported",
  USER_ACCOUNT_DELETED: "user.account_deleted",
  RETENTION_ENFORCED: "retention.enforced",

  // Team events
  TEAM_CREATED: "team.created",
  TEAM_UPDATED: "team.updated",
  TEAM_DELETED: "team.deleted",
  TEAM_MEMBER_INVITED: "team.member_invited",
  TEAM_MEMBER_JOINED: "team.member_joined",
  TEAM_MEMBER_REMOVED: "team.member_removed",
  TEAM_MEMBER_ROLE_CHANGED: "team.member_role_changed",

  // Domain events
  DOMAIN_ADDED: "domain.added",
  DOMAIN_VERIFIED: "domain.verified",
  DOMAIN_VERIFICATION_FAILED: "domain.verification_failed",
  DOMAIN_DELETED: "domain.deleted",
} as const;

export type AuditEventType = (typeof AuditEvents)[keyof typeof AuditEvents];

export interface AuditEntry {
  id: string;
  userId: string;
  event: string;
  details: Record<string, unknown>;
  meta: {
    ip: string;
    userAgent: string;
    region: string;
    origin?: string;
  };
  timestamp: string;
}

export interface AuditContext {
  ip: string;
  userAgent: string;
  region: string;
  origin?: string;
}

interface AuditIndexEntry {
  id: string;
  event: string;
  ts: string;
}

interface AuditLogsResult {
  logs: AuditEntry[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Create an audit log entry
 */
export async function logAudit(
  userId: string,
  event: string,
  details: Record<string, unknown> = {},
  meta: Partial<AuditContext> = {}
): Promise<AuditEntry> {
  const store = getStore({ name: AUDIT_STORE, consistency: "strong" });

  const entry: AuditEntry = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
    userId,
    event,
    details,
    meta: {
      ip: meta.ip || "unknown",
      userAgent: meta.userAgent?.substring(0, 200) || "unknown",
      region: meta.region || "unknown",
      origin: meta.origin,
    },
    timestamp: new Date().toISOString(),
  };

  // Store by ID
  await store.setJSON(entry.id, entry);

  // Update user's audit index
  const userIndexKey = `user_${userId}`;
  let userIndex: AuditIndexEntry[] = [];
  try {
    userIndex =
      (await store.get(userIndexKey, { type: "json" })) as AuditIndexEntry[] ||
      [];
  } catch {
    userIndex = [];
  }

  userIndex.unshift({
    id: entry.id,
    event,
    ts: entry.timestamp,
  });

  // Keep last 1000 entries per user
  if (userIndex.length > 1000) {
    userIndex = userIndex.slice(0, 1000);
  }

  await store.setJSON(userIndexKey, userIndex);

  return entry;
}

/**
 * Get audit logs for a user
 */
export async function getAuditLogs(
  userId: string,
  limit = 50,
  offset = 0,
  eventType: string | null = null
): Promise<AuditLogsResult> {
  const store = getStore({ name: AUDIT_STORE, consistency: "strong" });

  try {
    const userIndexKey = `user_${userId}`;
    let userIndex =
      ((await store.get(userIndexKey, { type: "json" })) as AuditIndexEntry[]) ||
      [];

    // Filter by event type if specified
    if (eventType) {
      userIndex = userIndex.filter(
        (e) => e.event === eventType || e.event.startsWith(eventType + ".")
      );
    }

    const total = userIndex.length;
    const slice = userIndex.slice(offset, offset + limit);

    // Fetch full entries
    const entries = await Promise.all(
      slice.map(async (item) => {
        try {
          return (await store.get(item.id, { type: "json" })) as AuditEntry | null;
        } catch {
          return null;
        }
      })
    );

    return {
      logs: entries.filter((e): e is AuditEntry => e !== null),
      total,
      limit,
      offset,
    };
  } catch {
    return { logs: [], total: 0, limit, offset };
  }
}

/**
 * Get audit logs for a specific form
 */
export async function getFormAuditLogs(
  userId: string,
  formId: string,
  limit = 100
): Promise<{ logs: AuditEntry[]; total: number }> {
  const { logs } = await getAuditLogs(userId, 1000, 0);

  const formLogs = logs.filter(
    (log) =>
      (log.details?.formId as string) === formId ||
      ((log.details?.form as Record<string, unknown>)?.id as string) === formId
  );

  return {
    logs: formLogs.slice(0, limit),
    total: formLogs.length,
  };
}

/**
 * Helper to create audit context from request
 */
export function getAuditContext(req: NextRequest): AuditContext {
  return {
    ip:
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown",
    userAgent: req.headers.get("user-agent") || "unknown",
    region: req.headers.get("x-vercel-ip-country") || "unknown",
    origin: req.headers.get("origin") || "unknown",
  };
}
