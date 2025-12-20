/**
 * VeilForms - A/B Tests Management
 * GET /api/forms/:id/ab-tests - List all A/B tests for a form
 * POST /api/forms/:id/ab-tests - Create a new A/B test
 */

import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@netlify/blobs";
import { authRoute } from "@/lib/route-handler";
import { verifyFormOwnership } from "@/lib/form-helpers";
import { isValidFormId } from "@/lib/validation";
import { errorResponse, ErrorCodes } from "@/lib/errors";
import { createLogger } from "@/lib/logger";
import {
  generateTestId,
  generateVariantId,
  validateABTest,
  type ABTest,
  type Variant,
} from "@/lib/ab-testing";

const abTestLogger = createLogger("ab-testing");

type RouteParams = { params: Promise<{ id: string }> };

const STORE_NAME = "vf-ab-tests";

/**
 * Get blob store for A/B tests
 */
function getABTestStore() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

/**
 * Get all tests for a form
 */
async function getFormTests(formId: string): Promise<ABTest[]> {
  const store = getABTestStore();
  const indexKey = `form_tests_${formId}`;

  try {
    const testIds =
      ((await store.get(indexKey, { type: "json" })) as string[] | null) || [];
    const tests = await Promise.all(
      testIds.map(async (testId) => {
        const test = await store.get(`test_${testId}`, { type: "json" });
        return test as ABTest | null;
      })
    );
    return tests.filter((t): t is ABTest => t !== null);
  } catch (error) {
    abTestLogger.warn({ formId, error }, "Failed to load form tests");
    return [];
  }
}

/**
 * Add test ID to form's test index
 */
async function addTestToFormIndex(formId: string, testId: string): Promise<void> {
  const store = getABTestStore();
  const indexKey = `form_tests_${formId}`;

  try {
    const testIds =
      ((await store.get(indexKey, { type: "json" })) as string[] | null) || [];
    if (!testIds.includes(testId)) {
      testIds.push(testId);
      await store.setJSON(indexKey, testIds);
    }
  } catch (error) {
    abTestLogger.error({ formId, testId, error }, "Failed to update form test index");
  }
}

/**
 * GET /api/forms/:id/ab-tests - List all A/B tests
 */
export const GET = authRoute<RouteParams>(
  async (req: NextRequest, { user }, routeCtx) => {
    const { id: formId } = await routeCtx!.params;

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

      // Get all tests for this form
      const tests = await getFormTests(formId);

      abTestLogger.debug({ formId, count: tests.length }, "Listed A/B tests");

      return NextResponse.json({
        tests,
        total: tests.length,
      });
    } catch (err) {
      abTestLogger.error({ formId, error: err }, "Failed to list A/B tests");
      return errorResponse(ErrorCodes.SERVER_ERROR);
    }
  },
  { rateLimit: { keyPrefix: "ab-tests-api", maxRequests: 30 } }
);

/**
 * POST /api/forms/:id/ab-tests - Create a new A/B test
 */
export const POST = authRoute<RouteParams>(
  async (req: NextRequest, { user }, routeCtx) => {
    const { id: formId } = await routeCtx!.params;

    if (!isValidFormId(formId)) {
      return NextResponse.json(
        { error: "Valid form ID required" },
        { status: 400 }
      );
    }

    try {
      // Verify form ownership with edit permission
      const { form, error } = await verifyFormOwnership(
        formId,
        user.userId,
        "forms:edit"
      );
      if (error) {
        return error;
      }

      const body = await req.json();
      const { name, description, variants, metrics, trafficAllocation } = body;

      // Validate required fields
      if (!name || !variants || !Array.isArray(variants)) {
        return NextResponse.json(
          { error: "name and variants are required" },
          { status: 400 }
        );
      }

      // Generate IDs for test and variants
      const testId = generateTestId();
      const processedVariants: Variant[] = variants.map((v: Partial<Variant>) => ({
        id: v.id || generateVariantId(),
        name: v.name || "Untitled Variant",
        description: v.description,
        weight: v.weight || 0,
        formSnapshot: v.formSnapshot || { fields: form.fields, settings: form.settings },
        impressions: 0,
        conversions: 0,
      }));

      // Build test object
      const test: ABTest = {
        id: testId,
        formId,
        name,
        description,
        status: "draft",
        variants: processedVariants,
        metrics: metrics || ["conversion"],
        trafficAllocation: trafficAllocation ?? 100,
        createdAt: Date.now(),
        createdBy: user.userId,
      };

      // Validate test configuration
      const validation = validateABTest(test);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }

      // Store test
      const store = getABTestStore();
      await store.setJSON(`test_${testId}`, test);

      // Add to form's test index
      await addTestToFormIndex(formId, testId);

      abTestLogger.info(
        { formId, testId, variantCount: test.variants.length },
        "Created A/B test"
      );

      return NextResponse.json({ test }, { status: 201 });
    } catch (err) {
      abTestLogger.error({ formId, error: err }, "Failed to create A/B test");
      return errorResponse(ErrorCodes.SERVER_ERROR);
    }
  },
  { rateLimit: { keyPrefix: "ab-tests-api", maxRequests: 30 }, csrf: true }
);
