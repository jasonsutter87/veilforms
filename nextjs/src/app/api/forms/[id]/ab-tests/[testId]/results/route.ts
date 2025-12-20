/**
 * VeilForms - A/B Test Results & Analytics
 * GET /api/forms/:id/ab-tests/:testId/results - Get test results with statistical analysis
 */

import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@netlify/blobs";
import { authRoute } from "@/lib/route-handler";
import { verifyFormOwnership } from "@/lib/form-helpers";
import { isValidFormId } from "@/lib/validation";
import { errorResponse, ErrorCodes } from "@/lib/errors";
import { createLogger } from "@/lib/logger";
import { analyzeTestResults, type ABTest } from "@/lib/ab-testing";

const abTestLogger = createLogger("ab-testing");

type RouteParams = { params: Promise<{ id: string; testId: string }> };

const STORE_NAME = "vf-ab-tests";

/**
 * Get blob store for A/B tests
 */
function getABTestStore() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

/**
 * Get a specific test
 */
async function getTest(testId: string): Promise<ABTest | null> {
  const store = getABTestStore();
  try {
    const test = await store.get(`test_${testId}`, { type: "json" });
    return test as ABTest | null;
  } catch (error) {
    abTestLogger.warn({ testId, error }, "Failed to load test");
    return null;
  }
}

/**
 * GET /api/forms/:id/ab-tests/:testId/results - Get test results with stats
 */
export const GET = authRoute<RouteParams>(
  async (req: NextRequest, { user }, routeCtx) => {
    const { id: formId, testId } = await routeCtx!.params;

    if (!isValidFormId(formId)) {
      return NextResponse.json(
        { error: "Valid form ID required" },
        { status: 400 }
      );
    }

    try {
      // Verify form ownership
      const { form, error } = await verifyFormOwnership(formId, user.userId);
      if (error) {
        return error;
      }

      // Get the test
      const test = await getTest(testId);
      if (!test) {
        return NextResponse.json({ error: "Test not found" }, { status: 404 });
      }

      // Verify test belongs to this form
      if (test.formId !== formId) {
        return NextResponse.json({ error: "Test not found" }, { status: 404 });
      }

      // Analyze test results
      const analysis = analyzeTestResults(test);

      // Calculate additional metrics
      const totalImpressions = test.variants.reduce(
        (sum, v) => sum + v.impressions,
        0
      );
      const totalConversions = test.variants.reduce(
        (sum, v) => sum + v.conversions,
        0
      );
      const overallConversionRate =
        totalImpressions > 0 ? totalConversions / totalImpressions : 0;

      // Calculate duration
      let durationMs: number | null = null;
      if (test.startedAt) {
        const endTime = test.endedAt || Date.now();
        durationMs = endTime - test.startedAt;
      }

      // Build response
      const results = {
        test: {
          id: test.id,
          name: test.name,
          description: test.description,
          status: test.status,
          createdAt: test.createdAt,
          startedAt: test.startedAt,
          endedAt: test.endedAt,
          durationMs,
          trafficAllocation: test.trafficAllocation,
        },
        summary: {
          totalImpressions,
          totalConversions,
          overallConversionRate,
          variantCount: test.variants.length,
        },
        analysis,
        // Include raw variant data for reference
        variants: test.variants.map((v) => ({
          id: v.id,
          name: v.name,
          description: v.description,
          weight: v.weight,
          impressions: v.impressions,
          conversions: v.conversions,
        })),
      };

      abTestLogger.debug(
        {
          formId,
          testId,
          totalImpressions,
          hasWinner: !!analysis.winner,
        },
        "Retrieved A/B test results"
      );

      return NextResponse.json(results);
    } catch (err) {
      abTestLogger.error(
        { formId, testId, error: err },
        "Failed to get A/B test results"
      );
      return errorResponse(ErrorCodes.SERVER_ERROR);
    }
  },
  { rateLimit: { keyPrefix: "ab-tests-api", maxRequests: 30 } }
);
