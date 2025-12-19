import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  validateDomain,
  generateVerificationToken,
  getVerificationRecordName,
  verifyDnsTxtRecord,
  createCustomDomain,
  getCustomDomain,
  getUserIdByDomain,
  getUserDomains,
  updateCustomDomain,
  triggerDomainVerification,
  deleteCustomDomain,
  isDomainActive,
  type CustomDomain,
} from "./custom-domains";

// Mock Netlify Blobs
const mockStore = {
  get: vi.fn(),
  setJSON: vi.fn(),
  delete: vi.fn(),
};

vi.mock("@netlify/blobs", () => ({
  getStore: () => mockStore,
}));

// Mock logger
vi.mock("./logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock retry helper
vi.mock("./retry", () => ({
  retryStorage: <T>(fn: () => Promise<T>) => fn(),
}));

// Mock DNS module
const mockResolveTxt = vi.fn();
vi.mock("dns", () => ({
  default: {
    resolveTxt: (hostname: string, callback: (err: Error | null, records: string[][]) => void) => {
      mockResolveTxt(hostname)
        .then((records: string[][]) => callback(null, records))
        .catch((err: Error) => callback(err, []));
    },
  },
}));

describe("custom-domains", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.get.mockReset();
    mockStore.setJSON.mockReset();
    mockStore.delete.mockReset();
    mockResolveTxt.mockReset();
  });

  describe("validateDomain", () => {
    it("should accept valid domains", () => {
      expect(validateDomain("example.com").valid).toBe(true);
      expect(validateDomain("sub.example.com").valid).toBe(true);
      expect(validateDomain("my-app.example.co.uk").valid).toBe(true);
      expect(validateDomain("a1b2c3.io").valid).toBe(true);
    });

    it("should sanitize domain input", () => {
      expect(validateDomain("https://example.com").sanitized).toBe("example.com");
      expect(validateDomain("http://example.com/path").sanitized).toBe("example.com");
      expect(validateDomain("www.example.com").sanitized).toBe("example.com");
      expect(validateDomain("  EXAMPLE.COM  ").sanitized).toBe("example.com");
      expect(validateDomain("HTTPS://WWW.Example.COM/").sanitized).toBe("example.com");
    });

    it("should reject empty or non-string input", () => {
      expect(validateDomain("").valid).toBe(false);
      expect(validateDomain("").error).toBe("Domain is required");
      expect(validateDomain(null as unknown as string).valid).toBe(false);
      expect(validateDomain(undefined as unknown as string).valid).toBe(false);
    });

    it("should reject invalid domain formats", () => {
      expect(validateDomain("not valid").valid).toBe(false);
      expect(validateDomain("-invalid.com").valid).toBe(false);
      expect(validateDomain("invalid-.com").valid).toBe(false);
      expect(validateDomain("inv@lid.com").valid).toBe(false);
      expect(validateDomain("inva lid.com").valid).toBe(false);
    });

    it("should reject domains without TLD", () => {
      expect(validateDomain("localhost").valid).toBe(false);
      expect(validateDomain("localhost").error).toContain("TLD");
      expect(validateDomain("mysite").valid).toBe(false);
    });

    it("should reject domains exceeding 253 characters", () => {
      const longDomain = "a".repeat(250) + ".com";
      expect(validateDomain(longDomain).valid).toBe(false);
      // Note: Regex validation fails before length check for very long domains
    });

    it("should reject localhost and internal domains", () => {
      // Exact "localhost" is rejected (no TLD)
      expect(validateDomain("localhost").valid).toBe(false);
      // Domains with reserved TLDs are rejected
      expect(validateDomain("myapp.local").valid).toBe(false);
      expect(validateDomain("internal.internal").valid).toBe(false);
      expect(validateDomain("test.test").valid).toBe(false);
      expect(validateDomain("example.example").valid).toBe(false);
    });

    it("should reject IP-like domains", () => {
      expect(validateDomain("127.0.0.1.com").valid).toBe(false);
      expect(validateDomain("192.168.1.1.com").valid).toBe(false);
      expect(validateDomain("10.0.0.1.com").valid).toBe(false);
    });
  });

  describe("generateVerificationToken", () => {
    it("should generate token with correct prefix", () => {
      const token = generateVerificationToken();
      expect(token.startsWith("vf_verify_")).toBe(true);
    });

    it("should generate unique tokens", () => {
      const tokens = new Set(
        Array.from({ length: 100 }, () => generateVerificationToken())
      );
      expect(tokens.size).toBe(100);
    });

    it("should include timestamp component", () => {
      const token = generateVerificationToken();
      const parts = token.split("_");
      expect(parts.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("getVerificationRecordName", () => {
    it("should return correctly formatted TXT record name", () => {
      expect(getVerificationRecordName("example.com")).toBe(
        "_veilforms-verify.example.com"
      );
      expect(getVerificationRecordName("sub.domain.com")).toBe(
        "_veilforms-verify.sub.domain.com"
      );
    });
  });

  describe("verifyDnsTxtRecord", () => {
    it("should verify matching TXT record", async () => {
      mockResolveTxt.mockResolvedValueOnce([["vf_verify_token123"]]);

      const result = await verifyDnsTxtRecord("example.com", "vf_verify_token123");

      expect(result.verified).toBe(true);
      expect(mockResolveTxt).toHaveBeenCalledWith(
        "_veilforms-verify.example.com"
      );
    });

    it("should handle split TXT records", async () => {
      // TXT records can be split into multiple strings
      mockResolveTxt.mockResolvedValueOnce([["vf_verify_", "token123"]]);

      const result = await verifyDnsTxtRecord("example.com", "vf_verify_token123");

      expect(result.verified).toBe(true);
    });

    it("should fail for mismatched token", async () => {
      mockResolveTxt.mockResolvedValueOnce([["wrong_token"]]);

      const result = await verifyDnsTxtRecord("example.com", "vf_verify_token123");

      expect(result.verified).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("should handle ENOTFOUND error", async () => {
      const error = new Error("DNS record not found") as NodeJS.ErrnoException;
      error.code = "ENOTFOUND";
      mockResolveTxt.mockRejectedValueOnce(error);

      const result = await verifyDnsTxtRecord("example.com", "token");

      expect(result.verified).toBe(false);
      expect(result.error).toBe("DNS record not found");
    });

    it("should handle ENODATA error", async () => {
      const error = new Error("No data") as NodeJS.ErrnoException;
      error.code = "ENODATA";
      mockResolveTxt.mockRejectedValueOnce(error);

      const result = await verifyDnsTxtRecord("example.com", "token");

      expect(result.verified).toBe(false);
      expect(result.error).toBe("DNS record not found");
    });

    it("should handle other DNS errors", async () => {
      const error = new Error("DNS server error") as NodeJS.ErrnoException;
      error.code = "SERVFAIL";
      mockResolveTxt.mockRejectedValueOnce(error);

      const result = await verifyDnsTxtRecord("example.com", "token");

      expect(result.verified).toBe(false);
      expect(result.error).toBe("DNS lookup failed");
    });
  });

  describe("createCustomDomain", () => {
    it("should create domain with correct data", async () => {
      mockStore.get.mockResolvedValue(null); // No existing domain

      const domain = await createCustomDomain("example.com", "user_123");

      expect(domain.domain).toBe("example.com");
      expect(domain.userId).toBe("user_123");
      expect(domain.status).toBe("pending");
      expect(domain.sslStatus).toBe("pending");
      expect(domain.verificationToken).toMatch(/^vf_verify_/);
      expect(domain.createdAt).toBeGreaterThan(0);
    });

    it("should sanitize domain before storing", async () => {
      mockStore.get.mockResolvedValue(null);

      const domain = await createCustomDomain(
        "https://WWW.EXAMPLE.COM/path",
        "user_123"
      );

      expect(domain.domain).toBe("example.com");
    });

    it("should throw for invalid domain", async () => {
      await expect(createCustomDomain("invalid", "user_123")).rejects.toThrow();
    });

    it("should throw for already registered domain", async () => {
      mockStore.get.mockResolvedValueOnce({ domain: "example.com" });

      await expect(
        createCustomDomain("example.com", "user_123")
      ).rejects.toThrow("already registered");
    });

    it("should store domain and user mapping", async () => {
      mockStore.get.mockResolvedValue(null);

      await createCustomDomain("example.com", "user_123");

      // Check domain was stored
      expect(mockStore.setJSON).toHaveBeenCalledWith(
        "example.com",
        expect.objectContaining({ domain: "example.com" })
      );

      // Check domain-to-user mapping
      expect(mockStore.setJSON).toHaveBeenCalledWith("domain:example.com", {
        userId: "user_123",
      });

      // Check user domains list was updated
      expect(mockStore.setJSON).toHaveBeenCalledWith(
        "user_domains_user_123",
        expect.arrayContaining(["example.com"])
      );
    });
  });

  describe("getCustomDomain", () => {
    it("should return domain when found", async () => {
      const mockDomain: CustomDomain = {
        domain: "example.com",
        userId: "user_123",
        status: "active",
        verificationToken: "vf_verify_123",
        sslStatus: "active",
        createdAt: Date.now(),
        lastCheckedAt: Date.now(),
      };
      mockStore.get.mockResolvedValueOnce(mockDomain);

      const result = await getCustomDomain("example.com");

      expect(result).toEqual(mockDomain);
    });

    it("should return null when not found", async () => {
      mockStore.get.mockResolvedValueOnce(null);

      const result = await getCustomDomain("notfound.com");

      expect(result).toBeNull();
    });

    it("should handle storage errors gracefully", async () => {
      mockStore.get.mockRejectedValueOnce(new Error("Storage error"));

      const result = await getCustomDomain("example.com");

      expect(result).toBeNull();
    });
  });

  describe("getUserIdByDomain", () => {
    it("should return userId for valid domain", async () => {
      mockStore.get.mockResolvedValueOnce({ userId: "user_123" });

      const result = await getUserIdByDomain("example.com");

      expect(result).toBe("user_123");
      expect(mockStore.get).toHaveBeenCalledWith("domain:example.com", {
        type: "json",
      });
    });

    it("should return null for unknown domain", async () => {
      mockStore.get.mockResolvedValueOnce(null);

      const result = await getUserIdByDomain("unknown.com");

      expect(result).toBeNull();
    });
  });

  describe("getUserDomains", () => {
    it("should return all user domains", async () => {
      const domains: CustomDomain[] = [
        {
          domain: "example1.com",
          userId: "user_123",
          status: "active",
          verificationToken: "t1",
          sslStatus: "active",
          createdAt: 1000,
          lastCheckedAt: 2000,
        },
        {
          domain: "example2.com",
          userId: "user_123",
          status: "pending",
          verificationToken: "t2",
          sslStatus: "pending",
          createdAt: 1000,
          lastCheckedAt: 2000,
        },
      ];

      mockStore.get
        .mockResolvedValueOnce(["example1.com", "example2.com"]) // User domains list
        .mockResolvedValueOnce(domains[0]) // First domain
        .mockResolvedValueOnce(domains[1]); // Second domain

      const result = await getUserDomains("user_123");

      expect(result).toHaveLength(2);
      expect(result[0].domain).toBe("example1.com");
      expect(result[1].domain).toBe("example2.com");
    });

    it("should return empty array for user with no domains", async () => {
      mockStore.get.mockResolvedValueOnce(null);

      const result = await getUserDomains("user_no_domains");

      expect(result).toEqual([]);
    });

    it("should filter out null domains", async () => {
      mockStore.get
        .mockResolvedValueOnce(["example.com", "deleted.com"])
        .mockResolvedValueOnce({
          domain: "example.com",
          userId: "user_123",
          status: "active",
          verificationToken: "t",
          sslStatus: "active",
          createdAt: 1000,
          lastCheckedAt: 2000,
        })
        .mockResolvedValueOnce(null); // deleted domain

      const result = await getUserDomains("user_123");

      expect(result).toHaveLength(1);
      expect(result[0].domain).toBe("example.com");
    });
  });

  describe("updateCustomDomain", () => {
    it("should update domain with new values", async () => {
      const existingDomain: CustomDomain = {
        domain: "example.com",
        userId: "user_123",
        status: "pending",
        verificationToken: "token",
        sslStatus: "pending",
        createdAt: 1000,
        lastCheckedAt: 1000,
      };
      mockStore.get.mockResolvedValueOnce(existingDomain);

      const result = await updateCustomDomain("example.com", {
        status: "active",
      });

      expect(result?.status).toBe("active");
      expect(result?.lastCheckedAt).toBeGreaterThan(1000);
      expect(mockStore.setJSON).toHaveBeenCalledWith(
        "example.com",
        expect.objectContaining({ status: "active" })
      );
    });

    it("should return null for non-existent domain", async () => {
      mockStore.get.mockResolvedValueOnce(null);

      const result = await updateCustomDomain("notfound.com", { status: "active" });

      expect(result).toBeNull();
    });
  });

  describe("triggerDomainVerification", () => {
    it("should mark domain as active on successful verification", async () => {
      const domain: CustomDomain = {
        domain: "example.com",
        userId: "user_123",
        status: "pending",
        verificationToken: "vf_verify_token123",
        sslStatus: "pending",
        createdAt: 1000,
        lastCheckedAt: 1000,
      };
      mockStore.get.mockResolvedValue(domain);
      mockResolveTxt.mockResolvedValueOnce([["vf_verify_token123"]]);

      const result = await triggerDomainVerification("example.com");

      expect(result.success).toBe(true);
      expect(result.domain?.status).toBe("active");
      expect(result.domain?.sslStatus).toBe("provisioning");
    });

    it("should mark domain as failed on failed verification", async () => {
      const domain: CustomDomain = {
        domain: "example.com",
        userId: "user_123",
        status: "pending",
        verificationToken: "vf_verify_token123",
        sslStatus: "pending",
        createdAt: 1000,
        lastCheckedAt: 1000,
      };
      mockStore.get.mockResolvedValue(domain);
      mockResolveTxt.mockResolvedValueOnce([["wrong_token"]]);

      const result = await triggerDomainVerification("example.com");

      expect(result.success).toBe(false);
      expect(result.domain?.status).toBe("failed");
      expect(result.error).toBeDefined();
    });

    it("should return error for non-existent domain", async () => {
      mockStore.get.mockResolvedValueOnce(null);

      const result = await triggerDomainVerification("notfound.com");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Domain not found");
    });
  });

  describe("deleteCustomDomain", () => {
    it("should delete domain and cleanup", async () => {
      const domain: CustomDomain = {
        domain: "example.com",
        userId: "user_123",
        status: "active",
        verificationToken: "token",
        sslStatus: "active",
        createdAt: 1000,
        lastCheckedAt: 1000,
      };
      mockStore.get
        .mockResolvedValueOnce(domain)
        .mockResolvedValueOnce(["example.com", "other.com"]); // user domains

      const result = await deleteCustomDomain("example.com", "user_123");

      expect(result).toBe(true);
      expect(mockStore.delete).toHaveBeenCalledWith("example.com");
      expect(mockStore.delete).toHaveBeenCalledWith("domain:example.com");
      expect(mockStore.setJSON).toHaveBeenCalledWith(
        "user_domains_user_123",
        ["other.com"]
      );
    });

    it("should return false for non-existent domain", async () => {
      mockStore.get.mockResolvedValueOnce(null);

      const result = await deleteCustomDomain("notfound.com", "user_123");

      expect(result).toBe(false);
    });

    it("should throw for unauthorized deletion", async () => {
      const domain: CustomDomain = {
        domain: "example.com",
        userId: "user_456", // Different user
        status: "active",
        verificationToken: "token",
        sslStatus: "active",
        createdAt: 1000,
        lastCheckedAt: 1000,
      };
      mockStore.get.mockResolvedValueOnce(domain);

      await expect(
        deleteCustomDomain("example.com", "user_123")
      ).rejects.toThrow("Unauthorized");
    });
  });

  describe("isDomainActive", () => {
    it("should return true for active domain", async () => {
      mockStore.get.mockResolvedValueOnce({ status: "active" });

      const result = await isDomainActive("example.com");

      expect(result).toBe(true);
    });

    it("should return false for non-active domain", async () => {
      mockStore.get.mockResolvedValueOnce({ status: "pending" });

      const result = await isDomainActive("example.com");

      expect(result).toBe(false);
    });

    it("should return false for non-existent domain", async () => {
      mockStore.get.mockResolvedValueOnce(null);

      const result = await isDomainActive("notfound.com");

      expect(result).toBe(false);
    });
  });
});
