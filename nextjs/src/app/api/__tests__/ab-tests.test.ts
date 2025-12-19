/**
 * API Integration Tests - A/B Tests Routes
 * Tests for /api/forms/:id/ab-tests/* endpoints
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET as abTestsGET, POST as abTestsPOST } from "../forms/[id]/ab-tests/route";
import { GET as abTestGET, PATCH as abTestPATCH, DELETE as abTestDELETE } from "../forms/[id]/ab-tests/[testId]/route";
import { GET as abTestResultsGET } from "../forms/[id]/ab-tests/[testId]/results/route";
import {
  createAuthenticatedRequest,
  createAuthenticatedRequestWithCsrf,
  getResponseJson,
} from "../../../../__tests__/helpers/api.helper";
import { createTestUser } from "../../../../__tests__/factories/user.factory";
import { createTestForm } from "../../../../__tests__/factories/form.factory";
import * as storage from "@/lib/storage";
import * as rateLimit from "@/lib/rate-limit";
import * as csrf from "@/lib/csrf";

// Mock stores
const mockAbTestStore = new Map<string, unknown>();
const mockFormStore = new Map<string, unknown>();

// Mock all external dependencies
vi.mock("@/lib/storage");
vi.mock("@/lib/rate-limit");
vi.mock("@/lib/csrf", () => ({
  validateCsrfToken: vi.fn(() => true),
}));
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock Netlify Blobs
vi.mock("@netlify/blobs", () => ({
  getStore: vi.fn(({ name }: { name: string }) => {
    const storeMap = name === "vf-ab-tests" ? mockAbTestStore : mockFormStore;
    return {
      get: vi.fn(async (key: string, { type }: { type: string } = { type: "json" }) => {
        const value = storeMap.get(key);
        return value ?? null;
      }),
      setJSON: vi.fn(async (key: string, value: unknown) => {
        storeMap.set(key, value);
      }),
      delete: vi.fn(async (key: string) => {
        storeMap.delete(key);
      }),
    };
  }),
}));

describe("A/B Tests API Routes", () => {
  const testUser = createTestUser({ email: "test@example.com" });
  const testForm = createTestForm({ userId: testUser.id, name: "Test Form" });

  beforeEach(() => {
    vi.clearAllMocks();
    mockAbTestStore.clear();
    mockFormStore.clear();

    // Mock rate limiting to always allow
    vi.mocked(rateLimit.checkRateLimit).mockResolvedValue({
      allowed: true,
      limit: 100,
      remaining: 99,
      reset: Date.now() + 60000,
    });
    vi.mocked(rateLimit.getRateLimitHeaders).mockReturnValue(new Headers());

    // Mock form storage
    vi.mocked(storage.getForm).mockResolvedValue(testForm);
    vi.mocked(storage.getUserForms).mockResolvedValue([testForm]);
  });

  describe("GET /api/forms/:id/ab-tests", () => {
    it("should return empty list when no tests exist", async () => {
      const req = createAuthenticatedRequest(
        "GET",
        `/api/forms/${testForm.id}/ab-tests`,
        testUser.id,
        testUser.email
      );

      const response = await abTestsGET(req, {
        params: Promise.resolve({ id: testForm.id }),
      });
      const body = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(body).toEqual({ tests: [], total: 0 });
    });

    it("should return list of tests for form", async () => {
      const test1 = {
        id: "abtest_123",
        formId: testForm.id,
        name: "Test 1",
        status: "draft",
        variants: [],
        metrics: ["conversion"],
        trafficAllocation: 100,
        createdAt: Date.now(),
        createdBy: testUser.id,
      };
      mockAbTestStore.set(`form_tests_${testForm.id}`, ["abtest_123"]);
      mockAbTestStore.set("test_abtest_123", test1);

      const req = createAuthenticatedRequest(
        "GET",
        `/api/forms/${testForm.id}/ab-tests`,
        testUser.id,
        testUser.email
      );

      const response = await abTestsGET(req, {
        params: Promise.resolve({ id: testForm.id }),
      });
      const body = await getResponseJson<{ tests: unknown[]; total: number }>(response);

      expect(response.status).toBe(200);
      expect(body.total).toBe(1);
      expect(body.tests).toHaveLength(1);
    });

    it("should reject invalid form ID", async () => {
      const req = createAuthenticatedRequest(
        "GET",
        "/api/forms/invalid/ab-tests",
        testUser.id,
        testUser.email
      );

      const response = await abTestsGET(req, {
        params: Promise.resolve({ id: "invalid" }),
      });

      expect(response.status).toBe(400);
    });

    it("should reject unauthenticated request", async () => {
      const req = new Request("http://localhost/api/forms/vf_test/ab-tests");

      const response = await abTestsGET(req as unknown as Request, {
        params: Promise.resolve({ id: "vf_test" }),
      });

      expect(response.status).toBe(401);
    });

    it("should reject request for form user doesn't own", async () => {
      vi.mocked(storage.getForm).mockResolvedValue({
        ...testForm,
        userId: "other_user",
      });

      const req = createAuthenticatedRequest(
        "GET",
        `/api/forms/${testForm.id}/ab-tests`,
        testUser.id,
        testUser.email
      );

      const response = await abTestsGET(req, {
        params: Promise.resolve({ id: testForm.id }),
      });

      expect(response.status).toBe(403);
    });
  });

  describe("POST /api/forms/:id/ab-tests", () => {
    it("should create a new A/B test", async () => {
      const req = createAuthenticatedRequestWithCsrf(
        "POST",
        `/api/forms/${testForm.id}/ab-tests`,
        testUser.id,
        testUser.email,
        {
          body: {
            name: "My A/B Test",
            variants: [
              { name: "Control", weight: 50 },
              { name: "Treatment", weight: 50 },
            ],
            trafficAllocation: 100,
          },
        }
      );

      const response = await abTestsPOST(req, {
        params: Promise.resolve({ id: testForm.id }),
      });
      const body = await getResponseJson<{ test: { id: string; name: string } }>(response);

      expect(response.status).toBe(201);
      expect(body.test.id).toMatch(/^abtest_/);
      expect(body.test.name).toBe("My A/B Test");
    });

    it("should reject test without name", async () => {
      const req = createAuthenticatedRequestWithCsrf(
        "POST",
        `/api/forms/${testForm.id}/ab-tests`,
        testUser.id,
        testUser.email,
        {
          body: {
            variants: [
              { name: "Control", weight: 50 },
              { name: "Treatment", weight: 50 },
            ],
          },
        }
      );

      const response = await abTestsPOST(req, {
        params: Promise.resolve({ id: testForm.id }),
      });

      expect(response.status).toBe(400);
    });

    it("should reject test without variants", async () => {
      const req = createAuthenticatedRequestWithCsrf(
        "POST",
        `/api/forms/${testForm.id}/ab-tests`,
        testUser.id,
        testUser.email,
        {
          body: { name: "Test" },
        }
      );

      const response = await abTestsPOST(req, {
        params: Promise.resolve({ id: testForm.id }),
      });

      expect(response.status).toBe(400);
    });

    it("should reject test with invalid variant weights", async () => {
      const req = createAuthenticatedRequestWithCsrf(
        "POST",
        `/api/forms/${testForm.id}/ab-tests`,
        testUser.id,
        testUser.email,
        {
          body: {
            name: "Test",
            variants: [
              { name: "A", weight: 30 },
              { name: "B", weight: 30 }, // Only sums to 60
            ],
            trafficAllocation: 100,
          },
        }
      );

      const response = await abTestsPOST(req, {
        params: Promise.resolve({ id: testForm.id }),
      });

      expect(response.status).toBe(400);
      const body = await getResponseJson<{ error: string }>(response);
      expect(body.error).toContain("sum to 100");
    });

    it("should require CSRF token", async () => {
      const req = createAuthenticatedRequest(
        "POST",
        `/api/forms/${testForm.id}/ab-tests`,
        testUser.id,
        testUser.email,
        {
          body: {
            name: "Test",
            variants: [
              { name: "A", weight: 50 },
              { name: "B", weight: 50 },
            ],
          },
        }
      );

      // Mock CSRF validation to fail
      vi.mocked(csrf.validateCsrfToken).mockReturnValueOnce(false);

      const response = await abTestsPOST(req, {
        params: Promise.resolve({ id: testForm.id }),
      });

      expect(response.status).toBe(403);
    });
  });

  describe("GET /api/forms/:id/ab-tests/:testId", () => {
    const testData = {
      id: "abtest_123",
      formId: "",
      name: "Test",
      status: "draft",
      variants: [
        { id: "var_1", name: "Control", weight: 50, formSnapshot: {}, impressions: 0, conversions: 0 },
        { id: "var_2", name: "Treatment", weight: 50, formSnapshot: {}, impressions: 0, conversions: 0 },
      ],
      metrics: ["conversion"],
      trafficAllocation: 100,
      createdAt: Date.now(),
      createdBy: "",
    };

    beforeEach(() => {
      testData.formId = testForm.id;
      testData.createdBy = testUser.id;
      mockAbTestStore.set("test_abtest_123", testData);
    });

    it("should return single test", async () => {
      const req = createAuthenticatedRequest(
        "GET",
        `/api/forms/${testForm.id}/ab-tests/abtest_123`,
        testUser.id,
        testUser.email
      );

      const response = await abTestGET(req, {
        params: Promise.resolve({ id: testForm.id, testId: "abtest_123" }),
      });
      const body = await getResponseJson<{ test: { id: string } }>(response);

      expect(response.status).toBe(200);
      expect(body.test.id).toBe("abtest_123");
    });

    it("should return 404 for non-existent test", async () => {
      const req = createAuthenticatedRequest(
        "GET",
        `/api/forms/${testForm.id}/ab-tests/nonexistent`,
        testUser.id,
        testUser.email
      );

      const response = await abTestGET(req, {
        params: Promise.resolve({ id: testForm.id, testId: "nonexistent" }),
      });

      expect(response.status).toBe(404);
    });
  });

  describe("PATCH /api/forms/:id/ab-tests/:testId", () => {
    const testData = {
      id: "abtest_123",
      formId: "",
      name: "Test",
      status: "draft" as const,
      variants: [
        { id: "var_1", name: "Control", weight: 50, formSnapshot: {}, impressions: 0, conversions: 0 },
        { id: "var_2", name: "Treatment", weight: 50, formSnapshot: {}, impressions: 0, conversions: 0 },
      ],
      metrics: ["conversion"],
      trafficAllocation: 100,
      createdAt: Date.now(),
      createdBy: "",
    };

    beforeEach(() => {
      testData.formId = testForm.id;
      testData.createdBy = testUser.id;
      mockAbTestStore.set("test_abtest_123", { ...testData });
    });

    it("should update test name", async () => {
      const req = createAuthenticatedRequestWithCsrf(
        "PATCH",
        `/api/forms/${testForm.id}/ab-tests/abtest_123`,
        testUser.id,
        testUser.email,
        { body: { name: "Updated Name" } }
      );

      const response = await abTestPATCH(req, {
        params: Promise.resolve({ id: testForm.id, testId: "abtest_123" }),
      });
      const body = await getResponseJson<{ test: { name: string } }>(response);

      expect(response.status).toBe(200);
      expect(body.test.name).toBe("Updated Name");
    });

    it("should start a test", async () => {
      const req = createAuthenticatedRequestWithCsrf(
        "PATCH",
        `/api/forms/${testForm.id}/ab-tests/abtest_123`,
        testUser.id,
        testUser.email,
        { body: { status: "running" } }
      );

      const response = await abTestPATCH(req, {
        params: Promise.resolve({ id: testForm.id, testId: "abtest_123" }),
      });
      const body = await getResponseJson<{ test: { status: string; startedAt: number } }>(response);

      expect(response.status).toBe(200);
      expect(body.test.status).toBe("running");
      expect(body.test.startedAt).toBeDefined();
    });

    it("should complete a test", async () => {
      // First make it running
      mockAbTestStore.set("test_abtest_123", { ...testData, status: "running", startedAt: Date.now() });

      const req = createAuthenticatedRequestWithCsrf(
        "PATCH",
        `/api/forms/${testForm.id}/ab-tests/abtest_123`,
        testUser.id,
        testUser.email,
        { body: { status: "completed" } }
      );

      const response = await abTestPATCH(req, {
        params: Promise.resolve({ id: testForm.id, testId: "abtest_123" }),
      });
      const body = await getResponseJson<{ test: { status: string; endedAt: number } }>(response);

      expect(response.status).toBe(200);
      expect(body.test.status).toBe("completed");
      expect(body.test.endedAt).toBeDefined();
    });
  });

  describe("DELETE /api/forms/:id/ab-tests/:testId", () => {
    beforeEach(() => {
      const testData = {
        id: "abtest_123",
        formId: testForm.id,
        name: "Test",
        status: "draft",
        variants: [],
        metrics: ["conversion"],
        trafficAllocation: 100,
        createdAt: Date.now(),
        createdBy: testUser.id,
      };
      mockAbTestStore.set("test_abtest_123", testData);
      mockAbTestStore.set(`form_tests_${testForm.id}`, ["abtest_123"]);
    });

    it("should delete a test", async () => {
      const req = createAuthenticatedRequestWithCsrf(
        "DELETE",
        `/api/forms/${testForm.id}/ab-tests/abtest_123`,
        testUser.id,
        testUser.email
      );

      const response = await abTestDELETE(req, {
        params: Promise.resolve({ id: testForm.id, testId: "abtest_123" }),
      });

      expect(response.status).toBe(200);
    });

    it("should return 404 for non-existent test", async () => {
      const req = createAuthenticatedRequestWithCsrf(
        "DELETE",
        `/api/forms/${testForm.id}/ab-tests/nonexistent`,
        testUser.id,
        testUser.email
      );

      const response = await abTestDELETE(req, {
        params: Promise.resolve({ id: testForm.id, testId: "nonexistent" }),
      });

      expect(response.status).toBe(404);
    });
  });

  describe("GET /api/forms/:id/ab-tests/:testId/results", () => {
    beforeEach(() => {
      const testData = {
        id: "abtest_123",
        formId: testForm.id,
        name: "Test",
        status: "running",
        variants: [
          { id: "var_1", name: "Control", weight: 50, formSnapshot: {}, impressions: 1000, conversions: 100 },
          { id: "var_2", name: "Treatment", weight: 50, formSnapshot: {}, impressions: 1000, conversions: 150 },
        ],
        metrics: ["conversion"],
        trafficAllocation: 100,
        createdAt: Date.now(),
        startedAt: Date.now() - 86400000,
        createdBy: testUser.id,
      };
      mockAbTestStore.set("test_abtest_123", testData);
    });

    it("should return test results with analysis", async () => {
      const req = createAuthenticatedRequest(
        "GET",
        `/api/forms/${testForm.id}/ab-tests/abtest_123/results`,
        testUser.id,
        testUser.email
      );

      const response = await abTestResultsGET(req, {
        params: Promise.resolve({ id: testForm.id, testId: "abtest_123" }),
      });
      const body = await getResponseJson<{
        test: { id: string };
        summary: { totalImpressions: number };
        analysis: {
          variants: { variantId: string; conversionRate: number }[];
          confidence: number;
        };
        variants: { id: string; impressions: number }[];
      }>(response);

      expect(response.status).toBe(200);
      expect(body.analysis.variants).toHaveLength(2);
      expect(body.analysis.variants[0].conversionRate).toBeDefined();
      expect(body.analysis.confidence).toBeDefined();
    });

    it("should return 404 for non-existent test", async () => {
      const req = createAuthenticatedRequest(
        "GET",
        `/api/forms/${testForm.id}/ab-tests/nonexistent/results`,
        testUser.id,
        testUser.email
      );

      const response = await abTestResultsGET(req, {
        params: Promise.resolve({ id: testForm.id, testId: "nonexistent" }),
      });

      expect(response.status).toBe(404);
    });
  });
});
