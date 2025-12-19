import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  CRMIntegrationBase,
  SalesforceIntegration,
  HubSpotIntegration,
  PipedriveIntegration,
  createCRMIntegration,
  getOAuthUrl,
  exchangeOAuthCode,
  type CRMIntegration,
  type FieldMapping,
  type CRMProvider,
} from "./crm-integrations";

// Mock encryption functions
vi.mock("./encryption", () => ({
  encryptToken: (token: string) => JSON.stringify({ encrypted: token }),
  decryptToken: (encrypted: string) => JSON.parse(encrypted).encrypted,
}));

// Mock logger
vi.mock("./logger", () => ({
  apiLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Helper to create mock integration
function createMockIntegration(
  provider: CRMProvider,
  overrides: Partial<CRMIntegration> = {}
): CRMIntegration {
  return {
    id: "int_123",
    provider,
    userId: "user_123",
    accessToken: JSON.stringify({ encrypted: "mock_access_token" }),
    refreshToken: JSON.stringify({ encrypted: "mock_refresh_token" }),
    expiresAt: Date.now() + 3600000, // 1 hour from now
    instanceUrl:
      provider === "salesforce" ? "https://my.salesforce.com" : undefined,
    createdAt: Date.now(),
    ...overrides,
  };
}

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("crm-integrations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();

    // Set environment variables for OAuth
    process.env.SALESFORCE_CLIENT_ID = "sf_client_id";
    process.env.SALESFORCE_CLIENT_SECRET = "sf_client_secret";
    process.env.HUBSPOT_CLIENT_ID = "hs_client_id";
    process.env.HUBSPOT_CLIENT_SECRET = "hs_client_secret";
    process.env.PIPEDRIVE_CLIENT_ID = "pd_client_id";
    process.env.PIPEDRIVE_CLIENT_SECRET = "pd_client_secret";
  });

  afterEach(() => {
    delete process.env.SALESFORCE_CLIENT_ID;
    delete process.env.SALESFORCE_CLIENT_SECRET;
    delete process.env.HUBSPOT_CLIENT_ID;
    delete process.env.HUBSPOT_CLIENT_SECRET;
    delete process.env.PIPEDRIVE_CLIENT_ID;
    delete process.env.PIPEDRIVE_CLIENT_SECRET;
  });

  describe("createCRMIntegration factory", () => {
    it("should create SalesforceIntegration for salesforce provider", () => {
      const integration = createMockIntegration("salesforce");
      const crm = createCRMIntegration(integration);
      expect(crm).toBeInstanceOf(SalesforceIntegration);
    });

    it("should create HubSpotIntegration for hubspot provider", () => {
      const integration = createMockIntegration("hubspot");
      const crm = createCRMIntegration(integration);
      expect(crm).toBeInstanceOf(HubSpotIntegration);
    });

    it("should create PipedriveIntegration for pipedrive provider", () => {
      const integration = createMockIntegration("pipedrive");
      const crm = createCRMIntegration(integration);
      expect(crm).toBeInstanceOf(PipedriveIntegration);
    });

    it("should throw for unsupported provider", () => {
      const integration = createMockIntegration("salesforce");
      (integration as { provider: string }).provider = "unknown";

      expect(() => createCRMIntegration(integration)).toThrow(
        "Unsupported CRM provider"
      );
    });
  });

  describe("SalesforceIntegration", () => {
    describe("testConnection", () => {
      it("should return success for valid connection", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ sobjects: [] }),
        });

        const integration = createMockIntegration("salesforce");
        const crm = new SalesforceIntegration(integration);

        const result = await crm.testConnection();

        expect(result.success).toBe(true);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("my.salesforce.com"),
          expect.objectContaining({
            headers: { Authorization: "Bearer mock_access_token" },
          })
        );
      });

      it("should return failure for invalid connection", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: "Unauthorized",
        });

        const integration = createMockIntegration("salesforce");
        const crm = new SalesforceIntegration(integration);

        const result = await crm.testConnection();

        expect(result.success).toBe(false);
        expect(result.error).toContain("401");
      });

      it("should handle network errors", async () => {
        mockFetch.mockRejectedValueOnce(new Error("Network error"));

        const integration = createMockIntegration("salesforce");
        const crm = new SalesforceIntegration(integration);

        const result = await crm.testConnection();

        expect(result.success).toBe(false);
        expect(result.error).toBe("Network error");
      });
    });

    describe("getFields", () => {
      it("should return mapped fields from Salesforce", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            fields: [
              { name: "FirstName", label: "First Name", type: "string", nillable: true },
              { name: "Email", label: "Email", type: "email", nillable: false },
              { name: "Phone", label: "Phone", type: "phone", nillable: true },
            ],
          }),
        });

        const integration = createMockIntegration("salesforce");
        const crm = new SalesforceIntegration(integration);

        const fields = await crm.getFields();

        expect(fields).toHaveLength(3);
        expect(fields[0]).toEqual({
          name: "FirstName",
          label: "First Name",
          type: "text",
          required: false,
        });
        expect(fields[1]).toEqual({
          name: "Email",
          label: "Email",
          type: "email",
          required: true,
        });
      });

      it("should throw on API error", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          statusText: "Forbidden",
        });

        const integration = createMockIntegration("salesforce");
        const crm = new SalesforceIntegration(integration);

        await expect(crm.getFields()).rejects.toThrow("Failed to fetch Salesforce fields");
      });
    });

    describe("syncRecord", () => {
      it("should create record with mapped fields", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: "003ABC123" }),
        });

        const integration = createMockIntegration("salesforce");
        const crm = new SalesforceIntegration(integration);

        const mappings: FieldMapping[] = [
          { formField: "name", crmField: "FirstName" },
          { formField: "email", crmField: "Email" },
        ];

        const result = await crm.syncRecord(
          { name: "John", email: "john@example.com" },
          mappings
        );

        expect(result.success).toBe(true);
        expect(result.crmRecordId).toBe("003ABC123");

        // Check the POST body
        const postCall = mockFetch.mock.calls[0];
        expect(postCall[1].method).toBe("POST");
        expect(JSON.parse(postCall[1].body)).toEqual({
          FirstName: "John",
          Email: "john@example.com",
        });
      });

      it("should return error for failed sync", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          text: async () => "Invalid field value",
        });

        const integration = createMockIntegration("salesforce");
        const crm = new SalesforceIntegration(integration);

        const result = await crm.syncRecord({ name: "John" }, [
          { formField: "name", crmField: "FirstName" },
        ]);

        expect(result.success).toBe(false);
        expect(result.error).toContain("sync failed");
      });
    });

    describe("refreshAccessToken", () => {
      it("should refresh token successfully", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: "new_access_token",
            instance_url: "https://my.salesforce.com",
          }),
        });

        const integration = createMockIntegration("salesforce");
        const crm = new SalesforceIntegration(integration);

        const result = await crm.refreshAccessToken();

        expect(result.accessToken).toBe("new_access_token");
        expect(result.expiresIn).toBe(7200);
      });

      it("should throw when credentials not configured", async () => {
        delete process.env.SALESFORCE_CLIENT_ID;

        const integration = createMockIntegration("salesforce");
        const crm = new SalesforceIntegration(integration);

        await expect(crm.refreshAccessToken()).rejects.toThrow(
          "Salesforce credentials not configured"
        );
      });
    });
  });

  describe("HubSpotIntegration", () => {
    describe("testConnection", () => {
      it("should return success for valid connection", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ results: [] }),
        });

        const integration = createMockIntegration("hubspot");
        const crm = new HubSpotIntegration(integration);

        const result = await crm.testConnection();

        expect(result.success).toBe(true);
        expect(mockFetch).toHaveBeenCalledWith(
          "https://api.hubapi.com/crm/v3/properties/contacts",
          expect.anything()
        );
      });
    });

    describe("getFields", () => {
      it("should return mapped fields from HubSpot", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            results: [
              { name: "firstname", label: "First Name", type: "string", hidden: false },
              { name: "email", label: "Email", type: "string", hidden: false },
            ],
          }),
        });

        const integration = createMockIntegration("hubspot");
        const crm = new HubSpotIntegration(integration);

        const fields = await crm.getFields();

        expect(fields).toHaveLength(2);
        expect(fields[0].name).toBe("firstname");
        expect(fields[0].type).toBe("text");
      });
    });

    describe("syncRecord", () => {
      it("should create contact with properties format", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: "12345" }),
        });

        const integration = createMockIntegration("hubspot");
        const crm = new HubSpotIntegration(integration);

        const result = await crm.syncRecord(
          { name: "John", email: "john@example.com" },
          [
            { formField: "name", crmField: "firstname" },
            { formField: "email", crmField: "email" },
          ]
        );

        expect(result.success).toBe(true);
        expect(result.crmRecordId).toBe("12345");

        const postBody = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(postBody.properties).toEqual({
          firstname: "John",
          email: "john@example.com",
        });
      });
    });

    describe("refreshAccessToken", () => {
      it("should return new tokens", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: "new_token",
            refresh_token: "new_refresh",
            expires_in: 21600,
          }),
        });

        const integration = createMockIntegration("hubspot");
        const crm = new HubSpotIntegration(integration);

        const result = await crm.refreshAccessToken();

        expect(result.accessToken).toBe("new_token");
        expect(result.refreshToken).toBe("new_refresh");
        expect(result.expiresIn).toBe(21600);
      });
    });
  });

  describe("PipedriveIntegration", () => {
    describe("testConnection", () => {
      it("should call users/me endpoint", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: { id: 1 } }),
        });

        const integration = createMockIntegration("pipedrive");
        const crm = new PipedriveIntegration(integration);

        const result = await crm.testConnection();

        expect(result.success).toBe(true);
        expect(mockFetch).toHaveBeenCalledWith(
          "https://api.pipedrive.com/v1/users/me",
          expect.anything()
        );
      });
    });

    describe("getFields", () => {
      it("should return mapped fields from Pipedrive", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: [
              { key: "name", name: "Name", field_type: "varchar", mandatory_flag: true },
              { key: "email", name: "Email", field_type: "varchar", mandatory_flag: false },
            ],
          }),
        });

        const integration = createMockIntegration("pipedrive");
        const crm = new PipedriveIntegration(integration);

        const fields = await crm.getFields();

        expect(fields).toHaveLength(2);
        expect(fields[0]).toEqual({
          name: "name",
          label: "Name",
          type: "text",
          required: true,
        });
      });

      it("should throw on invalid API response", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: false }),
        });

        const integration = createMockIntegration("pipedrive");
        const crm = new PipedriveIntegration(integration);

        await expect(crm.getFields()).rejects.toThrow("Invalid Pipedrive API response");
      });
    });

    describe("syncRecord", () => {
      it("should create person record", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: { id: 99 },
          }),
        });

        const integration = createMockIntegration("pipedrive");
        const crm = new PipedriveIntegration(integration);

        const result = await crm.syncRecord(
          { name: "John" },
          [{ formField: "name", crmField: "name" }]
        );

        expect(result.success).toBe(true);
        expect(result.crmRecordId).toBe("99");
      });

      it("should handle Pipedrive success=false response", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: false }),
        });

        const integration = createMockIntegration("pipedrive");
        const crm = new PipedriveIntegration(integration);

        const result = await crm.syncRecord(
          { name: "John" },
          [{ formField: "name", crmField: "name" }]
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain("success=false");
      });
    });
  });

  describe("Field transformations", () => {
    it("should apply uppercase transform", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "123" }),
      });

      const integration = createMockIntegration("salesforce");
      const crm = new SalesforceIntegration(integration);

      await crm.syncRecord(
        { name: "john doe" },
        [{ formField: "name", crmField: "Name", transform: "uppercase" }]
      );

      const postBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(postBody.Name).toBe("JOHN DOE");
    });

    it("should apply lowercase transform", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "123" }),
      });

      const integration = createMockIntegration("hubspot");
      const crm = new HubSpotIntegration(integration);

      await crm.syncRecord(
        { email: "JOHN@EXAMPLE.COM" },
        [{ formField: "email", crmField: "email", transform: "lowercase" }]
      );

      const postBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(postBody.properties.email).toBe("john@example.com");
    });

    it("should apply date transform", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "123" }),
      });

      const integration = createMockIntegration("salesforce");
      const crm = new SalesforceIntegration(integration);

      await crm.syncRecord(
        { date: "2024-01-15" },
        [{ formField: "date", crmField: "Date__c", transform: "date" }]
      );

      const postBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(postBody.Date__c).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("should skip transform for non-string values", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "123" }),
      });

      const integration = createMockIntegration("salesforce");
      const crm = new SalesforceIntegration(integration);

      await crm.syncRecord(
        { count: 42 },
        [{ formField: "count", crmField: "Count__c", transform: "uppercase" }]
      );

      const postBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(postBody.Count__c).toBe(42);
    });
  });

  describe("getOAuthUrl", () => {
    it("should generate Salesforce OAuth URL", () => {
      const url = getOAuthUrl(
        "salesforce",
        "https://example.com/callback",
        "state123"
      );

      expect(url).toContain("login.salesforce.com");
      expect(url).toContain("response_type=code");
      expect(url).toContain("client_id=sf_client_id");
      expect(url).toContain("redirect_uri=");
      expect(url).toContain("state=state123");
    });

    it("should generate HubSpot OAuth URL", () => {
      const url = getOAuthUrl(
        "hubspot",
        "https://example.com/callback",
        "state123"
      );

      expect(url).toContain("app.hubspot.com");
      expect(url).toContain("client_id=hs_client_id");
      expect(url).toContain("scope=");
    });

    it("should generate Pipedrive OAuth URL", () => {
      const url = getOAuthUrl(
        "pipedrive",
        "https://example.com/callback",
        "state123"
      );

      expect(url).toContain("oauth.pipedrive.com");
      expect(url).toContain("client_id=pd_client_id");
    });

    it("should throw for missing client ID", () => {
      delete process.env.SALESFORCE_CLIENT_ID;

      expect(() =>
        getOAuthUrl("salesforce", "https://example.com/callback", "state")
      ).toThrow("client ID not configured");
    });

    it("should throw for unsupported provider", () => {
      expect(() =>
        getOAuthUrl("unknown" as CRMProvider, "https://example.com/callback", "state")
      ).toThrow("Unsupported provider");
    });
  });

  describe("exchangeOAuthCode", () => {
    it("should exchange Salesforce code for tokens", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "sf_access",
          refresh_token: "sf_refresh",
          instance_url: "https://na1.salesforce.com",
        }),
      });

      const result = await exchangeOAuthCode(
        "salesforce",
        "auth_code",
        "https://example.com/callback"
      );

      expect(result.accessToken).toBe("sf_access");
      expect(result.refreshToken).toBe("sf_refresh");
      expect(result.instanceUrl).toBe("https://na1.salesforce.com");
    });

    it("should exchange HubSpot code for tokens", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "hs_access",
          refresh_token: "hs_refresh",
          expires_in: 21600,
        }),
      });

      const result = await exchangeOAuthCode(
        "hubspot",
        "auth_code",
        "https://example.com/callback"
      );

      expect(result.accessToken).toBe("hs_access");
      expect(result.refreshToken).toBe("hs_refresh");
      expect(result.expiresIn).toBe(21600);
    });

    it("should exchange Pipedrive code for tokens", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "pd_access",
          refresh_token: "pd_refresh",
          expires_in: 3600,
        }),
      });

      const result = await exchangeOAuthCode(
        "pipedrive",
        "auth_code",
        "https://example.com/callback"
      );

      expect(result.accessToken).toBe("pd_access");
      expect(result.refreshToken).toBe("pd_refresh");
    });

    it("should throw on OAuth error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => "Invalid authorization code",
      });

      await expect(
        exchangeOAuthCode("salesforce", "bad_code", "https://example.com/callback")
      ).rejects.toThrow("OAuth failed");
    });

    it("should throw for missing credentials", async () => {
      delete process.env.HUBSPOT_CLIENT_ID;

      await expect(
        exchangeOAuthCode("hubspot", "code", "https://example.com/callback")
      ).rejects.toThrow("credentials not configured");
    });
  });

  describe("Retry logic", () => {
    it("should retry on transient errors", async () => {
      // First call fails, second succeeds
      mockFetch
        .mockRejectedValueOnce(new Error("Connection reset"))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: "123" }),
        });

      const integration = createMockIntegration("salesforce");
      const crm = new SalesforceIntegration(integration);

      const result = await crm.syncRecord(
        { name: "John" },
        [{ formField: "name", crmField: "FirstName" }]
      );

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should not retry on auth errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("401 Unauthorized"));

      const integration = createMockIntegration("salesforce");
      const crm = new SalesforceIntegration(integration);

      await expect(
        crm.syncRecord({ name: "John" }, [
          { formField: "name", crmField: "FirstName" },
        ])
      ).rejects.toThrow("Unauthorized");

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});
