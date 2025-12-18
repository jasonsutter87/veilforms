/**
 * VeilForms - API Keys Management Endpoint
 * GET /api/api-keys - List user's API keys
 * POST /api/api-keys - Create new API key
 */

import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@netlify/blobs";
import { authRoute } from "@/lib/route-handler";
import { errorResponse, ErrorCodes } from "@/lib/errors";

const API_KEYS_STORE = "vf-api-keys";

interface ApiKeyData {
  userId: string;
  name: string;
  prefix: string;
  keyHash: string;
  permissions: string[];
  createdAt: string;
  lastUsed: string | null;
}

// Generate a secure API key
function generateApiKey(): string {
  const prefix = "vf_";
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let key = prefix;
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  for (let i = 0; i < array.length; i++) {
    key += chars[array[i] % chars.length];
  }
  return key;
}

// Hash API key for storage (we don't store the raw key)
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const GET = authRoute(async (req, { user }) => {
  const store = getStore({ name: API_KEYS_STORE, consistency: "strong" });
  const userKeysKey = `user_keys_${user.userId}`;

  try {
    let keys: Array<{
      id: string;
      name: string;
      prefix: string;
      permissions: string[];
      createdAt: string;
      lastUsed: string | null;
    }> = [];

    const keyIds =
      ((await store.get(userKeysKey, { type: "json" })) as string[] | null) || [];

    // Get details for each key
    const keyPromises = keyIds.map(async (keyId) => {
      const keyData = (await store.get(keyId, { type: "json" })) as ApiKeyData | null;
      if (!keyData) return null;
      return {
        id: keyId,
        name: keyData.name,
        prefix: keyData.prefix,
        permissions: keyData.permissions,
        createdAt: keyData.createdAt,
        lastUsed: keyData.lastUsed,
      };
    });

    const results = await Promise.all(keyPromises);
    keys = results.filter(
      (k): k is NonNullable<typeof k> => k !== null
    );

    return NextResponse.json({
      keys,
      total: keys.length,
    });
  } catch (err) {
    console.error("List API keys error:", err);
    return errorResponse(ErrorCodes.SERVER_ERROR);
  }
}, { rateLimit: { keyPrefix: "api-keys", maxRequests: 20 } });

export const POST = authRoute(async (req, { user }) => {
  const store = getStore({ name: API_KEYS_STORE, consistency: "strong" });

  try {
    const body = await req.json();
    const { name, permissions } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Key name is required" },
        { status: 400 }
      );
    }

    if (name.length > 50) {
      return NextResponse.json(
        { error: "Key name must be 50 characters or less" },
        { status: 400 }
      );
    }

    // Validate permissions
    const validPermissions = [
      "forms:read",
      "forms:write",
      "submissions:read",
      "submissions:delete",
    ];
    const keyPermissions = permissions || validPermissions;

    for (const perm of keyPermissions) {
      if (!validPermissions.includes(perm)) {
        return NextResponse.json(
          { error: `Invalid permission: ${perm}` },
          { status: 400 }
        );
      }
    }

    // Check limit (max 5 keys per user on free plan)
    const userKeysKey = `user_keys_${user.userId}`;
    let existingKeys: string[] = [];
    try {
      existingKeys =
        ((await store.get(userKeysKey, { type: "json" })) as string[] | null) ||
        [];
    } catch {
      existingKeys = [];
    }

    if (existingKeys.length >= 5) {
      return NextResponse.json(
        {
          error:
            "Maximum number of API keys reached (5). Delete an existing key first.",
        },
        { status: 400 }
      );
    }

    // Generate key
    const rawKey = generateApiKey();
    const keyHash = await hashApiKey(rawKey);

    const keyData: ApiKeyData = {
      userId: user.userId,
      name: name.trim(),
      prefix: rawKey.substring(0, 7) + "...",
      keyHash,
      permissions: keyPermissions,
      createdAt: new Date().toISOString(),
      lastUsed: null,
    };

    // Store by hash
    await store.setJSON(keyHash, keyData);

    // Add to user's key list
    existingKeys.push(keyHash);
    await store.setJSON(userKeysKey, existingKeys);

    return NextResponse.json(
      {
        key: {
          id: keyHash,
          name: keyData.name,
          key: rawKey, // Only returned once!
          permissions: keyData.permissions,
          createdAt: keyData.createdAt,
        },
        warning:
          "Save this API key now! This is the only time it will be shown. We cannot recover it.",
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Create API key error:", err);
    return errorResponse(ErrorCodes.SERVER_ERROR);
  }
}, { rateLimit: { keyPrefix: "api-keys", maxRequests: 20 } });
