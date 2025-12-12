/**
 * VeilForms - Forms Management Endpoint
 * GET /api/forms - List user's forms
 * GET /api/forms/:id - Get single form
 * POST /api/forms - Create new form
 * PUT /api/forms/:id - Update form
 * DELETE /api/forms/:id - Soft delete form
 * GET /api/forms/:id/stats - Form statistics
 * POST /api/forms/:id/regenerate-keys - Regenerate encryption keys
 */

import { authenticateRequest } from './lib/auth.js';
import {
  createForm,
  getForm,
  updateForm,
  deleteForm,
  getUserForms,
  getSubmissions
} from './lib/storage.js';
import { checkRateLimit, getRateLimitHeaders } from './lib/rate-limit.js';
import { logAudit, AuditEvents, getAuditContext } from './lib/audit.js';

// CORS headers
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:1313', 'http://localhost:3000'];

function getCorsHeaders(origin) {
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };
}

// Generate RSA key pair for form encryption
async function generateKeyPair() {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256'
    },
    true,
    ['encrypt', 'decrypt']
  );

  const publicKey = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const privateKey = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

  return { publicKey, privateKey };
}

export default async function handler(req, context) {
  const origin = req.headers.get('origin') || '';
  const headers = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  // Rate limit
  const rateLimit = checkRateLimit(req, { keyPrefix: 'forms-api', maxRequests: 30 });
  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({
      error: 'Too many requests. Please try again later.',
      retryAfter: rateLimit.retryAfter
    }), {
      status: 429,
      headers: { ...headers, ...getRateLimitHeaders(rateLimit) }
    });
  }

  // Authenticate
  const auth = authenticateRequest(req);
  if (auth.error) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers
    });
  }

  // Parse URL to get formId and action
  const url = new URL(req.url);
  const pathParts = url.pathname.replace('/api/forms/', '').replace('/api/forms', '').split('/').filter(Boolean);
  const formId = pathParts[0];
  const action = pathParts[1]; // 'stats' or 'regenerate-keys'

  try {
    // Get audit context for logging
    const auditCtx = getAuditContext(req, context);

    // Handle list forms (GET /api/forms)
    if (req.method === 'GET' && !formId) {
      return handleListForms(auth.user.id, headers);
    }

    // Handle create form (POST /api/forms)
    if (req.method === 'POST' && !formId) {
      return handleCreateForm(req, auth.user.id, headers, auditCtx);
    }

    // Validate formId format for all other operations
    if (!formId || !/^vf_[a-z0-9_]+$/i.test(formId)) {
      return new Response(JSON.stringify({ error: 'Valid form ID required' }), {
        status: 400,
        headers
      });
    }

    // Get form and verify ownership
    const form = await getForm(formId);
    if (!form) {
      return new Response(JSON.stringify({ error: 'Form not found' }), {
        status: 404,
        headers
      });
    }

    if (form.userId !== auth.user.id) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403,
        headers
      });
    }

    // Route based on method and action
    if (req.method === 'GET' && action === 'stats') {
      return handleGetStats(formId, form, headers);
    }

    if (req.method === 'GET') {
      return handleGetForm(form, headers);
    }

    if (req.method === 'PUT') {
      return handleUpdateForm(req, formId, form, auth.user.id, headers, auditCtx);
    }

    if (req.method === 'DELETE') {
      return handleDeleteForm(formId, auth.user.id, headers, auditCtx);
    }

    if (req.method === 'POST' && action === 'regenerate-keys') {
      return handleRegenerateKeys(formId, auth.user.id, headers, auditCtx);
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers
    });
  } catch (err) {
    console.error('Forms error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers
    });
  }
}

/**
 * GET /api/forms - List user's forms
 */
async function handleListForms(userId, headers) {
  const forms = await getUserForms(userId);

  // Remove sensitive data
  const sanitizedForms = forms
    .filter(f => f.status !== 'deleted')
    .map(form => ({
      id: form.id,
      name: form.name,
      status: form.status || 'active',
      createdAt: form.createdAt,
      updatedAt: form.updatedAt,
      submissionCount: form.submissionCount || 0,
      lastSubmissionAt: form.lastSubmissionAt,
      settings: {
        encryption: form.settings?.encryption,
        piiStrip: form.settings?.piiStrip,
        allowedOrigins: form.settings?.allowedOrigins
      }
    }));

  return new Response(JSON.stringify({
    forms: sanitizedForms,
    total: sanitizedForms.length
  }), {
    status: 200,
    headers
  });
}

