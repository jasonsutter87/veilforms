/**
 * VeilForms - Audit Logging Module
 * Records important actions for compliance and debugging
 */

import { getStore } from '@netlify/blobs';

const AUDIT_STORE = 'vf-audit-logs';

// Audit event types
export const AuditEvents = {
  // Form events
  FORM_CREATED: 'form.created',
  FORM_UPDATED: 'form.updated',
  FORM_DELETED: 'form.deleted',
  FORM_KEYS_REGENERATED: 'form.keys_regenerated',

  // Submission events
  SUBMISSION_RECEIVED: 'submission.received',
  SUBMISSION_DELETED: 'submission.deleted',
  SUBMISSIONS_BULK_DELETED: 'submissions.bulk_deleted',

  // Auth events
  USER_REGISTERED: 'user.registered',
  USER_LOGIN: 'user.login',
  USER_LOGIN_FAILED: 'user.login_failed',
  USER_PASSWORD_RESET: 'user.password_reset',
  USER_EMAIL_VERIFIED: 'user.email_verified',

  // API key events
  API_KEY_CREATED: 'api_key.created',
  API_KEY_REVOKED: 'api_key.revoked',
  API_KEY_USED: 'api_key.used',

  // Settings events
  SETTINGS_UPDATED: 'settings.updated',
  BRANDING_UPDATED: 'branding.updated',
  RETENTION_UPDATED: 'retention.updated'
};

/**
 * Create an audit log entry
 * @param {string} userId - User who performed the action
 * @param {string} event - Event type from AuditEvents
 * @param {object} details - Additional details about the event
 * @param {object} meta - Request metadata (IP, user agent, etc)
 */
export async function logAudit(userId, event, details = {}, meta = {}) {
  const store = getStore({ name: AUDIT_STORE, consistency: 'strong' });

  const entry = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
    userId,
    event,
    details,
    meta: {
      ip: meta.ip || 'unknown',
      userAgent: meta.userAgent?.substring(0, 200) || 'unknown',
      region: meta.region || 'unknown',
      ...meta
    },
    timestamp: new Date().toISOString()
  };

  // Store by ID
  await store.setJSON(entry.id, entry);

  // Update user's audit index
  const userIndexKey = `user_${userId}`;
  let userIndex = [];
  try {
    userIndex = await store.get(userIndexKey, { type: 'json' }) || [];
  } catch (e) {
    userIndex = [];
  }

  userIndex.unshift({
    id: entry.id,
    event,
    ts: entry.timestamp
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
 * @param {string} userId - User ID
 * @param {number} limit - Max entries to return
 * @param {number} offset - Starting position
 * @param {string} eventType - Optional filter by event type
 */
export async function getAuditLogs(userId, limit = 50, offset = 0, eventType = null) {
  const store = getStore({ name: AUDIT_STORE, consistency: 'strong' });

  try {
    const userIndexKey = `user_${userId}`;
    let userIndex = await store.get(userIndexKey, { type: 'json' }) || [];

    // Filter by event type if specified
    if (eventType) {
      userIndex = userIndex.filter(e => e.event === eventType || e.event.startsWith(eventType + '.'));
    }

    const total = userIndex.length;
    const slice = userIndex.slice(offset, offset + limit);

    // Fetch full entries
    const entries = await Promise.all(
      slice.map(async (item) => {
        try {
          return await store.get(item.id, { type: 'json' });
        } catch (e) {
          return null;
        }
      })
    );

    return {
      logs: entries.filter(e => e !== null),
      total,
      limit,
      offset
    };
  } catch (e) {
    return { logs: [], total: 0, limit, offset };
  }
}

/**
 * Get audit logs for a specific form
 * @param {string} userId - User ID (for authorization)
 * @param {string} formId - Form ID
 * @param {number} limit - Max entries to return
 */
export async function getFormAuditLogs(userId, formId, limit = 100) {
  const { logs } = await getAuditLogs(userId, 1000, 0);

  const formLogs = logs.filter(log =>
    log.details?.formId === formId ||
    log.details?.form?.id === formId
  );

  return {
    logs: formLogs.slice(0, limit),
    total: formLogs.length
  };
}

/**
 * Helper to create audit context from request
 */
export function getAuditContext(req, context = {}) {
  return {
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown',
    userAgent: req.headers.get('user-agent') || 'unknown',
    region: context.geo?.country || 'unknown',
    origin: req.headers.get('origin') || 'unknown'
  };
}
