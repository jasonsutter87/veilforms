# VeilForms CRM Integration Implementation Guide

This document outlines the CRM integration system added to VeilForms. The core libraries have been implemented, and this guide shows how to complete the API routes.

## What's Been Implemented

### 1. Core Libraries

- **`src/lib/encryption.ts`**: Server-side encryption for OAuth tokens using AES-256-GCM
- **`src/lib/crm-integrations.ts`**: CRM integration classes for Salesforce, HubSpot, and Pipedrive
- **`src/lib/storage.ts`**: Storage functions for CRM integrations and form integrations

### 2. Data Models

```typescript
interface CRMIntegration {
  id: string;
  provider: 'salesforce' | 'hubspot' | 'pipedrive';
  userId: string;
  accessToken: string; // encrypted
  refreshToken: string; // encrypted
  expiresAt: number;
  instanceUrl?: string; // Salesforce-specific
  createdAt: number;
  updatedAt?: number;
}

interface FormIntegration {
  id: string;
  formId: string;
  integrationId: string;
  enabled: boolean;
  fieldMappings: FieldMapping[];
  syncOnSubmit: boolean;
  createdAt: number;
  updatedAt?: number;
}

interface FieldMapping {
  formField: string;
  crmField: string;
  transform?: 'none' | 'uppercase' | 'lowercase' | 'date';
}
```

## Required API Routes

### 1. List Available Integrations

**File**: `src/app/api/integrations/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { authRoute } from "@/lib/route-handler";
import { getUserCRMIntegrations } from "@/lib/storage";

export const GET = authRoute(
  async (req: NextRequest, { user }) => {
    const integrations = await getUserCRMIntegrations(user.userId);

    return NextResponse.json({
      available: [
        {
          provider: "salesforce",
          name: "Salesforce",
          description: "Sync form submissions to Salesforce contacts",
          configured: !!process.env.SALESFORCE_CLIENT_ID,
        },
        {
          provider: "hubspot",
          name: "HubSpot",
          description: "Sync form submissions to HubSpot contacts",
          configured: !!process.env.HUBSPOT_CLIENT_ID,
        },
        {
          provider: "pipedrive",
          name: "Pipedrive",
          description: "Sync form submissions to Pipedrive persons",
          configured: !!process.env.PIPEDRIVE_CLIENT_ID,
        },
      ],
      connected: integrations.map((int) => ({
        id: int.id,
        provider: int.provider,
        createdAt: int.createdAt,
      })),
    });
  },
  { rateLimit: { keyPrefix: "integrations-list", maxRequests: 30 } }
);
```

### 2. Manage Provider Connection

**File**: `src/app/api/integrations/[provider]/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { authRoute } from "@/lib/route-handler";
import { getUserCRMIntegrations, deleteCRMIntegration } from "@/lib/storage";
import { errorResponse, ErrorCodes } from "@/lib/errors";
import { apiLogger } from "@/lib/logger";
import { getOAuthUrl } from "@/lib/crm-integrations";

type RouteParams = { params: Promise<{ provider: string }> };

// GET - Get connection status or OAuth URL
export const GET = authRoute(
  async (req: NextRequest, { user }, { params }: RouteParams) => {
    const { provider } = await params;

    if (!["salesforce", "hubspot", "pipedrive"].includes(provider)) {
      return errorResponse(ErrorCodes.VALIDATION_ERROR, {
        message: "Invalid provider",
      });
    }

    const integrations = await getUserCRMIntegrations(user.userId);
    const existing = integrations.find((i) => i.provider === provider);

    if (existing) {
      return NextResponse.json({
        connected: true,
        integration: {
          id: existing.id,
          provider: existing.provider,
          createdAt: existing.createdAt,
        },
      });
    }

    // Generate OAuth URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://veilforms.com";
    const redirectUri = `${baseUrl}/api/integrations/${provider}/auth`;
    const state = Buffer.from(JSON.stringify({ userId: user.userId })).toString("base64");

    try {
      const authUrl = getOAuthUrl(provider as any, redirectUri, state);

      return NextResponse.json({
        connected: false,
        authUrl,
      });
    } catch (error) {
      apiLogger.error({ provider, error }, "Failed to generate OAuth URL");
      return errorResponse(ErrorCodes.SERVER_ERROR, {
        message: "CRM provider not configured",
      });
    }
  },
  { rateLimit: { keyPrefix: "integrations-connect", maxRequests: 20 } }
);

// DELETE - Disconnect integration
export const DELETE = authRoute(
  async (req: NextRequest, { user }, { params }: RouteParams) => {
    const { provider } = await params;

    const integrations = await getUserCRMIntegrations(user.userId);
    const existing = integrations.find((i) => i.provider === provider);

    if (!existing) {
      return errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, {
        message: "Integration not found",
      });
    }

    await deleteCRMIntegration(existing.id, user.userId);

    return NextResponse.json({
      success: true,
      message: "Integration disconnected",
    });
  },
  { rateLimit: { keyPrefix: "integrations-disconnect", maxRequests: 10 } }
);
```

