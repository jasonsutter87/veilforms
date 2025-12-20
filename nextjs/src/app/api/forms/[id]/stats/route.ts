/**
 * VeilForms - Form Statistics Endpoint
 * GET /api/forms/:id/stats - Get form statistics
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { getForm, getSubmissions } from "@/lib/storage";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";
import { isValidFormId } from "@/lib/validation";
import { errorResponse, ErrorCodes } from "@/lib/errors";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id: formId } = await params;

  // Rate limit
  const rateLimit = await checkRateLimit(req, {
    keyPrefix: "forms-api",
    maxRequests: 30,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: rateLimit.retryAfter },
      { status: 429, headers: getRateLimitHeaders(rateLimit) }
    );
  }

  // Authenticate
  const auth = await authenticateRequest(req);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // Validate formId format
  if (!isValidFormId(formId)) {
    return NextResponse.json(
      { error: "Valid form ID required" },
      { status: 400 }
    );
  }

  try {
    // Get form and verify ownership
    const form = await getForm(formId);
    if (!form) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }

    if (form.userId !== auth.user!.userId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Get recent submissions for additional stats
    const result = await getSubmissions(formId, 500, 0);

    // Pre-calculate time boundaries
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;

    // Pre-calculate day boundaries for daily breakdown
    const dayBoundaries: Array<{ start: number; end: number; date: string }> =
      [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      dayStart.setDate(dayStart.getDate() - i);
      dayBoundaries.push({
        start: dayStart.getTime(),
        end: dayStart.getTime() + 24 * 60 * 60 * 1000,
        date: dayStart.toISOString().slice(0, 10),
      });
    }

    // Single pass through submissions - O(n)
    let last24h = 0;
    let last7d = 0;
    let last30d = 0;
    const dailyCounts = new Array(7).fill(0);
    const regionCounts: Record<string, number> = {};
    const sdkVersionCounts: Record<string, number> = {};

    for (const submission of result.submissions) {
      const sub = submission as {
        createdAt?: string;
        timestamp?: number;
        receivedAt?: number;
        metadata?: { region?: string; sdkVersion?: string; version?: string };
        meta?: { region?: string; sdkVersion?: string; version?: string };
      };
      const ts = sub.timestamp || sub.receivedAt || new Date(sub.createdAt || 0).getTime();

      // Time-based counts
      if (ts > oneDayAgo) last24h++;
      if (ts > oneWeekAgo) last7d++;
      if (ts > oneMonthAgo) last30d++;

      // Daily breakdown - find which day bucket
      for (let i = 0; i < dayBoundaries.length; i++) {
        const boundary = dayBoundaries[i];
        if (boundary && ts >= boundary.start && ts < boundary.end) {
          dailyCounts[i]++;
          break;
        }
      }

      // Region counts
      const region = sub.meta?.region || sub.metadata?.region || "unknown";
      regionCounts[region] = (regionCounts[region] || 0) + 1;

      // SDK version counts
      const version =
        sub.meta?.sdkVersion ||
        sub.meta?.version ||
        sub.metadata?.sdkVersion ||
        "unknown";
      sdkVersionCounts[version] = (sdkVersionCounts[version] || 0) + 1;
    }

    // Build daily breakdown array
    const dailyBreakdown = dayBoundaries.map((day, i) => ({
      date: day.date,
      count: dailyCounts[i],
    }));

    // Top 5 regions
    const topRegions = Object.entries(regionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([region, count]) => ({ region, count }));

    return NextResponse.json({
      formId,
      stats: {
        total: form.submissionCount || 0,
        last24h,
        last7d,
        last30d,
        lastSubmissionAt:
          (form as { lastSubmissionAt?: string }).lastSubmissionAt || null,
        createdAt: form.createdAt,
        // Advanced analytics
        dailyBreakdown,
        topRegions,
        sdkVersions: Object.entries(sdkVersionCounts).map(
          ([version, count]) => ({
            version,
            count,
          })
        ),
      },
    });
  } catch (err) {
    console.error("Form stats error:", err);
    return errorResponse(ErrorCodes.SERVER_ERROR);
  }
}
