/**
 * VeilForms - Zapier Authentication & Integration Endpoints
 * For future official Zapier app integration
 *
 * These endpoints will be used by Zapier's platform to:
 * 1. Validate API keys
 * 2. List available forms
 * 3. Subscribe to webhook triggers
 *
 * For now, users can manually configure webhooks in their form settings.
 * This provides the foundation for a future Zapier App Directory listing.
 */

import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@netlify/blobs";
import { getUserForms } from "@/lib/storage";
import { errorResponse, ErrorCodes } from "@/lib/errors";

const API_KEYS_STORE = "vf-api-keys";

interface ApiKeyData {
  userId: string;
  name: string;
  keyHash: string;
  permissions: string[];
  createdAt: string;
  lastUsed: string | null;
}

/**
 * Hash API key for lookup
 */
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Validate API key from Authorization header
 */
async function validateApiKey(
  req: NextRequest
): Promise<{ valid: boolean; userId?: string; error?: string }> {
  const authHeader = req.headers.get("authorization");

  if (!authHeader) {
    return { valid: false, error: "Missing Authorization header" };
  }

  // Support both "Bearer <key>" and direct key
  const apiKey = authHeader.startsWith("Bearer ")
    ? authHeader.substring(7)
    : authHeader;

  if (!apiKey.startsWith("vf_")) {
    return { valid: false, error: "Invalid API key format" };
  }

  try {
    const keyHash = await hashApiKey(apiKey);
    const store = getStore({ name: API_KEYS_STORE, consistency: "strong" });
    const keyData = (await store.get(keyHash, { type: "json" })) as ApiKeyData | null;

    if (!keyData) {
      return { valid: false, error: "Invalid API key" };
    }

    // Update last used timestamp (fire and forget)
    store.setJSON(keyHash, {
      ...keyData,
      lastUsed: new Date().toISOString(),
    }).catch(() => {
      // Ignore errors - this is not critical
    });

    return { valid: true, userId: keyData.userId };
  } catch (error) {
    return { valid: false, error: "API key validation failed" };
  }
}

/**
 * POST /api/zapier/auth
 * Test API key authentication
 * This endpoint is called by Zapier to verify the user's API key
 */
export async function POST(req: NextRequest) {
  const validation = await validateApiKey(req);

  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error },
      { status: 401 }
    );
  }

  return NextResponse.json({
    authenticated: true,
    userId: validation.userId,
  });
}

/**
 * GET /api/zapier/auth
 * Get list of forms for authenticated user (for Zapier form dropdown)
 * Zapier uses this to populate form selection dropdown when setting up a Zap
 */
export async function GET(req: NextRequest) {
  const validation = await validateApiKey(req);

  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error },
      { status: 401 }
    );
  }

  try {
    const forms = await getUserForms(validation.userId!);

    // Format forms for Zapier dropdown
    const formChoices = forms
      .filter((form) => {
        // Only include active forms (not deleted or paused)
        const status = (form as { status?: string }).status;
        return !status || status === "active";
      })
      .map((form) => ({
        id: form.id,
        name: form.name,
        // Zapier expects 'sample' key for sample data
        sample: {
          id: form.id,
          name: form.name,
          submissionCount: form.submissionCount || 0,
        },
      }));

    return NextResponse.json({
      forms: formChoices,
    });
  } catch (error) {
    console.error("Get forms for Zapier error:", error);
    return errorResponse(ErrorCodes.SERVER_ERROR);
  }
}