### 3. OAuth Callback Handler

**File**: `src/app/api/integrations/[provider]/auth/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { publicRoute } from "@/lib/route-handler";
import { createCRMIntegration } from "@/lib/storage";
import { exchangeOAuthCode } from "@/lib/crm-integrations";
import { encryptToken } from "@/lib/encryption";
import { errorResponse, ErrorCodes } from "@/lib/errors";
import { apiLogger } from "@/lib/logger";

type RouteParams = { params: Promise<{ provider: string }> };

export const GET = publicRoute(
  async (req: NextRequest, { params }: RouteParams) => {
    const { provider } = await params;
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      return NextResponse.redirect(
        new URL(`/dashboard/integrations?error=${encodeURIComponent(error)}`, req.url)
      );
    }

    if (!code || !state) {
      return errorResponse(ErrorCodes.VALIDATION_ERROR, {
        message: "Missing code or state parameter",
      });
    }

    try {
      // Decode state to get userId
      const { userId } = JSON.parse(Buffer.from(state, "base64").toString());

      // Exchange code for tokens
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://veilforms.com";
      const redirectUri = `${baseUrl}/api/integrations/${provider}/auth`;

      const tokens = await exchangeOAuthCode(provider as any, code, redirectUri);

      // Encrypt and store tokens
      await createCRMIntegration({
        provider: provider as any,
        userId,
        accessToken: encryptToken(tokens.accessToken),
        refreshToken: encryptToken(tokens.refreshToken),
        expiresAt: Date.now() + tokens.expiresIn * 1000,
        instanceUrl: tokens.instanceUrl,
      });

      // Redirect to dashboard
      return NextResponse.redirect(
        new URL("/dashboard/integrations?success=true", req.url)
      );
    } catch (error) {
      apiLogger.error({ provider, error }, "OAuth callback failed");
      return NextResponse.redirect(
        new URL(
          `/dashboard/integrations?error=${encodeURIComponent("Authentication failed")}`,
          req.url
        )
      );
    }
  },
  { rateLimit: { keyPrefix: "oauth-callback", maxRequests: 10 } }
);
```

### 4. Test Connection

**File**: `src/app/api/integrations/[provider]/test/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { authRoute } from "@/lib/route-handler";
import { getUserCRMIntegrations, getCRMIntegration } from "@/lib/storage";
import { createCRMIntegration } from "@/lib/crm-integrations";
import { errorResponse, ErrorCodes } from "@/lib/errors";
import { apiLogger } from "@/lib/logger";

type RouteParams = { params: Promise<{ provider: string }> };

export const GET = authRoute(
  async (req: NextRequest, { user }, { params }: RouteParams) => {
    const { provider } = await params;

    const integrations = await getUserCRMIntegrations(user.userId);
    const integration = integrations.find((i) => i.provider === provider);

    if (!integration) {
      return errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, {
        message: "Integration not found",
      });
    }

    try {
      const crm = createCRMIntegration(integration);
      const result = await crm.testConnection();

      return NextResponse.json(result);
    } catch (error) {
      apiLogger.error({ provider, error }, "Connection test failed");
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
  { rateLimit: { keyPrefix: "integration-test", maxRequests: 10 } }
);
```

### 5. Get CRM Fields

**File**: `src/app/api/integrations/[provider]/fields/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { authRoute } from "@/lib/route-handler";
import { getUserCRMIntegrations } from "@/lib/storage";
import { createCRMIntegration } from "@/lib/crm-integrations";
import { errorResponse, ErrorCodes } from "@/lib/errors";
import { apiLogger } from "@/lib/logger";

type RouteParams = { params: Promise<{ provider: string }> };

export const GET = authRoute(
  async (req: NextRequest, { user }, { params }: RouteParams) => {
    const { provider } = await params;

    const integrations = await getUserCRMIntegrations(user.userId);
    const integration = integrations.find((i) => i.provider === provider);

    if (!integration) {
      return errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, {
        message: "Integration not found",
      });
    }

    try {
      const crm = createCRMIntegration(integration);
      const fields = await crm.getFields();

      return NextResponse.json({ fields });
    } catch (error) {
      apiLogger.error({ provider, error }, "Failed to fetch CRM fields");
      return errorResponse(ErrorCodes.EXTERNAL_SERVICE_ERROR, {
        message: "Failed to fetch CRM fields",
      });
    }
  },
  { rateLimit: { keyPrefix: "crm-fields", maxRequests: 30 } }
);
```

### 6. Form Integrations

