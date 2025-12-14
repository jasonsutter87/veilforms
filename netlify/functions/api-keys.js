/**
 * VeilForms - API Keys Management Endpoint
 * GET /api/api-keys - List user's API keys
 * POST /api/api-keys - Create new API key
 * DELETE /api/api-keys/:id - Revoke API key
 */

import { authenticateRequest } from './lib/auth.js';
import { getStore } from '@netlify/blobs';
import { checkRateLimit, getRateLimitHeaders } from './lib/rate-limit.js';
import { getCorsHeaders } from './lib/cors.js';
import * as response from './lib/responses.js';

// Generate a secure API key
function generateApiKey() {
  const prefix = 'vf_';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = prefix;
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  for (let i = 0; i < array.length; i++) {
    key += chars[array[i] % chars.length];
  }
  return key;
}

// Hash API key for storage (we don't store the raw key)
async function hashApiKey(key) {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default async function handler(req, context) {
  const origin = req.headers.get('origin') || '';
  const headers = getCorsHeaders(origin, {
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS']
  });

  if (req.method === 'OPTIONS') {
    return response.noContent(headers);
  }

  // Rate limit
  const rateLimit = await checkRateLimit(req, { keyPrefix: 'api-keys', maxRequests: 20 });
  if (!rateLimit.allowed) {
    return response.tooManyRequests(
      { ...headers, ...getRateLimitHeaders(rateLimit) },
      rateLimit.retryAfter
    );
  }

  // Authenticate
  const auth = await authenticateRequest(req);
  if (auth.error) {
    return response.error(auth.error, headers, auth.status);
  }

  const store = getStore({ name: 'vf-api-keys', consistency: 'strong' });

  // Parse URL to get key ID
  const url = new URL(req.url);
  const pathParts = url.pathname.replace('/api/api-keys/', '').replace('/api/api-keys', '').split('/').filter(Boolean);
  const keyId = pathParts[0];

  try {
    // GET /api/api-keys - List keys
    if (req.method === 'GET' && !keyId) {
      return handleListKeys(store, auth.user.id, headers);
    }

    // POST /api/api-keys - Create key
    if (req.method === 'POST' && !keyId) {
      return handleCreateKey(req, store, auth.user.id, headers);
    }

    // DELETE /api/api-keys/:id - Revoke key
    if (req.method === 'DELETE' && keyId) {
      return handleRevokeKey(store, auth.user.id, keyId, headers);
    }

    return response.methodNotAllowed(headers);
  } catch (err) {
    console.error('API Keys error:', err);
    return response.serverError(headers);
  }
}

/**
 * GET /api/api-keys - List user's API keys
 */
async function handleListKeys(store, userId, headers) {
  const userKeysKey = `user_keys_${userId}`;

  let keys = [];
  try {
    const keyIds = await store.get(userKeysKey, { type: 'json' }) || [];

    // Get details for each key
    keys = await Promise.all(keyIds.map(async (keyId) => {
      const keyData = await store.get(keyId, { type: 'json' });
      if (!keyData) return null;
      return {
        id: keyId,
        name: keyData.name,
        prefix: keyData.prefix,
        permissions: keyData.permissions,
        createdAt: keyData.createdAt,
        lastUsed: keyData.lastUsed
      };
    }));

    keys = keys.filter(k => k !== null);
  } catch (e) {
    keys = [];
  }

  return response.success({
    keys,
    total: keys.length
  }, headers);
}

/**
 * POST /api/api-keys - Create new API key
 */
async function handleCreateKey(req, store, userId, headers) {
  const body = await req.json();
  const { name, permissions } = body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return response.badRequest('Key name is required', headers);
  }

  if (name.length > 50) {
    return response.badRequest('Key name must be 50 characters or less', headers);
  }

  // Validate permissions
  const validPermissions = ['forms:read', 'forms:write', 'submissions:read', 'submissions:delete'];
  const keyPermissions = permissions || validPermissions;

  for (const perm of keyPermissions) {
    if (!validPermissions.includes(perm)) {
      return response.badRequest(`Invalid permission: ${perm}`, headers);
    }
  }

  // Check limit (max 5 keys per user on free plan)
  const userKeysKey = `user_keys_${userId}`;
  let existingKeys = [];
  try {
    existingKeys = await store.get(userKeysKey, { type: 'json' }) || [];
  } catch (e) {
    existingKeys = [];
  }

  if (existingKeys.length >= 5) {
    return response.badRequest(
      'Maximum number of API keys reached (5). Delete an existing key first.',
      headers
    );
  }

  // Generate key
  const rawKey = generateApiKey();
  const keyHash = await hashApiKey(rawKey);

  const keyData = {
    userId,
    name: name.trim(),
    prefix: rawKey.substring(0, 7) + '...',
    keyHash,
    permissions: keyPermissions,
    createdAt: new Date().toISOString(),
    lastUsed: null
  };

  // Store by hash
  await store.setJSON(keyHash, keyData);

  // Add to user's key list
  existingKeys.push(keyHash);
  await store.setJSON(userKeysKey, existingKeys);

  return response.created({
    key: {
      id: keyHash,
      name: keyData.name,
      key: rawKey, // Only returned once!
      permissions: keyData.permissions,
      createdAt: keyData.createdAt
    },
    warning: 'Save this API key now! This is the only time it will be shown. We cannot recover it.'
  }, headers);
}

/**
 * DELETE /api/api-keys/:id - Revoke API key
 */
async function handleRevokeKey(store, userId, keyId, headers) {
  // Verify key belongs to user
  const keyData = await store.get(keyId, { type: 'json' });

  if (!keyData) {
    return response.notFound('API key not found', headers);
  }

  if (keyData.userId !== userId) {
    return response.forbidden('Access denied', headers);
  }

  // Delete the key
  await store.delete(keyId);

  // Remove from user's key list
  const userKeysKey = `user_keys_${userId}`;
  let userKeys = [];
  try {
    userKeys = await store.get(userKeysKey, { type: 'json' }) || [];
  } catch (e) {
    userKeys = [];
  }
  userKeys = userKeys.filter(k => k !== keyId);
  await store.setJSON(userKeysKey, userKeys);

  return response.success({
    success: true,
    revoked: keyId
  }, headers);
}

export const config = {
  path: '/api/api-keys/*'
};
