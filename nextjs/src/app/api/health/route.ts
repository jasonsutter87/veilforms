/**
 * VeilForms - Health Check Endpoint
 * GET /api/health - Basic health check for monitoring
 */

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "veilforms",
    version: "1.0.0",
  });
}
