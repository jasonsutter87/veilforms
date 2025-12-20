/**
 * VeilForms - Single A/B Test Management
 * GET /api/forms/:id/ab-tests/:testId - Get a specific A/B test
 * PATCH /api/forms/:id/ab-tests/:testId - Update a test (status, variants, etc.)
 * DELETE /api/forms/:id/ab-tests/:testId - Delete a test
 */

import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@netlify/blobs";
import { authRoute } from "@/lib/route-handler";
import { verifyFormOwnership } from "@/lib/form-helpers";
import { isValidFormId } from "@/lib/validation";
import { errorResponse, ErrorCodes } from "@/lib/errors";
import { createLogger } from "@/lib/logger";
import { validateABTest, type ABTest } from "@/lib/ab-testing";

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
 * Update a test
 */
async function updateTest(testId: string, updates: Partial<ABTest>): Promise<ABTest | null> {
  const store = getABTestStore();
  const test = await getTest(testId);
  if (!test) return null;

  const updated: ABTest = {
    ...test,
    ...updates,
  };

  await store.setJSON(`test_${testId}`, updated);
  return updated;
}

/**
 * Remove test ID from form's test index
 */
async function removeTestFromFormIndex(formId: string, testId: string): Promise<void> {
  const store = getABTestStore();
  const indexKey = `form_tests_${formId}`;

  try {
    const testIds =
      ((await store.get(indexKey, { type: "json" })) as string[] | null) || [];
    const filtered = testIds.filter((id) => id !== testId);
    await store.setJSON(indexKey, filtered);
  } catch (error) {
    abTestLogger.error({ formId, testId, error }, "Failed to update form test index");
  }
}

/**
 * GET /api/forms/:id/ab-tests/:testId - Get a specific test
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

      abTestLogger.debug({ formId, testId }, "Retrieved A/B test");

      return NextResponse.json({ test });
    } catch (err) {
      abTestLogger.error({ formId, testId, error: err }, "Failed to get A/B test");
      return errorResponse(ErrorCodes.SERVER_ERROR);
    }
  },
  { rateLimit: { keyPrefix: "ab-tests-api", maxRequests: 30 } }
);

/**
 * PATCH /api/forms/:id/ab-tests/:testId - Update a test
 */
export const PATCH = authRoute<RouteParams>(
  async (req: NextRequest, { user }, routeCtx) => {
    const { id: formId, testId } = await routeCtx!.params;

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

      // Get the test
      const test = await getTest(testId);
      if (!test) {
        return NextResponse.json({ error: "Test not found" }, { status: 404 });
      }

      // Verify test belongs to this form
      if (test.formId !== formId) {
        return NextResponse.json({ error: "Test not found" }, { status: 404 });
      }

      const body = await req.json();
      const updates: Partial<ABTest> = {};

      // Allow updating specific fields
      if (body.name !== undefined) {
        updates.name = body.name;
      }
      if (body.description !== undefined) {
        updates.description = body.description;
      }
      if (body.status !== undefined) {
        // Validate status transitions
        const validStatuses = ["draft", "running", "paused", "completed"];
        if (!validStatuses.includes(body.status)) {
          return NextResponse.json(
            { error: "Invalid status" },
            { status: 400 }
          );
        }

        updates.status = body.status;

        // Track when test was started/ended
        if (body.status === "running" && test.status !== "running") {
          updates.startedAt = Date.now();
        }
        if (body.status === "completed" && test.status !== "completed") {
          updates.endedAt = Date.now();
        }
      }
      if (body.trafficAllocation !== undefined) {
        updates.trafficAllocation = body.trafficAllocation;
      }
      if (body.variants !== undefined) {
        // Can only update variants if test is in draft or paused
        if (test.status === "running") {
          return NextResponse.json(
            { error: "Cannot modify variants while test is running" },
            { status: 400 }
          );
        }
        updates.variants = body.variants;
      }

      // Create merged test for validation
      const updatedTest = { ...test, ...updates };

      // Validate updated test
      const validation = validateABTest(updatedTest);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }

      // Save updates
      const saved = await updateTest(testId, updates);

      abTestLogger.info(
        { formId, testId, updates: Object.keys(updates) },
        "Updated A/B test"
      );

      return NextResponse.json({ test: saved });
    } catch (err) {
      abTestLogger.error({ formId, testId, error: err }, "Failed to update A/B test");
      return errorResponse(ErrorCodes.SERVER_ERROR);
    }
  },
  { rateLimit: { keyPrefix: "ab-tests-api", maxRequests: 30 }, csrf: true }
);

/**
 * DELETE /api/forms/:id/ab-tests/:testId - Delete a test
 */
export const DELETE = authRoute<RouteParams>(
  async (req: NextRequest, { user }, routeCtx) => {
    const { id: formId, testId } = await routeCtx!.params;

    if (!isValidFormId(formId)) {
      return NextResponse.json(
        { error: "Valid form ID required" },
        { status: 400 }
      );
    }

    try {
      // Verify form ownership with delete permission
      const { form, error } = await verifyFormOwnership(
        formId,
        user.userId,
        "forms:delete"
      );
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

      // Don't allow deleting running tests
      if (test.status === "running") {
        return NextResponse.json(
          { error: "Cannot delete a running test. Pause it first." },
          { status: 400 }
        );
      }

      // Delete the test
      const store = getABTestStore();
      await store.delete(`test_${testId}`);

      // Remove from form's test index
      await removeTestFromFormIndex(formId, testId);

      abTestLogger.info({ formId, testId }, "Deleted A/B test");

      return NextResponse.json({ success: true, deleted: testId });
    } catch (err) {
      abTestLogger.error({ formId, testId, error: err }, "Failed to delete A/B test");
      return errorResponse(ErrorCodes.SERVER_ERROR);
    }
  },
  { rateLimit: { keyPrefix: "ab-tests-api", maxRequests: 30 }, csrf: true }
);
