import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  assignVariant,
  calculateConversionRate,
  calculateChiSquared,
  analyzeTestResults,
  validateABTest,
  generateTestId,
  generateVariantId,
  type ABTest,
  type Variant,
} from "./ab-testing";

// Helper to create a mock variant
function createMockVariant(overrides: Partial<Variant> = {}): Variant {
  return {
    id: `var_${Math.random().toString(36).slice(2)}`,
    name: "Variant A",
    weight: 50,
    formSnapshot: {},
    impressions: 0,
    conversions: 0,
    ...overrides,
  };
}

// Helper to create a mock test
function createMockTest(overrides: Partial<ABTest> = {}): ABTest {
  return {
    id: `abtest_${Math.random().toString(36).slice(2)}`,
    formId: "vf_test123",
    name: "Test Experiment",
    status: "running",
    variants: [
      createMockVariant({ id: "var_control", name: "Control", weight: 50 }),
      createMockVariant({ id: "var_treatment", name: "Treatment", weight: 50 }),
    ],
    metrics: ["submit"],
    trafficAllocation: 100,
    createdAt: Date.now(),
    createdBy: "user_123",
    ...overrides,
  };
}

describe("ab-testing", () => {
  describe("assignVariant", () => {
    it("should assign same variant to same user deterministically", () => {
      const test = createMockTest();
      const userId = "user_abc123";

      const result1 = assignVariant(test, userId);
      const result2 = assignVariant(test, userId);

      expect(result1.variantId).toBe(result2.variantId);
      expect(result1.inTest).toBe(result2.inTest);
    });

    it("should distribute users across variants according to weights", () => {
      const test = createMockTest({
        variants: [
          createMockVariant({ id: "var_a", name: "A", weight: 70 }),
          createMockVariant({ id: "var_b", name: "B", weight: 30 }),
        ],
      });

      // Run many assignments and check distribution
      const counts: Record<string, number> = { var_a: 0, var_b: 0 };
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        const result = assignVariant(test, `user_${i}`);
        if (result.variantId) {
          counts[result.variantId]++;
        }
      }

      // Allow 10% tolerance for random distribution
      expect(counts.var_a).toBeGreaterThan(iterations * 0.6);
      expect(counts.var_a).toBeLessThan(iterations * 0.8);
      expect(counts.var_b).toBeGreaterThan(iterations * 0.2);
      expect(counts.var_b).toBeLessThan(iterations * 0.4);
    });

    it("should exclude users based on traffic allocation", () => {
      const test = createMockTest({
        trafficAllocation: 50, // Only 50% of users in test
      });

      let inTestCount = 0;
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        const result = assignVariant(test, `user_${i}`);
        if (result.inTest) {
          inTestCount++;
        }
      }

      // Allow 10% tolerance
      expect(inTestCount).toBeGreaterThan(iterations * 0.4);
      expect(inTestCount).toBeLessThan(iterations * 0.6);
    });

    it("should return null variantId when user not in test", () => {
      const test = createMockTest({
        trafficAllocation: 0, // No one in test
      });

      const result = assignVariant(test, "user_123");
      expect(result.variantId).toBeNull();
      expect(result.inTest).toBe(false);
    });

    it("should handle 100% traffic allocation", () => {
      const test = createMockTest({
        trafficAllocation: 100,
      });

      // All users should be in test
      for (let i = 0; i < 100; i++) {
        const result = assignVariant(test, `user_${i}`);
        expect(result.inTest).toBe(true);
        expect(result.variantId).not.toBeNull();
      }
    });

    it("should handle single variant test", () => {
      const test = createMockTest({
        variants: [
          createMockVariant({ id: "var_single", name: "Single", weight: 100 }),
        ],
      });

      const result = assignVariant(test, "user_123");
      expect(result.variantId).toBe("var_single");
    });

    it("should handle unequal weights that sum to 100", () => {
      const test = createMockTest({
        variants: [
          createMockVariant({ id: "var_a", weight: 33 }),
          createMockVariant({ id: "var_b", weight: 33 }),
          createMockVariant({ id: "var_c", weight: 34 }),
        ],
      });

      const result = assignVariant(test, "user_123");
      expect(result.inTest).toBe(true);
      expect(["var_a", "var_b", "var_c"]).toContain(result.variantId);
    });
  });

  describe("calculateConversionRate", () => {
    it("should calculate simple conversion rate", () => {
      const result = calculateConversionRate(10, 100);
      expect(result.rate).toBe(0.1);
    });

    it("should return 0 for zero impressions", () => {
      const result = calculateConversionRate(0, 0);
      expect(result.rate).toBe(0);
      expect(result.confidenceInterval).toEqual([0, 0]);
    });

    it("should calculate Wilson confidence interval", () => {
      const result = calculateConversionRate(50, 100);

      expect(result.rate).toBe(0.5);
      expect(result.confidenceInterval[0]).toBeLessThan(0.5);
      expect(result.confidenceInterval[1]).toBeGreaterThan(0.5);
      // Interval should be symmetric around rate for 50% conversion
      expect(result.confidenceInterval[0]).toBeGreaterThan(0.35);
      expect(result.confidenceInterval[1]).toBeLessThan(0.65);
    });

    it("should narrow confidence interval with more data", () => {
      const smallSample = calculateConversionRate(10, 100);
      const largeSample = calculateConversionRate(100, 1000);

      const smallInterval =
        smallSample.confidenceInterval[1] - smallSample.confidenceInterval[0];
      const largeInterval =
        largeSample.confidenceInterval[1] - largeSample.confidenceInterval[0];

      expect(largeInterval).toBeLessThan(smallInterval);
    });

    it("should clamp confidence interval to [0, 1]", () => {
      // High conversion rate
      const highResult = calculateConversionRate(99, 100);
      expect(highResult.confidenceInterval[1]).toBeLessThanOrEqual(1);

      // Low conversion rate
      const lowResult = calculateConversionRate(1, 100);
      expect(lowResult.confidenceInterval[0]).toBeGreaterThanOrEqual(0);
    });

    it("should handle 100% conversion", () => {
      const result = calculateConversionRate(100, 100);
      expect(result.rate).toBe(1);
      expect(result.confidenceInterval[1]).toBeLessThanOrEqual(1);
    });

    it("should handle 0% conversion", () => {
      const result = calculateConversionRate(0, 100);
      expect(result.rate).toBe(0);
      expect(result.confidenceInterval[0]).toBeGreaterThanOrEqual(0);
    });
  });

  describe("calculateChiSquared", () => {
    it("should return not significant for single variant", () => {
      const result = calculateChiSquared([
        createMockVariant({ impressions: 100, conversions: 10 }),
      ]);

      expect(result.isSignificant).toBe(false);
      expect(result.pValue).toBe(1);
      expect(result.degreesOfFreedom).toBe(0);
    });

    it("should return not significant for identical conversion rates", () => {
      const result = calculateChiSquared([
        createMockVariant({ impressions: 100, conversions: 10 }),
        createMockVariant({ impressions: 100, conversions: 10 }),
      ]);

      expect(result.chiSquared).toBe(0);
      expect(result.isSignificant).toBe(false);
    });

    it("should detect significant difference with large effect", () => {
      const result = calculateChiSquared([
        createMockVariant({ impressions: 1000, conversions: 100 }), // 10%
        createMockVariant({ impressions: 1000, conversions: 200 }), // 20%
      ]);

      expect(result.chiSquared).toBeGreaterThan(0);
      expect(result.isSignificant).toBe(true);
    });

    it("should return correct degrees of freedom", () => {
      const twoVariants = calculateChiSquared([
        createMockVariant({ impressions: 100, conversions: 10 }),
        createMockVariant({ impressions: 100, conversions: 20 }),
      ]);
      expect(twoVariants.degreesOfFreedom).toBe(1);

      const threeVariants = calculateChiSquared([
        createMockVariant({ impressions: 100, conversions: 10 }),
        createMockVariant({ impressions: 100, conversions: 15 }),
        createMockVariant({ impressions: 100, conversions: 20 }),
      ]);
      expect(threeVariants.degreesOfFreedom).toBe(2);
    });

    it("should handle zero impressions", () => {
      const result = calculateChiSquared([
        createMockVariant({ impressions: 0, conversions: 0 }),
        createMockVariant({ impressions: 0, conversions: 0 }),
      ]);

      expect(result.chiSquared).toBe(0);
      expect(result.pValue).toBe(1);
      expect(result.isSignificant).toBe(false);
    });

    it("should not detect significance with small sample", () => {
      const result = calculateChiSquared([
        createMockVariant({ impressions: 10, conversions: 1 }), // 10%
        createMockVariant({ impressions: 10, conversions: 2 }), // 20%
      ]);

      // Small samples shouldn't reach significance even with 2x difference
      expect(result.isSignificant).toBe(false);
    });
  });

  describe("analyzeTestResults", () => {
    it("should identify winner when significant", () => {
      const test = createMockTest({
        variants: [
          createMockVariant({
            id: "var_control",
            name: "Control",
            weight: 50,
            impressions: 1000,
            conversions: 100, // 10%
          }),
          createMockVariant({
            id: "var_treatment",
            name: "Treatment",
            weight: 50,
            impressions: 1000,
            conversions: 200, // 20%
          }),
        ],
      });

      const results = analyzeTestResults(test);

      expect(results.winner).toBe("var_treatment");
      expect(results.confidence).toBeGreaterThan(0.95);
      expect(results.recommendation).toContain("Treatment");
      expect(results.recommendation).toContain("winner");
    });

    it("should not declare winner without significance", () => {
      const test = createMockTest({
        variants: [
          createMockVariant({
            id: "var_control",
            name: "Control",
            impressions: 100,
            conversions: 10,
          }),
          createMockVariant({
            id: "var_treatment",
            name: "Treatment",
            impressions: 100,
            conversions: 12, // Slightly higher but not significant
          }),
        ],
      });

      const results = analyzeTestResults(test);

      expect(results.winner).toBeUndefined();
      expect(results.recommendation).toContain("not statistically significant");
    });

    it("should return variant results with correct data", () => {
      const test = createMockTest({
        variants: [
          createMockVariant({
            id: "var_a",
            name: "A",
            impressions: 100,
            conversions: 10,
          }),
          createMockVariant({
            id: "var_b",
            name: "B",
            impressions: 200,
            conversions: 40,
          }),
        ],
      });

      const results = analyzeTestResults(test);

      expect(results.variants).toHaveLength(2);

      const variantA = results.variants.find((v) => v.variantId === "var_a");
      expect(variantA).toBeDefined();
      expect(variantA!.impressions).toBe(100);
      expect(variantA!.conversions).toBe(10);
      expect(variantA!.conversionRate).toBe(0.1);

      const variantB = results.variants.find((v) => v.variantId === "var_b");
      expect(variantB).toBeDefined();
      expect(variantB!.impressions).toBe(200);
      expect(variantB!.conversions).toBe(40);
      expect(variantB!.conversionRate).toBe(0.2);
    });

    it("should include confidence intervals", () => {
      const test = createMockTest({
        variants: [
          createMockVariant({ impressions: 100, conversions: 10 }),
          createMockVariant({ impressions: 100, conversions: 20 }),
        ],
      });

      const results = analyzeTestResults(test);

      for (const variant of results.variants) {
        expect(variant.confidenceInterval).toHaveLength(2);
        expect(variant.confidenceInterval[0]).toBeLessThanOrEqual(
          variant.conversionRate
        );
        expect(variant.confidenceInterval[1]).toBeGreaterThanOrEqual(
          variant.conversionRate
        );
      }
    });

    it("should handle empty variants gracefully", () => {
      const test = createMockTest({ variants: [] });

      const results = analyzeTestResults(test);

      expect(results.variants).toHaveLength(0);
      expect(results.winner).toBeUndefined();
      expect(results.recommendation).toContain("Not enough data");
    });
  });

  describe("validateABTest", () => {
    it("should accept valid test configuration", () => {
      const result = validateABTest({
        name: "My Test",
        formId: "vf_form123",
        variants: [
          createMockVariant({ weight: 50 }),
          createMockVariant({ weight: 50 }),
        ],
        trafficAllocation: 100,
      });

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should reject empty test name", () => {
      const result = validateABTest({
        name: "",
        formId: "vf_form123",
        variants: [
          createMockVariant({ weight: 50 }),
          createMockVariant({ weight: 50 }),
        ],
        trafficAllocation: 100,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("name is required");
    });

    it("should reject whitespace-only name", () => {
      const result = validateABTest({
        name: "   ",
        formId: "vf_form123",
        variants: [
          createMockVariant({ weight: 50 }),
          createMockVariant({ weight: 50 }),
        ],
        trafficAllocation: 100,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("name is required");
    });

    it("should reject missing formId", () => {
      const result = validateABTest({
        name: "Test",
        variants: [
          createMockVariant({ weight: 50 }),
          createMockVariant({ weight: 50 }),
        ],
        trafficAllocation: 100,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("Form ID is required");
    });

    it("should reject less than 2 variants", () => {
      const result = validateABTest({
        name: "Test",
        formId: "vf_form123",
        variants: [createMockVariant({ weight: 100 })],
        trafficAllocation: 100,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("At least 2 variants");
    });

    it("should reject more than 10 variants", () => {
      const result = validateABTest({
        name: "Test",
        formId: "vf_form123",
        variants: Array.from({ length: 11 }, () =>
          createMockVariant({ weight: 9.09 })
        ),
        trafficAllocation: 100,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("Maximum 10 variants");
    });

    it("should reject weights not summing to 100", () => {
      const result = validateABTest({
        name: "Test",
        formId: "vf_form123",
        variants: [
          createMockVariant({ weight: 40 }),
          createMockVariant({ weight: 40 }),
        ],
        trafficAllocation: 100,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("sum to 100");
    });

    it("should reject invalid traffic allocation", () => {
      const negativeBound = validateABTest({
        name: "Test",
        formId: "vf_form123",
        variants: [
          createMockVariant({ weight: 50 }),
          createMockVariant({ weight: 50 }),
        ],
        trafficAllocation: -1,
      });
      expect(negativeBound.valid).toBe(false);

      const overBound = validateABTest({
        name: "Test",
        formId: "vf_form123",
        variants: [
          createMockVariant({ weight: 50 }),
          createMockVariant({ weight: 50 }),
        ],
        trafficAllocation: 101,
      });
      expect(overBound.valid).toBe(false);
    });

    it("should reject duplicate variant IDs", () => {
      const result = validateABTest({
        name: "Test",
        formId: "vf_form123",
        variants: [
          createMockVariant({ id: "same_id", weight: 50 }),
          createMockVariant({ id: "same_id", weight: 50 }),
        ],
        trafficAllocation: 100,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("unique");
    });

    it("should accept edge case of 0 traffic allocation", () => {
      const result = validateABTest({
        name: "Test",
        formId: "vf_form123",
        variants: [
          createMockVariant({ weight: 50 }),
          createMockVariant({ weight: 50 }),
        ],
        trafficAllocation: 0,
      });

      expect(result.valid).toBe(true);
    });
  });

  describe("generateTestId", () => {
    it("should generate ID with correct prefix", () => {
      const id = generateTestId();
      expect(id.startsWith("abtest_")).toBe(true);
    });

    it("should generate unique IDs", () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateTestId()));
      expect(ids.size).toBe(100);
    });
  });

  describe("generateVariantId", () => {
    it("should generate ID with correct prefix", () => {
      const id = generateVariantId();
      expect(id.startsWith("var_")).toBe(true);
    });

    it("should generate unique IDs", () => {
      const ids = new Set(
        Array.from({ length: 100 }, () => generateVariantId())
      );
      expect(ids.size).toBe(100);
    });
  });
});