**File**: `src/app/api/forms/[id]/integrations/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { authRoute } from "@/lib/route-handler";
import { verifyFormOwnership } from "@/lib/form-helpers";
import { getFormIntegrations, createFormIntegration, getCRMIntegration } from "@/lib/storage";
import { errorResponse, ErrorCodes } from "@/lib/errors";
import { isValidFormId } from "@/lib/validation";

type RouteParams = { params: Promise<{ id: string }> };

// GET - List form integrations
export const GET = authRoute(
  async (req: NextRequest, { user }, { params }: RouteParams) => {
    const { id: formId } = await params;

    if (!isValidFormId(formId)) {
      return errorResponse(ErrorCodes.VALIDATION_INVALID_FORMAT);
    }

    const { form, error } = await verifyFormOwnership(formId, user.userId);
    if (error) return error;

    const integrations = await getFormIntegrations(formId);

    // Enrich with CRM integration details
    const enriched = await Promise.all(
      integrations.map(async (int) => {
        const crmInt = await getCRMIntegration(int.integrationId);
        return {
          ...int,
          provider: crmInt?.provider,
        };
      })
    );

    return NextResponse.json({ integrations: enriched });
  },
  { rateLimit: { keyPrefix: "form-integrations-list", maxRequests: 30 } }
);

// POST - Create form integration
export const POST = authRoute(
  async (req: NextRequest, { user }, { params }: RouteParams) => {
    const { id: formId } = await params;

    if (!isValidFormId(formId)) {
      return errorResponse(ErrorCodes.VALIDATION_INVALID_FORMAT);
    }

    const { form, error } = await verifyFormOwnership(formId, user.userId);
    if (error) return error;

    const body = await req.json();
    const { integrationId, fieldMappings, syncOnSubmit = true } = body;

    if (!integrationId || !Array.isArray(fieldMappings)) {
      return errorResponse(ErrorCodes.VALIDATION_MISSING_FIELD);
    }

    // Verify integration exists and belongs to user
    const crmInt = await getCRMIntegration(integrationId);
    if (!crmInt || crmInt.userId !== user.userId) {
      return errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, {
        message: "CRM integration not found",
      });
    }

    const formIntegration = await createFormIntegration({
      formId,
      integrationId,
      enabled: true,
      fieldMappings,
      syncOnSubmit,
    });

    return NextResponse.json({ integration: formIntegration }, { status: 201 });
  },
  { rateLimit: { keyPrefix: "form-integrations-create", maxRequests: 10 } }
);
```

**File**: `src/app/api/forms/[id]/integrations/[integrationId]/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { authRoute } from "@/lib/route-handler";
import { verifyFormOwnership } from "@/lib/form-helpers";
import { getFormIntegration, updateFormIntegration, deleteFormIntegration } from "@/lib/storage";
import { errorResponse, ErrorCodes } from "@/lib/errors";
import { isValidFormId } from "@/lib/validation";

type RouteParams = { params: Promise<{ id: string; integrationId: string }> };

// PATCH - Update form integration
export const PATCH = authRoute(
  async (req: NextRequest, { user }, { params }: RouteParams) => {
    const { id: formId, integrationId } = await params;

    if (!isValidFormId(formId)) {
      return errorResponse(ErrorCodes.VALIDATION_INVALID_FORMAT);
    }

    const { form, error } = await verifyFormOwnership(formId, user.userId);
    if (error) return error;

    const formInt = await getFormIntegration(integrationId);
    if (!formInt || formInt.formId !== formId) {
      return errorResponse(ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const body = await req.json();
    const { enabled, fieldMappings, syncOnSubmit } = body;

    const updated = await updateFormIntegration(integrationId, {
      ...(enabled !== undefined && { enabled }),
      ...(fieldMappings && { fieldMappings }),
      ...(syncOnSubmit !== undefined && { syncOnSubmit }),
    });

    return NextResponse.json({ integration: updated });
  },
  { rateLimit: { keyPrefix: "form-integrations-update", maxRequests: 10 } }
);

// DELETE - Remove form integration
export const DELETE = authRoute(
  async (req: NextRequest, { user }, { params }: RouteParams) => {
    const { id: formId, integrationId } = await params;

    if (!isValidFormId(formId)) {
      return errorResponse(ErrorCodes.VALIDATION_INVALID_FORMAT);
    }

    const { form, error } = await verifyFormOwnership(formId, user.userId);
    if (error) return error;

    const formInt = await getFormIntegration(integrationId);
    if (!formInt || formInt.formId !== formId) {
      return errorResponse(ErrorCodes.RESOURCE_NOT_FOUND);
    }

    await deleteFormIntegration(integrationId, formId);

    return NextResponse.json({ success: true });
  },
  { rateLimit: { keyPrefix: "form-integrations-delete", maxRequests: 10 } }
);
```

