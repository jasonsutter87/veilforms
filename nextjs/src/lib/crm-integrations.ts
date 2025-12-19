/**
 * VeilForms - CRM Integration Library
 * Handles OAuth, field mapping, and syncing with CRM platforms
 *
 * Supported CRMs:
 * - Salesforce
 * - HubSpot
 * - Pipedrive
 */

import { apiLogger } from "./logger";
import { encryptToken, decryptToken } from "./encryption";

// ============================================================================
// TYPES
// ============================================================================

export type CRMProvider = "salesforce" | "hubspot" | "pipedrive";

export type FieldTransform = "none" | "uppercase" | "lowercase" | "date";

export interface CRMIntegration {
  id: string;
  provider: CRMProvider;
  userId: string;
  accessToken: string; // encrypted
  refreshToken: string; // encrypted
  expiresAt: number;
  instanceUrl?: string; // Salesforce-specific
  createdAt: number;
  updatedAt?: number;
}

export interface FormIntegration {
  id: string;
  formId: string;
  integrationId: string;
  enabled: boolean;
  fieldMappings: FieldMapping[];
  syncOnSubmit: boolean;
  createdAt: number;
  updatedAt?: number;
}

export interface FieldMapping {
  formField: string;
  crmField: string;
  transform?: FieldTransform;
}

export interface CRMField {
  name: string;
  label: string;
  type: string;
  required: boolean;
}

export interface SyncResult {
  success: boolean;
  crmRecordId?: string;
  error?: string;
}

// ============================================================================
// ABSTRACT CRM INTEGRATION CLASS
// ============================================================================

export abstract class CRMIntegrationBase {
  protected provider: CRMProvider;
  protected accessToken: string;
  protected refreshToken: string;
  protected expiresAt: number;
  protected instanceUrl?: string;

  constructor(integration: CRMIntegration) {
    this.provider = integration.provider;
    this.accessToken = decryptToken(integration.accessToken);
    this.refreshToken = decryptToken(integration.refreshToken);
    this.expiresAt = integration.expiresAt;
    this.instanceUrl = integration.instanceUrl;
  }

  /**
   * Check if access token is expired
   */
  protected isTokenExpired(): boolean {
    return Date.now() >= this.expiresAt;
  }

  /**
   * Refresh OAuth token
   */
  abstract refreshAccessToken(): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn: number;
  }>;

  /**
   * Test the connection
   */
  abstract testConnection(): Promise<{ success: boolean; error?: string }>;

  /**
   * Get available fields from CRM
   */
  abstract getFields(): Promise<CRMField[]>;

  /**
   * Create or update a record in the CRM
   */
  abstract syncRecord(
    data: Record<string, unknown>,
    fieldMappings: FieldMapping[]
  ): Promise<SyncResult>;

  /**
   * Transform field value based on mapping
   */
  protected transformValue(value: unknown, transform?: FieldTransform): unknown {
    if (transform === "none" || !transform) {
      return value;
    }

    if (typeof value !== "string") {
      return value;
    }

    switch (transform) {
      case "uppercase":
        return value.toUpperCase();
      case "lowercase":
        return value.toLowerCase();
      case "date":
        const date = new Date(value);
        return isNaN(date.getTime()) ? value : date.toISOString();
      default:
        return value;
    }
  }

  /**
   * Apply field mappings to data
   */
  protected applyFieldMappings(
    data: Record<string, unknown>,
    mappings: FieldMapping[]
  ): Record<string, unknown> {
    const mapped: Record<string, unknown> = {};

    for (const mapping of mappings) {
      const value = data[mapping.formField];
      if (value !== undefined) {
        mapped[mapping.crmField] = this.transformValue(value, mapping.transform);
      }
    }

    return mapped;
  }

  /**
   * Retry logic for API calls with exponential backoff
   */
  protected async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    initialDelay = 1000
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        if (this.isAuthError(error)) {
          throw error;
        }

        if (attempt === maxRetries - 1) {
          throw error;
        }

        const delay = initialDelay * Math.pow(2, attempt);
        apiLogger.warn(
          { attempt: attempt + 1, delay, error },
          "Retrying CRM API call"
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  /**
   * Check if error is an authentication error
   */
  protected isAuthError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes("unauthorized") ||
        message.includes("401") ||
        message.includes("invalid token") ||
        message.includes("expired")
      );
    }
    return false;
  }
}

// ============================================================================
// SALESFORCE INTEGRATION
// ============================================================================

export class SalesforceIntegration extends CRMIntegrationBase {
  private static readonly API_VERSION = "v59.0";