/**
 * POST /api/forms - Create new form
 */
async function handleCreateForm(req, userId, headers, auditCtx) {
  const body = await req.json();
  const { name, settings } = body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return new Response(JSON.stringify({ error: 'Form name is required' }), {
      status: 400,
      headers
    });
  }

  if (name.length > 100) {
    return new Response(JSON.stringify({ error: 'Form name must be 100 characters or less' }), {
      status: 400,
      headers
    });
  }

  // Generate encryption keys
  const { publicKey, privateKey } = await generateKeyPair();

  // Create form with all settings including branding and retention
  const form = await createForm(userId, {
    name: name.trim(),
    publicKey,
    settings: {
      encryption: true,
      piiStrip: settings?.piiStrip || false,
      webhookUrl: settings?.webhookUrl || null,
      webhookSecret: settings?.webhookSecret || null,
      allowedOrigins: settings?.allowedOrigins || ['*'],
      // Branding settings (Pro+ only)
      branding: {
        hideBranding: settings?.branding?.hideBranding || false,
        customColor: settings?.branding?.customColor || null,
        customLogo: settings?.branding?.customLogo || null
      },
      // Data retention settings (Team+ only)
      retention: {
        enabled: settings?.retention?.enabled || false,
        days: settings?.retention?.days || 90
      },
      ...settings
    }
  });

  // Log audit event
  await logAudit(userId, AuditEvents.FORM_CREATED, {
    formId: form.id,
    formName: form.name
  }, auditCtx);

  return new Response(JSON.stringify({
    form: {
      id: form.id,
      name: form.name,
      status: 'active',
      createdAt: form.createdAt,
      publicKey: form.publicKey,
      privateKey, // Only returned on creation!
      settings: form.settings
    },
    warning: 'Save your private key immediately! This is the only time it will be shown. We cannot recover it.'
  }), {
    status: 201,
    headers
  });
}

/**
 * GET /api/forms/:id - Get single form
 */
async function handleGetForm(form, headers) {
  return new Response(JSON.stringify({
    form: {
      id: form.id,
      name: form.name,
      status: form.status || 'active',
      createdAt: form.createdAt,
      updatedAt: form.updatedAt,
      submissionCount: form.submissionCount || 0,
      lastSubmissionAt: form.lastSubmissionAt,
      publicKey: form.publicKey,
      settings: form.settings
    }
  }), {
    status: 200,
    headers
  });
}

/**
 * PUT /api/forms/:id - Update form
 */
async function handleUpdateForm(req, formId, form, userId, headers, auditCtx) {
  const body = await req.json();
  const { name, status, settings } = body;

  const updates = {};
  const changes = [];

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid form name' }), {
        status: 400,
        headers
      });
    }
    if (name.length > 100) {
      return new Response(JSON.stringify({ error: 'Form name must be 100 characters or less' }), {
        status: 400,
        headers
      });
    }
    updates.name = name.trim();
    changes.push('name');
  }

  if (status !== undefined) {
    if (!['active', 'paused'].includes(status)) {
      return new Response(JSON.stringify({ error: 'Invalid status. Must be "active" or "paused"' }), {
        status: 400,
        headers
      });
    }
    updates.status = status;
    changes.push('status');
  }

  if (settings !== undefined) {
    updates.settings = {
      ...form.settings,
      ...settings
    };

    // Validate webhook URL if provided
    if (settings.webhookUrl && settings.webhookUrl !== '') {
      try {
        new URL(settings.webhookUrl);
      } catch {
        return new Response(JSON.stringify({ error: 'Invalid webhook URL' }), {
          status: 400,
          headers
        });
      }
    }

    // Validate allowed origins
    if (settings.allowedOrigins) {
      if (!Array.isArray(settings.allowedOrigins)) {
        return new Response(JSON.stringify({ error: 'allowedOrigins must be an array' }), {
          status: 400,
          headers
        });
      }
    }

    // Validate branding settings
    if (settings.branding) {
      if (settings.branding.customColor && !/^#[0-9A-Fa-f]{6}$/.test(settings.branding.customColor)) {
        return new Response(JSON.stringify({ error: 'Invalid branding color format (use #RRGGBB)' }), {
          status: 400,
          headers
        });
      }
      updates.settings.branding = {
        ...form.settings?.branding,
        ...settings.branding
      };
      changes.push('branding');
    }

    // Validate retention settings
    if (settings.retention) {
      if (settings.retention.days && (settings.retention.days < 1 || settings.retention.days > 365)) {
        return new Response(JSON.stringify({ error: 'Retention days must be between 1 and 365' }), {
          status: 400,
          headers
        });
      }
      updates.settings.retention = {
        ...form.settings?.retention,
        ...settings.retention
      };
      changes.push('retention');
    }

    changes.push('settings');
  }

  const updated = await updateForm(formId, updates);

  // Log audit event
  await logAudit(userId, AuditEvents.FORM_UPDATED, {
    formId,
    changes
  }, auditCtx);

  return new Response(JSON.stringify({
    form: {
      id: updated.id,
      name: updated.name,
      status: updated.status || 'active',
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      submissionCount: updated.submissionCount || 0,
      lastSubmissionAt: updated.lastSubmissionAt,
      publicKey: updated.publicKey,
      settings: updated.settings
    }
  }), {
    status: 200,
    headers
  });
}