## Environment Variables

Add these to `.env` or Netlify environment variables:

```bash
# Server-side encryption key (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
ENCRYPTION_KEY=your_64_character_hex_string

# Salesforce OAuth
SALESFORCE_CLIENT_ID=your_salesforce_client_id
SALESFORCE_CLIENT_SECRET=your_salesforce_client_secret

# HubSpot OAuth
HUBSPOT_CLIENT_ID=your_hubspot_client_id
HUBSPOT_CLIENT_SECRET=your_hubspot_client_secret

# Pipedrive OAuth
PIPEDRIVE_CLIENT_ID=your_pipedrive_client_id
PIPEDRIVE_CLIENT_SECRET=your_pipedrive_client_secret
```

## Integration into Submission Flow

The submission flow integration is added in `src/app/api/submit/route.ts`. Add this after the Zapier webhook section:

```typescript
// Fire CRM integrations if configured (async, don't wait)
const formIntegrations = await getFormIntegrations(formId);
const enabledIntegrations = formIntegrations.filter(
  (fi) => fi.enabled && fi.syncOnSubmit
);

if (enabledIntegrations.length > 0 && decryptedData) {
  // Import CRM sync functions
  const { syncToCRM } = await import("@/lib/crm-sync");

  // Sync to each enabled integration
  for (const formInt of enabledIntegrations) {
    syncToCRM(formInt, decryptedData).catch((err) => {
      apiLogger.error(
        { formId, submissionId, integrationId: formInt.id, error: err.message },
        "CRM sync error"
      );
    });
  }
}
```

Create `src/lib/crm-sync.ts`:

```typescript
import { apiLogger } from "./logger";
import { getCRMIntegration, updateCRMIntegration, FormIntegrationData } from "./storage";
import { createCRMIntegration } from "./crm-integrations";
import { encryptToken } from "./encryption";

export async function syncToCRM(
  formIntegration: FormIntegrationData,
  data: Record<string, unknown>
): Promise<void> {
  try {
    const crmIntegration = await getCRMIntegration(formIntegration.integrationId);
    if (!crmIntegration) {
      throw new Error("CRM integration not found");
    }

    // Check if token is expired and refresh if needed
    if (Date.now() >= crmIntegration.expiresAt) {
      const crm = createCRMIntegration(crmIntegration);
      const refreshed = await crm.refreshAccessToken();

      await updateCRMIntegration(crmIntegration.id, {
        accessToken: encryptToken(refreshed.accessToken),
        refreshToken: refreshed.refreshToken
          ? encryptToken(refreshed.refreshToken)
          : crmIntegration.refreshToken,
        expiresAt: Date.now() + refreshed.expiresIn * 1000,
      });

      // Reload integration with new tokens
      crmIntegration.accessToken = encryptToken(refreshed.accessToken);
      if (refreshed.refreshToken) {
        crmIntegration.refreshToken = encryptToken(refreshed.refreshToken);
      }
      crmIntegration.expiresAt = Date.now() + refreshed.expiresIn * 1000;
    }

    // Sync to CRM
    const crm = createCRMIntegration(crmIntegration);
    const result = await crm.syncRecord(data, formIntegration.fieldMappings);

    if (result.success) {
      apiLogger.info(
        {
          provider: crmIntegration.provider,
          crmRecordId: result.crmRecordId,
        },
        "CRM sync successful"
      );
    } else {
      apiLogger.error(
        { provider: crmIntegration.provider, error: result.error },
        "CRM sync failed"
      );
    }
  } catch (error) {
    apiLogger.error({ error }, "CRM sync error");
    throw error;
  }
}
```

## Security Notes

1. **Metadata-Only Webhooks**: Like Zapier, CRM integrations receive metadata only by default since form data is client-side encrypted. Full data sync requires user's private key.

2. **Token Encryption**: OAuth tokens are encrypted at rest using AES-256-GCM with per-record salts.

3. **Token Refresh**: Access tokens are automatically refreshed when expired before syncing.

4. **Rate Limiting**: All API routes include rate limiting to prevent abuse.

5. **User Isolation**: Integrations are tied to userId - users can only access their own integrations.

## Next Steps

1. Create the remaining API route files in their respective directories
2. Add frontend UI for managing CRM integrations in the dashboard
3. Test OAuth flows with each provider
4. Add audit logging for CRM sync events
5. Consider adding webhook support for bidirectional sync

## Testing

1. Generate encryption key: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
2. Set up OAuth apps in Salesforce/HubSpot/Pipedrive developer portals
3. Configure environment variables
4. Test OAuth flow: Visit `/dashboard/integrations` and connect a CRM
5. Test field mapping: Create a form integration with field mappings
6. Test sync: Submit a form and verify data appears in CRM
