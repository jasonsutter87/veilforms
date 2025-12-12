/**
 * VeilForms - API Keys Management Endpoint
 * GET /api/api-keys - List user's API keys
 * POST /api/api-keys - Create new API key
 * DELETE /api/api-keys/:id - Revoke API key
 */

import { authenticateRequest } from './lib/auth.js';
import { getStore } from '@netlify/blobs';
import { checkRateLimit, getRateLimitHeaders } from './lib/rate-limit.js';

// CORS headers
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:1313', 'http://localhost:3000'];

function getCorsHeaders(origin) {
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };
}

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
  const headers = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  // Rate limit
  const rateLimit = checkRateLimit(req, { keyPrefix: 'api-keys', maxRequests: 20 });
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

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers
    });
  } catch (err) {
    console.error('API Keys error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers
    });
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

  return new Response(JSON.stringify({
    keys,
    total: keys.length
  }), {
    status: 200,
    headers
  });
}

/**
 * POST /api/api-keys - Create new API key
 */
async function handleCreateKey(req, store, userId, headers) {
  const body = await req.json();
  const { name, permissions } = body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return new Response(JSON.stringify({ error: 'Key name is required' }), {
      status: 400,
      headers
    });
  }

  if (name.length > 50) {
    return new Response(JSON.stringify({ error: 'Key name must be 50 characters or less' }), {
      status: 400,
      headers
    });
  }

  // Validate permissions
  const validPermissions = ['forms:read', 'forms:write', 'submissions:read', 'submissions:delete'];
  const keyPermissions = permissions || validPermissions;

  for (const perm of keyPermissions) {
    if (!validPermissions.includes(perm)) {
      return new Response(JSON.stringify({ error: `Invalid permission: ${perm}` }), {
        status: 400,
        headers
      });
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
    return new Response(JSON.stringify({
      error: 'Maximum number of API keys reached (5). Delete an existing key first.'
    }), {
      status: 400,
      headers
    });
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

  return new Response(JSON.stringify({
    key: {
      id: keyHash,
      name: keyData.name,
      key: rawKey, // Only returned once!
      permissions: keyData.permissions,
      createdAt: keyData.createdAt
    },
    warning: 'Save this API key now! This is the only time it will be shown. We cannot recover it.'
  }), {
    status: 201,
    headers
  });
}

/**
 * DELETE /api/api-keys/:id - Revoke API key
 */
async function handleRevokeKey(store, userId, keyId, headers) {
  // Verify key belongs to user
  const keyData = await store.get(keyId, { type: 'json' });

  if (!keyData) {
    return new Response(JSON.stringify({ error: 'API key not found' }), {
      status: 404,
      headers
    });
  }

  if (keyData.userId !== userId) {
    return new Response(JSON.stringify({ error: 'Access denied' }), {
      status: 403,
      headers
    });
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

  return new Response(JSON.stringify({
    success: true,
    revoked: keyId
  }), {
    status: 200,
    headers
  });
}

export const config = {
  path: '/api/api-keys/*'
};