  async refreshAccessToken(): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn: number;
  }> {
    const clientId = process.env.SALESFORCE_CLIENT_ID;
    const clientSecret = process.env.SALESFORCE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("Salesforce credentials not configured");
    }

    const response = await fetch("https://login.salesforce.com/services/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: this.refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Salesforce token refresh failed: ${error}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      expiresIn: 7200,
    };
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(
        `${this.instanceUrl}/services/data/${SalesforceIntegration.API_VERSION}/sobjects/`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        return {
          success: false,
          error: `Connection failed: ${response.status} ${response.statusText}`,
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async getFields(): Promise<CRMField[]> {
    const response = await fetch(
      `${this.instanceUrl}/services/data/${SalesforceIntegration.API_VERSION}/sobjects/Contact/describe`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch Salesforce fields: ${response.statusText}`);
    }

    const data = await response.json();

    return data.fields.map((field: { name: string; label: string; type: string; nillable: boolean }) => ({
      name: field.name,
      label: field.label,
      type: this.mapSalesforceFieldType(field.type),
      required: !field.nillable,
    }));
  }

  async syncRecord(
    data: Record<string, unknown>,
    fieldMappings: FieldMapping[]
  ): Promise<SyncResult> {
    const mappedData = this.applyFieldMappings(data, fieldMappings);

    return this.retryWithBackoff(async () => {
      const response = await fetch(
        `${this.instanceUrl}/services/data/${SalesforceIntegration.API_VERSION}/sobjects/Contact/`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(mappedData),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          error: `Salesforce sync failed: ${error}`,
        };
      }

      const result = await response.json();

      return {
        success: true,
        crmRecordId: result.id,
      };
    });
  }

  private mapSalesforceFieldType(sfType: string): string {
    const typeMap: Record<string, string> = {
      string: "text",
      email: "email",
      phone: "phone",
      url: "url",
      date: "date",
      datetime: "datetime",
      boolean: "boolean",
      int: "number",
      double: "number",
      currency: "number",
      percent: "number",
      textarea: "textarea",
      picklist: "select",
      multipicklist: "multiselect",
    };

    return typeMap[sfType.toLowerCase()] || "text";
  }
}

// ============================================================================
// HUBSPOT INTEGRATION
// ============================================================================

export class HubSpotIntegration extends CRMIntegrationBase {
  async refreshAccessToken(): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    const clientId = process.env.HUBSPOT_CLIENT_ID;
    const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("HubSpot credentials not configured");
    }

    const response = await fetch("https://api.hubapi.com/oauth/v1/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: this.refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HubSpot token refresh failed: ${error}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch("https://api.hubapi.com/crm/v3/properties/contacts", {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Connection failed: ${response.status} ${response.statusText}`,
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async getFields(): Promise<CRMField[]> {
    const response = await fetch("https://api.hubapi.com/crm/v3/properties/contacts", {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch HubSpot fields: ${response.statusText}`);
    }

    const data = await response.json();

    return data.results.map((field: { name: string; label: string; type: string; hidden: boolean }) => ({
      name: field.name,
      label: field.label,
      type: this.mapHubSpotFieldType(field.type),
      required: !field.hidden,
    }));
  }

  async syncRecord(
    data: Record<string, unknown>,
    fieldMappings: FieldMapping[]
  ): Promise<SyncResult> {
    const mappedData = this.applyFieldMappings(data, fieldMappings);

    const properties: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(mappedData)) {
      properties[key] = value;
    }

    return this.retryWithBackoff(async () => {
      const response = await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ properties }),
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          error: `HubSpot sync failed: ${error}`,
        };
      }

      const result = await response.json();

      return {
        success: true,
        crmRecordId: result.id,
      };
    });
  }

  private mapHubSpotFieldType(hsType: string): string {
    const typeMap: Record<string, string> = {
      string: "text",
      enumeration: "select",
      date: "date",
      datetime: "datetime",
      number: "number",
      bool: "boolean",
      phone_number: "phone",
    };

    return typeMap[hsType.toLowerCase()] || "text";
  }
}

// ============================================================================
// PIPEDRIVE INTEGRATION
// ============================================================================

export class PipedriveIntegration extends CRMIntegrationBase {
  async refreshAccessToken(): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    const clientId = process.env.PIPEDRIVE_CLIENT_ID;
    const clientSecret = process.env.PIPEDRIVE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("Pipedrive credentials not configured");
    }

    const response = await fetch("https://oauth.pipedrive.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: this.refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Pipedrive token refresh failed: ${error}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch("https://api.pipedrive.com/v1/users/me", {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Connection failed: ${response.status} ${response.statusText}`,
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async getFields(): Promise<CRMField[]> {
    const response = await fetch("https://api.pipedrive.com/v1/personFields", {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Pipedrive fields: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.success || !data.data) {
      throw new Error("Invalid Pipedrive API response");
    }

    return data.data.map((field: { key: string; name: string; field_type: string; mandatory_flag: boolean }) => ({
      name: field.key,
      label: field.name,
      type: this.mapPipedriveFieldType(field.field_type),
      required: field.mandatory_flag,
    }));
  }

  async syncRecord(
    data: Record<string, unknown>,
    fieldMappings: FieldMapping[]
  ): Promise<SyncResult> {
    const mappedData = this.applyFieldMappings(data, fieldMappings);

    return this.retryWithBackoff(async () => {
      const response = await fetch("https://api.pipedrive.com/v1/persons", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(mappedData),
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          error: `Pipedrive sync failed: ${error}`,
        };
      }

      const result = await response.json();

      if (!result.success) {
        return {
          success: false,
          error: "Pipedrive API returned success=false",
        };
      }

      return {
        success: true,
        crmRecordId: result.data.id.toString(),
      };
    });
  }

  private mapPipedriveFieldType(pdType: string): string {
    const typeMap: Record<string, string> = {
      varchar: "text",
      text: "textarea",
      enum: "select",
      set: "multiselect",
      date: "date",
      int: "number",
      double: "number",
      monetary: "number",
      phone: "phone",
      user: "select",
      org: "select",
      people: "select",
    };

    return typeMap[pdType.toLowerCase()] || "text";
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createCRMIntegration(
  integration: CRMIntegration
): CRMIntegrationBase {
  switch (integration.provider) {
    case "salesforce":
      return new SalesforceIntegration(integration);
    case "hubspot":
      return new HubSpotIntegration(integration);
    case "pipedrive":
      return new PipedriveIntegration(integration);
    default:
      throw new Error(`Unsupported CRM provider: ${integration.provider}`);
  }
}

// ============================================================================
// OAuth URL GENERATORS
// ============================================================================

export function getOAuthUrl(
  provider: CRMProvider,
  redirectUri: string,
  state: string
): string {
  switch (provider) {
    case "salesforce": {
      const clientId = process.env.SALESFORCE_CLIENT_ID;
      if (!clientId) throw new Error("Salesforce client ID not configured");

      return `https://login.salesforce.com/services/oauth2/authorize?${new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: redirectUri,
        state,
        scope: "api refresh_token",
      })}`;
    }

    case "hubspot": {
      const clientId = process.env.HUBSPOT_CLIENT_ID;
      if (!clientId) throw new Error("HubSpot client ID not configured");

      return `https://app.hubspot.com/oauth/authorize?${new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: "crm.objects.contacts.write crm.schemas.contacts.read",
        state,
      })}`;
    }

    case "pipedrive": {
      const clientId = process.env.PIPEDRIVE_CLIENT_ID;
      if (!clientId) throw new Error("Pipedrive client ID not configured");

      return `https://oauth.pipedrive.com/oauth/authorize?${new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        state,
      })}`;
    }

    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

export async function exchangeOAuthCode(
  provider: CRMProvider,
  code: string,
  redirectUri: string
): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  instanceUrl?: string;
}> {
  switch (provider) {
    case "salesforce": {
      const clientId = process.env.SALESFORCE_CLIENT_ID;
      const clientSecret = process.env.SALESFORCE_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        throw new Error("Salesforce credentials not configured");
      }

      const response = await fetch("https://login.salesforce.com/services/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Salesforce OAuth failed: ${error}`);
      }

      const data = await response.json();

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: 7200,
        instanceUrl: data.instance_url,
      };
    }

    case "hubspot": {
      const clientId = process.env.HUBSPOT_CLIENT_ID;
      const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        throw new Error("HubSpot credentials not configured");
      }

      const response = await fetch("https://api.hubapi.com/oauth/v1/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`HubSpot OAuth failed: ${error}`);
      }

      const data = await response.json();

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
      };
    }

    case "pipedrive": {
      const clientId = process.env.PIPEDRIVE_CLIENT_ID;
      const clientSecret = process.env.PIPEDRIVE_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        throw new Error("Pipedrive credentials not configured");
      }

      const response = await fetch("https://oauth.pipedrive.com/oauth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Pipedrive OAuth failed: ${error}`);
      }

      const data = await response.json();

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
      };
    }

    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}
