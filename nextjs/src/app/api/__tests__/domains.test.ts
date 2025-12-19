/**
 * API Integration Tests - Custom Domains Routes
 * Tests for /api/domains/* endpoints
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET as domainsGET, POST as domainsPOST } from "../domains/route";
import { GET as domainGET, DELETE as domainDELETE } from "../domains/[domain]/route";
import { POST as verifyPOST } from "../domains/[domain]/verify/route";
import {
  createAuthenticatedRequest,
  createAuthenticatedRequestWithCsrf,
  getResponseJson,
} from "../../../../__tests__/helpers/api.helper";
import { createTestUser } from "../../../../__tests__/factories/user.factory";
import * as storage from "@/lib/storage";
import * as customDomains from "@/lib/custom-domains";
import * as subscriptionLimits from "@/lib/subscription-limits";
import * as rateLimit from "@/lib/rate-limit";
import * as audit from "@/lib/audit";
import * as csrf from "@/lib/csrf";

// Mock all external dependencies
vi.mock("@/lib/storage");
vi.mock("@/lib/custom-domains");
vi.mock("@/lib/subscription-limits");
vi.mock("@/lib/rate-limit");
vi.mock("@/lib/audit");
vi.mock("@/lib/csrf", () => ({
  validateCsrfToken: vi.fn(() => true),
}));

describe("Custom Domains API Routes", () => {
  const testUser = createTestUser({ email: "test@example.com" });

  const mockDomain = {
    domain: "forms.example.com",
    userId: testUser.id,
    status: "pending" as const,
    verificationToken: "vf_verify_test123",
    sslStatus: "pending" as const,
    createdAt: Date.now(),
    lastCheckedAt: Date.now(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock rate limiting to always allow
    vi.mocked(rateLimit.checkRateLimit).mockResolvedValue({
      allowed: true,
      limit: 100,
      remaining: 99,
      reset: Date.now() + 60000,
    });
    vi.mocked(rateLimit.getRateLimitHeaders).mockReturnValue(new Headers());

    // Mock audit logging
    vi.mocked(audit.logAudit).mockResolvedValue(undefined);
    vi.mocked(audit.getAuditContext).mockReturnValue({
      ip: "127.0.0.1",
      userAgent: "test",
    });

    // Mock user storage with business subscription
    vi.mocked(storage.getUserById).mockResolvedValue({
      id: testUser.id,
      email: testUser.email,
      password: "hashed",
      createdAt: Date.now(),
      verified: true,
      subscription: "business",
    });

    // Mock subscription limits
    vi.mocked(subscriptionLimits.getCustomDomainLimit).mockReturnValue(1);
  });

  describe("GET /api/domains", () => {
    it("should return empty list when no domains exist", async () => {
      vi.mocked(customDomains.getUserDomains).mockResolvedValue([]);

      const req = createAuthenticatedRequest(
        "GET",
        "/api/domains",
        testUser.id,
        testUser.email
      );

      const response = await domainsGET(req);
      const body = await getResponseJson<{ domains: unknown[]; total: number }>(response);

      expect(response.status).toBe(200);
      expect(body).toEqual({ domains: [], total: 0 });
    });

    it("should return user domains", async () => {
      vi.mocked(customDomains.getUserDomains).mockResolvedValue([mockDomain]);

      const req = createAuthenticatedRequest(
        "GET",
        "/api/domains",
        testUser.id,
        testUser.email
      );

      const response = await domainsGET(req);
      const body = await getResponseJson<{ domains: { domain: string }[]; total: number }>(response);

      expect(response.status).toBe(200);
      expect(body.total).toBe(1);
      expect(body.domains[0].domain).toBe("forms.example.com");
    });

    it("should reject unauthenticated request", async () => {
      const req = new Request("http://localhost/api/domains");

      const response = await domainsGET(req as unknown as Request);

      expect(response.status).toBe(401);
    });
  });

  describe("POST /api/domains", () => {
    it("should create a new domain", async () => {
      vi.mocked(customDomains.validateDomain).mockReturnValue({
        valid: true,
        sanitized: "forms.example.com",
      });
      vi.mocked(customDomains.getUserDomains).mockResolvedValue([]);
      vi.mocked(customDomains.createCustomDomain).mockResolvedValue(mockDomain);
      vi.mocked(customDomains.getVerificationRecordName).mockReturnValue(
        "_veilforms-verify.forms.example.com"
      );

      const req = createAuthenticatedRequestWithCsrf(
        "POST",
        "/api/domains",
        testUser.id,
        testUser.email,
        { body: { domain: "forms.example.com" } }
      );

      const response = await domainsPOST(req);
      const body = await getResponseJson<{
        domain: { domain: string };
        verification: { type: string; name: string; value: string };
      }>(response);

      expect(response.status).toBe(201);
      expect(body.domain.domain).toBe("forms.example.com");
      expect(body.verification.type).toBe("TXT");
      expect(body.verification.name).toContain("_veilforms-verify");
    });

    it("should reject invalid domain format", async () => {
      vi.mocked(customDomains.validateDomain).mockReturnValue({
        valid: false,
        error: "Invalid domain format",
      });

      const req = createAuthenticatedRequestWithCsrf(
        "POST",
        "/api/domains",
        testUser.id,
        testUser.email,
        { body: { domain: "not valid" } }
      );

      const response = await domainsPOST(req);
      const body = await getResponseJson<{ error: string }>(response);

      expect(response.status).toBe(400);
      expect(body.error).toContain("Invalid");
    });

    it("should reject domain on free plan", async () => {
      vi.mocked(customDomains.validateDomain).mockReturnValue({
        valid: true,
        sanitized: "forms.example.com",
      });
      vi.mocked(storage.getUserById).mockResolvedValue({
        id: testUser.id,
        email: testUser.email,
        password: "hashed",
        createdAt: Date.now(),
        verified: true,
        subscription: "free",
      });
      vi.mocked(subscriptionLimits.getCustomDomainLimit).mockReturnValue(0);

      const req = createAuthenticatedRequestWithCsrf(
        "POST",
        "/api/domains",
        testUser.id,
        testUser.email,
        { body: { domain: "forms.example.com" } }
      );

      const response = await domainsPOST(req);
      const body = await getResponseJson<{ error: string }>(response);

      expect(response.status).toBe(402);
      expect(body.error).toContain("not available");
    });

    it("should reject when domain limit reached", async () => {
      vi.mocked(customDomains.validateDomain).mockReturnValue({
        valid: true,
        sanitized: "second.example.com",
      });
      vi.mocked(customDomains.getUserDomains).mockResolvedValue([mockDomain]); // Already have 1
      vi.mocked(subscriptionLimits.getCustomDomainLimit).mockReturnValue(1); // Limit is 1

      const req = createAuthenticatedRequestWithCsrf(
        "POST",
        "/api/domains",
        testUser.id,
        testUser.email,
        { body: { domain: "second.example.com" } }
      );

      const response = await domainsPOST(req);
      const body = await getResponseJson<{ error: string; limit: number }>(response);

      expect(response.status).toBe(402);
      expect(body.error).toContain("limit reached");
      expect(body.limit).toBe(1);
    });

    it("should reject already registered domain", async () => {
      vi.mocked(customDomains.validateDomain).mockReturnValue({
        valid: true,
        sanitized: "forms.example.com",
      });
      vi.mocked(customDomains.getUserDomains).mockResolvedValue([]);
      vi.mocked(customDomains.createCustomDomain).mockRejectedValue(
        new Error("Domain already registered")
      );

      const req = createAuthenticatedRequestWithCsrf(
        "POST",
        "/api/domains",
        testUser.id,
        testUser.email,
        { body: { domain: "forms.example.com" } }
      );

      const response = await domainsPOST(req);
      const body = await getResponseJson<{ error: string }>(response);

      expect(response.status).toBe(409);
      expect(body.error).toContain("already registered");
    });

    it("should require CSRF token", async () => {
      vi.mocked(csrf.validateCsrfToken).mockReturnValueOnce(false);

      const req = createAuthenticatedRequest(
        "POST",
        "/api/domains",
        testUser.id,
        testUser.email,
        { body: { domain: "forms.example.com" } }
      );

      const response = await domainsPOST(req);

      expect(response.status).toBe(403);
    });
  });

  describe("GET /api/domains/:domain", () => {
    it("should return domain details", async () => {
      vi.mocked(customDomains.getCustomDomain).mockResolvedValue(mockDomain);
      vi.mocked(customDomains.getVerificationRecordName).mockReturnValue(
        "_veilforms-verify.forms.example.com"
      );

      const req = createAuthenticatedRequest(
        "GET",
        "/api/domains/forms.example.com",
        testUser.id,
        testUser.email
      );

      const response = await domainGET(req, {
        params: Promise.resolve({ domain: "forms.example.com" }),
      });
      const body = await getResponseJson<{
        domain: { domain: string; status: string };
        verification: { name: string };
      }>(response);

      expect(response.status).toBe(200);
      expect(body.domain.domain).toBe("forms.example.com");
      expect(body.domain.status).toBe("pending");
      expect(body.verification.name).toContain("_veilforms-verify");
    });

    it("should return 404 for non-existent domain", async () => {
      vi.mocked(customDomains.getCustomDomain).mockResolvedValue(null);

      const req = createAuthenticatedRequest(
        "GET",
        "/api/domains/notfound.com",
        testUser.id,
        testUser.email
      );

      const response = await domainGET(req, {
        params: Promise.resolve({ domain: "notfound.com" }),
      });

      expect(response.status).toBe(404);
    });

    it("should reject request for domain owned by other user", async () => {
      vi.mocked(customDomains.getCustomDomain).mockResolvedValue({
        ...mockDomain,
        userId: "other_user_123",
      });

      const req = createAuthenticatedRequest(
        "GET",
        "/api/domains/forms.example.com",
        testUser.id,
        testUser.email
      );

      const response = await domainGET(req, {
        params: Promise.resolve({ domain: "forms.example.com" }),
      });

      expect(response.status).toBe(403);
    });
  });

  describe("DELETE /api/domains/:domain", () => {
    it("should delete domain", async () => {
      vi.mocked(customDomains.getCustomDomain).mockResolvedValue(mockDomain);
      vi.mocked(customDomains.deleteCustomDomain).mockResolvedValue(true);

      const req = createAuthenticatedRequestWithCsrf(
        "DELETE",
        "/api/domains/forms.example.com",
        testUser.id,
        testUser.email
      );

      const response = await domainDELETE(req, {
        params: Promise.resolve({ domain: "forms.example.com" }),
      });
      const body = await getResponseJson<{ success: boolean }>(response);

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
    });

    it("should return 404 for non-existent domain", async () => {
      vi.mocked(customDomains.getCustomDomain).mockResolvedValue(null);

      const req = createAuthenticatedRequestWithCsrf(
        "DELETE",
        "/api/domains/notfound.com",
        testUser.id,
        testUser.email
      );

      const response = await domainDELETE(req, {
        params: Promise.resolve({ domain: "notfound.com" }),
      });

      expect(response.status).toBe(404);
    });

    it("should reject deletion of domain owned by other user", async () => {
      vi.mocked(customDomains.getCustomDomain).mockResolvedValue({
        ...mockDomain,
        userId: "other_user_123",
      });

      const req = createAuthenticatedRequestWithCsrf(
        "DELETE",
        "/api/domains/forms.example.com",
        testUser.id,
        testUser.email
      );

      const response = await domainDELETE(req, {
        params: Promise.resolve({ domain: "forms.example.com" }),
      });

      expect(response.status).toBe(403);
    });

    it("should log audit event on deletion", async () => {
      vi.mocked(customDomains.getCustomDomain).mockResolvedValue(mockDomain);
      vi.mocked(customDomains.deleteCustomDomain).mockResolvedValue(true);

      const req = createAuthenticatedRequestWithCsrf(
        "DELETE",
        "/api/domains/forms.example.com",
        testUser.id,
        testUser.email
      );

      await domainDELETE(req, {
        params: Promise.resolve({ domain: "forms.example.com" }),
      });

      expect(audit.logAudit).toHaveBeenCalledWith(
        testUser.id,
        audit.AuditEvents.DOMAIN_DELETED,
        expect.objectContaining({ domain: "forms.example.com" }),
        expect.anything()
      );
    });
  });

  describe("POST /api/domains/:domain/verify", () => {
    it("should verify domain successfully", async () => {
      vi.mocked(customDomains.getCustomDomain).mockResolvedValue(mockDomain);
      vi.mocked(customDomains.triggerDomainVerification).mockResolvedValue({
        success: true,
        domain: {
          ...mockDomain,
          status: "active",
          verifiedAt: Date.now(),
          sslStatus: "provisioning",
        },
      });

      const req = createAuthenticatedRequestWithCsrf(
        "POST",
        "/api/domains/forms.example.com/verify",
        testUser.id,
        testUser.email
      );

      const response = await verifyPOST(req, {
        params: Promise.resolve({ domain: "forms.example.com" }),
      });
      const body = await getResponseJson<{
        success: boolean;
        domain: { status: string };
      }>(response);

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.domain.status).toBe("active");
    });

    it("should return success for already verified domain", async () => {
      vi.mocked(customDomains.getCustomDomain).mockResolvedValue({
        ...mockDomain,
        status: "active",
        verifiedAt: Date.now(),
      });

      const req = createAuthenticatedRequestWithCsrf(
        "POST",
        "/api/domains/forms.example.com/verify",
        testUser.id,
        testUser.email
      );

      const response = await verifyPOST(req, {
        params: Promise.resolve({ domain: "forms.example.com" }),
      });
      const body = await getResponseJson<{ success: boolean; message: string }>(response);

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.message).toContain("already verified");
    });

    it("should return failure when DNS record not found", async () => {
      vi.mocked(customDomains.getCustomDomain).mockResolvedValue(mockDomain);
      vi.mocked(customDomains.triggerDomainVerification).mockResolvedValue({
        success: false,
        error: "DNS record not found",
        domain: {
          ...mockDomain,
          status: "failed",
          failureReason: "DNS record not found",
        },
      });

      const req = createAuthenticatedRequestWithCsrf(
        "POST",
        "/api/domains/forms.example.com/verify",
        testUser.id,
        testUser.email
      );

      const response = await verifyPOST(req, {
        params: Promise.resolve({ domain: "forms.example.com" }),
      });
      const body = await getResponseJson<{ success: boolean; error: string }>(response);

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error).toContain("DNS record not found");
    });

    it("should return 404 for non-existent domain", async () => {
      vi.mocked(customDomains.getCustomDomain).mockResolvedValue(null);

      const req = createAuthenticatedRequestWithCsrf(
        "POST",
        "/api/domains/notfound.com/verify",
        testUser.id,
        testUser.email
      );

      const response = await verifyPOST(req, {
        params: Promise.resolve({ domain: "notfound.com" }),
      });

      expect(response.status).toBe(404);
    });

    it("should reject verification for domain owned by other user", async () => {
      vi.mocked(customDomains.getCustomDomain).mockResolvedValue({
        ...mockDomain,
        userId: "other_user_123",
      });

      const req = createAuthenticatedRequestWithCsrf(
        "POST",
        "/api/domains/forms.example.com/verify",
        testUser.id,
        testUser.email
      );

      const response = await verifyPOST(req, {
        params: Promise.resolve({ domain: "forms.example.com" }),
      });

      expect(response.status).toBe(403);
    });

    it("should log audit event on successful verification", async () => {
      vi.mocked(customDomains.getCustomDomain).mockResolvedValue(mockDomain);
      vi.mocked(customDomains.triggerDomainVerification).mockResolvedValue({
        success: true,
        domain: {
          ...mockDomain,
          status: "active",
          verifiedAt: Date.now(),
        },
      });

      const req = createAuthenticatedRequestWithCsrf(
        "POST",
        "/api/domains/forms.example.com/verify",
        testUser.id,
        testUser.email
      );

      await verifyPOST(req, {
        params: Promise.resolve({ domain: "forms.example.com" }),
      });

      expect(audit.logAudit).toHaveBeenCalledWith(
        testUser.id,
        audit.AuditEvents.DOMAIN_VERIFIED,
        expect.objectContaining({ domain: "forms.example.com" }),
        expect.anything()
      );
    });

    it("should log audit event on failed verification", async () => {
      vi.mocked(customDomains.getCustomDomain).mockResolvedValue(mockDomain);
      vi.mocked(customDomains.triggerDomainVerification).mockResolvedValue({
        success: false,
        error: "DNS record not found",
      });

      const req = createAuthenticatedRequestWithCsrf(
        "POST",
        "/api/domains/forms.example.com/verify",
        testUser.id,
        testUser.email
      );

      await verifyPOST(req, {
        params: Promise.resolve({ domain: "forms.example.com" }),
      });

      expect(audit.logAudit).toHaveBeenCalledWith(
        testUser.id,
        audit.AuditEvents.DOMAIN_VERIFICATION_FAILED,
        expect.objectContaining({
          domain: "forms.example.com",
          reason: "DNS record not found",
        }),
        expect.anything()
      );
    });
  });
});