/**
 * DELETE /api/forms/:id - Soft delete form
 */
async function handleDeleteForm(formId, userId, headers, auditCtx) {
  // Soft delete by marking status
  await updateForm(formId, {
    status: 'deleted',
    deletedAt: new Date().toISOString()
  });

  // Log audit event
  await logAudit(userId, AuditEvents.FORM_DELETED, {
    formId
  }, auditCtx);

  return new Response(JSON.stringify({
    success: true,
    deleted: formId
  }), {
    status: 200,
    headers
  });
}

/**
 * GET /api/forms/:id/stats - Form statistics
 */
async function handleGetStats(formId, form, headers) {
  // Get recent submissions for additional stats
  const result = await getSubmissions(formId, 500, 0);

  // Calculate stats
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;

  const last24h = result.submissions.filter(s => (s.timestamp || s.receivedAt) > oneDayAgo).length;
  const last7d = result.submissions.filter(s => (s.timestamp || s.receivedAt) > oneWeekAgo).length;
  const last30d = result.submissions.filter(s => (s.timestamp || s.receivedAt) > oneMonthAgo).length;

  // Calculate daily breakdown for last 7 days (for charts)
  const dailyBreakdown = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    dayStart.setDate(dayStart.getDate() - i);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const count = result.submissions.filter(s => {
      const ts = s.timestamp || s.receivedAt;
      return ts >= dayStart.getTime() && ts < dayEnd.getTime();
    }).length;

    dailyBreakdown.push({
      date: dayStart.toISOString().split('T')[0],
      count
    });
  }

  // Calculate region breakdown (if available)
  const regionCounts = {};
  result.submissions.forEach(s => {
    const region = s.meta?.region || 'unknown';
    regionCounts[region] = (regionCounts[region] || 0) + 1;
  });

  // Top 5 regions
  const topRegions = Object.entries(regionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([region, count]) => ({ region, count }));

  // SDK version breakdown
  const sdkVersionCounts = {};
  result.submissions.forEach(s => {
    const version = s.meta?.sdkVersion || s.meta?.version || 'unknown';
    sdkVersionCounts[version] = (sdkVersionCounts[version] || 0) + 1;
  });

  return new Response(JSON.stringify({
    formId,
    stats: {
      total: form.submissionCount || 0,
      last24h,
      last7d,
      last30d,
      lastSubmissionAt: form.lastSubmissionAt || null,
      createdAt: form.createdAt,
      // Advanced analytics
      dailyBreakdown,
      topRegions,
      sdkVersions: Object.entries(sdkVersionCounts).map(([version, count]) => ({ version, count }))
    }
  }), {
    status: 200,
    headers
  });
}

/**
 * POST /api/forms/:id/regenerate-keys - Regenerate encryption keys
 */
async function handleRegenerateKeys(formId, userId, headers, auditCtx) {
  // Generate new encryption keys
  const { publicKey, privateKey } = await generateKeyPair();

  // Update form with new public key
  const updated = await updateForm(formId, {
    publicKey,
    keyRotatedAt: new Date().toISOString()
  });

  // Log audit event (critical security action)
  await logAudit(userId, AuditEvents.FORM_KEYS_REGENERATED, {
    formId,
    keyRotatedAt: updated.keyRotatedAt
  }, auditCtx);

  return new Response(JSON.stringify({
    form: {
      id: updated.id,
      publicKey,
      privateKey, // Only returned on regeneration!
      keyRotatedAt: updated.keyRotatedAt
    },
    warning: 'Save your new private key immediately! Old submissions will no longer be decryptable with this key.'
  }), {
    status: 200,
    headers
  });
}

export const config = {
  path: '/api/forms/*'
};
