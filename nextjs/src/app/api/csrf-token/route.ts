/**
 * VeilForms - CSRF Token Endpoint
 * GET /api/csrf-token - Get CSRF token for authenticated requests
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { generateCsrfToken, getCsrfHeaders } from "@/lib/csrf";
import { unauthorized } from "@/lib/responses";

export async function GET(req: NextRequest) {
  // Authenticate - only authenticated users can get CSRF tokens
  const auth = await authenticateRequest(req);
  if (auth.error) {
    return unauthorized(auth.error);
  }

  // Generate new CSRF token
  const token = generateCsrfToken();
  const csrfHeaders = getCsrfHeaders(token);

  return NextResponse.json(
    {
      csrfToken: token,
      expiresIn: 3600, // 1 hour in seconds
    },
    {
      headers: csrfHeaders,
    }
  );
}
