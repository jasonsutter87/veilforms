/**
 * VeilForms - Storage Library
 * Netlify Blobs storage operations for users, forms, submissions, etc.
 */

import { getStore } from "@netlify/blobs";
import { storageLogger } from "./logger";
import { retryStorage } from "./retry";
import {
  getCachedUser,
  getCachedForm,
  invalidateUserCache,
  invalidateFormCache,
} from "./cache";
import type { ConditionalLogic } from "./conditional-logic";

// Store names
const STORES = {
  USERS: "vf-users",
  FORMS: "vf-forms",
  SUBMISSIONS: "vf-submissions",
  API_KEYS: "vf-api-keys",
  PASSWORD_RESET_TOKENS: "vf-password-reset-tokens",
  EMAIL_VERIFICATION_TOKENS: "vf-email-verification-tokens",
};

// Type definitions
export interface User {
  id: string;
  email: string;
  passwordHash: string | null;
  oauthProvider?: string;
  oauthProviderId?: string;
  name?: string | null;
  createdAt: string;
  updatedAt?: string;
  subscription: string;
  forms: string[];
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  onboardingCompleted: boolean;
  onboardingStep: number;
}

export interface FormField {
  id?: string;
  type: string;
  label: string;
  name: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  validation?: Record<string, unknown>;
  conditionalLogic?: ConditionalLogic;
}

export interface Form {
  id: string;
  userId: string;
  name: string;
  publicKey: string;
  settings: FormSettings;
  submissionCount: number;
  createdAt: string;
  updatedAt?: string;
  status?: string;
  deletedAt?: string;
  lastSubmissionAt?: string;
  keyRotatedAt?: string;
  fields?: FormField[];
  teamId?: string;
  accessLevel?: 'private' | 'team';
}

export interface FormSettings {
  encryption: boolean;
  piiStrip: boolean;
  webhookUrl: string | null;
  allowedOrigins: string[];
  spamProtection: {
    honeypot: boolean;
    recaptcha: {
      enabled: boolean;
      siteKey: string;
      secretKey: string;
      threshold: number;
    };
  };
  notifications?: {
    emailOnSubmission: boolean;   // notify form owner on each submission
    sendConfirmation: boolean;     // send confirmation to respondent
    recipients: string[];          // additional email addresses to notify
  };
  zapier?: {
    enabled: boolean;
    webhookUrl: string | null;
  };
  [key: string]: unknown;
}

export interface Submission {
  id: string;
  formId: string;
  encryptedData: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ApiKeyData {
  userId: string;
  keyHash: string;
  permissions: string[];
  createdAt: string;
  lastUsed: string | null;
}

export interface TokenData {
  email: string;
  createdAt: string;
  expiresAt: string;
  token?: string;
}

// Get a store instance
function store(name: string) {
  return getStore({ name, consistency: "strong" });
}

// === USER OPERATIONS ===

export async function createUser(
  email: string,
  passwordHash: string
): Promise<User> {
  const users = store(STORES.USERS);
  const userId =
    "user_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);

  const user: User = {
    id: userId,
    email: email.toLowerCase(),
    passwordHash,
    createdAt: new Date().toISOString(),
    subscription: "free",
    forms: [],
    emailVerified: false,
    emailVerifiedAt: null,
    onboardingCompleted: false,
    onboardingStep: 0,
  };

  await users.setJSON(email.toLowerCase(), user);
  await users.setJSON(`id_${userId}`, { email: email.toLowerCase() });

  return user;
}

export async function getUser(email: string): Promise<User | null> {
  return retryStorage(async () => {
    const users = store(STORES.USERS);
    try {
      const user = (await users.get(email.toLowerCase(), { type: "json" })) as User | null;
      storageLogger.debug({ email, found: !!user }, 'User lookup');
      return user;
    } catch (error) {
      storageLogger.warn({ email, error }, 'User lookup failed');
      return null;
    }
  }, 'getUser');
}

export async function getUserById(userId: string): Promise<User | null> {
  return retryStorage(async () => {
    const users = store(STORES.USERS);
    try {
      const mapping = (await users.get(`id_${userId}`, { type: "json" })) as {
        email: string;
      } | null;
      if (mapping?.email) {
        // Use cached version for user lookup
        return await getCachedUser(mapping.email);
      }
      storageLogger.debug({ userId, found: false }, 'User lookup by ID');
      return null;
    } catch (error) {
      storageLogger.warn({ userId, error }, 'User lookup by ID failed');
      return null;
    }
  }, 'getUserById');
}

export async function updateUser(
  email: string,
  updates: Partial<User>
): Promise<User | null> {
  const users = store(STORES.USERS);
  const user = await getUser(email);
  if (!user) return null;

  const updated: User = {
    ...user,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  await users.setJSON(email.toLowerCase(), updated);

  // Invalidate cache after update
  invalidateUserCache(email);

  return updated;
}

export async function createOAuthUser(
  email: string,
  provider: string,
  providerId: string,
  name: string | null = null
): Promise<User> {
  const users = store(STORES.USERS);
  const userId =
    "user_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);

  const user: User = {
    id: userId,
    email: email.toLowerCase(),
    passwordHash: null,
    oauthProvider: provider,
    oauthProviderId: providerId,
    name,
    createdAt: new Date().toISOString(),
    subscription: "free",
    forms: [],
    emailVerified: true,
    emailVerifiedAt: new Date().toISOString(),
    onboardingCompleted: false,
    onboardingStep: 0,
  };

  await users.setJSON(email.toLowerCase(), user);
  await users.setJSON(`id_${userId}`, { email: email.toLowerCase() });

  return user;
}

// === PASSWORD RESET TOKEN OPERATIONS ===

export async function createPasswordResetToken(
  email: string,
  token: string
): Promise<TokenData> {
  const tokens = store(STORES.PASSWORD_RESET_TOKENS);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour

  const tokenData: TokenData = {
    email: email.toLowerCase(),
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  await tokens.setJSON(token, tokenData);
  return tokenData;
}

export async function getPasswordResetToken(
  token: string
): Promise<TokenData | null> {
  const tokens = store(STORES.PASSWORD_RESET_TOKENS);
  try {
    const tokenData = (await tokens.get(token, { type: "json" })) as TokenData | null;
    if (!tokenData) return null;

    if (new Date(tokenData.expiresAt) < new Date()) {
      await deletePasswordResetToken(token);
      return null;
    }

    return tokenData;
  } catch {
    return null;
  }
}

export async function deletePasswordResetToken(token: string): Promise<boolean> {
  const tokens = store(STORES.PASSWORD_RESET_TOKENS);
  await tokens.delete(token);
  return true;
}

// === EMAIL VERIFICATION TOKEN OPERATIONS ===

export async function createEmailVerificationToken(
  email: string,
  token: string
): Promise<TokenData> {
  const tokens = store(STORES.EMAIL_VERIFICATION_TOKENS);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

  const tokenData: TokenData = {
    email: email.toLowerCase(),
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  await tokens.setJSON(token, tokenData);
  await tokens.setJSON(`email_${email.toLowerCase()}`, { token, ...tokenData });

  return tokenData;
}

export async function getEmailVerificationToken(
  token: string
): Promise<TokenData | null> {
  const tokens = store(STORES.EMAIL_VERIFICATION_TOKENS);
  try {
    const tokenData = (await tokens.get(token, { type: "json" })) as TokenData | null;
    if (!tokenData) return null;

    if (new Date(tokenData.expiresAt) < new Date()) {
      await deleteEmailVerificationToken(token);
      return null;
    }

    return tokenData;
  } catch {
    return null;
  }
}

export async function getEmailVerificationTokenByEmail(
  email: string
): Promise<(TokenData & { token: string }) | null> {
  const tokens = store(STORES.EMAIL_VERIFICATION_TOKENS);
  try {
    const data = (await tokens.get(`email_${email.toLowerCase()}`, {
      type: "json",
    })) as (TokenData & { token: string }) | null;
    if (!data) return null;

    if (new Date(data.expiresAt) < new Date()) {
      await deleteEmailVerificationToken(data.token);
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

export async function deleteEmailVerificationToken(
  token: string
): Promise<boolean> {
  const tokens = store(STORES.EMAIL_VERIFICATION_TOKENS);

  try {
    const tokenData = (await tokens.get(token, { type: "json" })) as TokenData | null;
    if (tokenData) {
      await tokens.delete(`email_${tokenData.email}`);
    }
  } catch {
    // Ignore
  }

  await tokens.delete(token);
  return true;
}

// === FORM OPERATIONS ===

export async function createForm(
  userId: string,
  formData: {
    name: string;
    publicKey: string;
    settings?: Partial<FormSettings>;
    fields?: FormField[];
    teamId?: string;
    accessLevel?: 'private' | 'team';
  }
): Promise<Form> {
  const forms = store(STORES.FORMS);
  const formId =
    "vf_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).substr(2, 6);

  const form: Form = {
    id: formId,
    userId,
    name: formData.name,
    publicKey: formData.publicKey,
    settings: {
      encryption: true,
      piiStrip: formData.settings?.piiStrip || false,
      webhookUrl: formData.settings?.webhookUrl || null,
      allowedOrigins: formData.settings?.allowedOrigins || ["*"],
      spamProtection: {
        honeypot: formData.settings?.spamProtection?.honeypot !== false,
        recaptcha: {
          enabled:
            formData.settings?.spamProtection?.recaptcha?.enabled || false,
          siteKey:
            formData.settings?.spamProtection?.recaptcha?.siteKey || "",
          secretKey:
            formData.settings?.spamProtection?.recaptcha?.secretKey || "",
          threshold:
            formData.settings?.spamProtection?.recaptcha?.threshold || 0.5,
        },
      },
      notifications: {
        emailOnSubmission: formData.settings?.notifications?.emailOnSubmission !== false,
        sendConfirmation: formData.settings?.notifications?.sendConfirmation || false,
        recipients: formData.settings?.notifications?.recipients || [],
      },
      ...formData.settings,
    },
    submissionCount: 0,
    createdAt: new Date().toISOString(),
    fields: formData.fields,
    teamId: formData.teamId,
    accessLevel: formData.accessLevel || 'private',
  };

  await forms.setJSON(formId, form);

  // Add to user's form list
  const userFormsKey = `user_forms_${userId}`;
  let userForms: string[] = [];
  try {
    userForms =
      ((await forms.get(userFormsKey, { type: "json" })) as string[] | null) || [];
  } catch {
    userForms = [];
  }
  userForms.push(formId);
  await forms.setJSON(userFormsKey, userForms);

  // Add to team's form list if teamId is provided
  if (formData.teamId) {
    const teamFormsKey = `team_forms_${formData.teamId}`;
    let teamForms: string[] = [];
    try {
      teamForms =
        ((await forms.get(teamFormsKey, { type: "json" })) as string[] | null) || [];
    } catch {
      teamForms = [];
    }
    teamForms.push(formId);
    await forms.setJSON(teamFormsKey, teamForms);
  }

  return form;
}

export async function getForm(formId: string): Promise<Form | null> {
  return retryStorage(async () => {
    const forms = store(STORES.FORMS);
    try {
      const form = (await forms.get(formId, { type: "json" })) as Form | null;
      storageLogger.debug({ formId, found: !!form }, 'Form lookup');
      return form;
    } catch (error) {
      storageLogger.warn({ formId, error }, 'Form lookup failed');
      return null;
    }
  }, 'getForm');
}

export async function updateForm(
  formId: string,
  updates: Partial<Form>
): Promise<Form | null> {
  const forms = store(STORES.FORMS);
  const form = await getForm(formId);
  if (!form) return null;

  const updated: Form = {
    ...form,
    ...updates,
    settings: { ...form.settings, ...(updates.settings || {}) },
    updatedAt: new Date().toISOString(),
  };
  await forms.setJSON(formId, updated);

  // Invalidate cache after update
  invalidateFormCache(formId);

  return updated;
}

export async function deleteForm(
  formId: string,
  userId: string
): Promise<boolean> {
  const forms = store(STORES.FORMS);

  await forms.delete(formId);

  // Remove from user's form list
  const userFormsKey = `user_forms_${userId}`;
  let userForms: string[] = [];
  try {
    userForms =
      ((await forms.get(userFormsKey, { type: "json" })) as string[] | null) || [];
  } catch {
    userForms = [];
  }
  userForms = userForms.filter((id) => id !== formId);
  await forms.setJSON(userFormsKey, userForms);

  return true;
}

export async function getUserForms(userId: string): Promise<Form[]> {
  return retryStorage(async () => {
    const forms = store(STORES.FORMS);
    const userFormsKey = `user_forms_${userId}`;

    try {
      const formIds =
        ((await forms.get(userFormsKey, { type: "json" })) as string[] | null) || [];
      // Use cached version for form lookups
      const formDetails = await Promise.all(formIds.map((id) => getCachedForm(id)));
      const validForms = formDetails.filter((f): f is Form => f !== null);
      storageLogger.debug({ userId, count: validForms.length }, 'User forms lookup');
      return validForms;
    } catch (error) {
      storageLogger.warn({ userId, error }, 'User forms lookup failed');
      return [];
    }
  }, 'getUserForms');
}

// === API KEY OPERATIONS ===

export async function createApiKey(
  userId: string,
  keyHash: string,
  permissions: string[] = [
    "forms:read",
    "forms:write",
    "submissions:read",
    "submissions:delete",
  ]
): Promise<ApiKeyData> {
  const keys = store(STORES.API_KEYS);

  const keyData: ApiKeyData = {
    userId,
    keyHash,
    permissions,
    createdAt: new Date().toISOString(),
    lastUsed: null,
  };

  await keys.setJSON(keyHash, keyData);

  // Add to user's key list
  const userKeysKey = `user_keys_${userId}`;
  let userKeys: string[] = [];
  try {
    userKeys =
      ((await keys.get(userKeysKey, { type: "json" })) as string[] | null) || [];
  } catch {
    userKeys = [];
  }
  userKeys.push(keyHash);
  await keys.setJSON(userKeysKey, userKeys);

  return keyData;
}

export async function getApiKeyData(
  keyHash: string
): Promise<ApiKeyData | null> {
  const keys = store(STORES.API_KEYS);
  try {
    return (await keys.get(keyHash, { type: "json" })) as ApiKeyData | null;
  } catch {
    return null;
  }
}

export async function updateApiKeyLastUsed(
  keyHash: string
): Promise<ApiKeyData | null> {
  const keys = store(STORES.API_KEYS);
  const keyData = await getApiKeyData(keyHash);
  if (!keyData) return null;

  keyData.lastUsed = new Date().toISOString();
  await keys.setJSON(keyHash, keyData);
  return keyData;
}

export async function revokeApiKey(
  keyHash: string,
  userId: string
): Promise<boolean> {
  const keys = store(STORES.API_KEYS);

  await keys.delete(keyHash);

  // Remove from user's key list
  const userKeysKey = `user_keys_${userId}`;
  let userKeys: string[] = [];
  try {
    userKeys =
      ((await keys.get(userKeysKey, { type: "json" })) as string[] | null) || [];
  } catch {
    userKeys = [];
  }
  userKeys = userKeys.filter((k) => k !== keyHash);
  await keys.setJSON(userKeysKey, userKeys);

  return true;
}

// === SUBMISSION OPERATIONS ===

interface SubmissionIndex {
  submissions: Array<{ id: string; createdAt: string }>;
}

interface SubmissionsResult {
  submissions: Submission[];
  total: number;
  limit: number;
  offset: number;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor?: string;
  hasMore: boolean;
  total: number;
}

export async function getSubmissions(
  formId: string,
  limit = 50,
  offset = 0
): Promise<SubmissionsResult> {
  const submissions = store(`veilforms-${formId}`);

  try {
    const index =
      ((await submissions.get("_index", {
        type: "json",
      })) as SubmissionIndex | null) || { submissions: [] };

    const slice = index.submissions.slice(offset, offset + limit);
    const submissionData = await Promise.all(
      slice.map(async (item) => {
        return (await submissions.get(item.id, { type: "json" })) as Submission | null;
      })
    );

    return {
      submissions: submissionData.filter((s): s is Submission => s !== null),
      total: index.submissions.length,
      limit,
      offset,
    };
  } catch {
    return { submissions: [], total: 0, limit, offset };
  }
}

export async function getSubmission(
  formId: string,
  submissionId: string
): Promise<Submission | null> {
  const submissions = store(`veilforms-${formId}`);
  try {
    return (await submissions.get(submissionId, { type: "json" })) as Submission | null;
  } catch {
    return null;
  }
}

export async function deleteSubmission(
  formId: string,
  submissionId: string
): Promise<boolean> {
  const submissions = store(`veilforms-${formId}`);

  await submissions.delete(submissionId);

  // Update index
  try {
    const index =
      ((await submissions.get("_index", {
        type: "json",
      })) as SubmissionIndex | null) || { submissions: [] };
    index.submissions = index.submissions.filter((s) => s.id !== submissionId);
    await submissions.setJSON("_index", index);
  } catch (e) {
    storageLogger.warn({ formId, submissionId, error: e }, 'Submission index update failed');
  }

  return true;
}

export async function deleteAllSubmissions(formId: string): Promise<number> {
  const submissions = store(`veilforms-${formId}`);

  try {
    const index =
      ((await submissions.get("_index", {
        type: "json",
      })) as SubmissionIndex | null) || { submissions: [] };
    const count = index.submissions.length;

    await Promise.all(index.submissions.map((s) => submissions.delete(s.id)));
    await submissions.setJSON("_index", { submissions: [] });

    return count;
  } catch {
    return 0;
  }
}

export async function getSubmissionsPaginated(
  formId: string,
  options: {
    cursor?: string;
    limit?: number;
  } = {}
): Promise<PaginatedResult<Submission>> {
  const { cursor, limit = 50 } = options;
  const submissions = store(`veilforms-${formId}`);
  const indexKey = "_index";

  const index = (await submissions.get(indexKey, { type: "json" })) as {
    submissions: Array<{ id: string; createdAt: string }>;
  } | null;

  if (!index || !index.submissions.length) {
    return { items: [], hasMore: false, total: 0 };
  }

  // Sort by createdAt descending
  const sortedIndex = [...index.submissions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Find cursor position
  let startIndex = 0;
  if (cursor) {
    const cursorIndex = sortedIndex.findIndex(s => s.id === cursor);
    if (cursorIndex !== -1) {
      startIndex = cursorIndex + 1;
    }
  }

  // Get slice
  const slice = sortedIndex.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < sortedIndex.length;

  // Fetch full submissions
  const items = await Promise.all(
    slice.map(async ({ id }) => {
      const data = await submissions.get(id, { type: "json" });
      return data as Submission;
    })
  );

  return {
    items: items.filter(Boolean),
    nextCursor: hasMore ? slice[slice.length - 1]?.id : undefined,
    hasMore,
    total: sortedIndex.length,
  };
}

// === TEAM FORM OPERATIONS ===

/**
 * Get all forms for a team
 */
export async function getTeamForms(teamId: string): Promise<Form[]> {
  return retryStorage(async () => {
    const forms = store(STORES.FORMS);
    const teamFormsKey = `team_forms_${teamId}`;

    try {
      const formIds =
        ((await forms.get(teamFormsKey, { type: "json" })) as string[] | null) || [];
      const formDetails = await Promise.all(formIds.map((id) => getCachedForm(id)));
      const validForms = formDetails.filter((f): f is Form => f !== null);
      storageLogger.debug({ teamId, count: validForms.length }, 'Team forms lookup');
      return validForms;
    } catch (error) {
      storageLogger.warn({ teamId, error }, 'Team forms lookup failed');
      return [];
    }
  }, 'getTeamForms');
}

// === CRM INTEGRATION OPERATIONS ===

const CRM_STORES = {
  INTEGRATIONS: "vf-crm-integrations",
  FORM_INTEGRATIONS: "vf-form-integrations",
};

export interface CRMIntegrationData {
  id: string;
  provider: "salesforce" | "hubspot" | "pipedrive";
  userId: string;
  accessToken: string; // encrypted
  refreshToken: string; // encrypted
  expiresAt: number;
  instanceUrl?: string;
  createdAt: number;
  updatedAt?: number;
}

export interface FormIntegrationData {
  id: string;
  formId: string;
  integrationId: string;
  enabled: boolean;
  fieldMappings: Array<{
    formField: string;
    crmField: string;
    transform?: "none" | "uppercase" | "lowercase" | "date";
  }>;
  syncOnSubmit: boolean;
  createdAt: number;
  updatedAt?: number;
}

/**
 * Create a CRM integration
 */
export async function createCRMIntegration(
  integration: Omit<CRMIntegrationData, "id" | "createdAt">
): Promise<CRMIntegrationData> {
  const integrations = store(CRM_STORES.INTEGRATIONS);
  const integrationId =
    "crm_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);

  const newIntegration: CRMIntegrationData = {
    ...integration,
    id: integrationId,
    createdAt: Date.now(),
  };

  await integrations.setJSON(integrationId, newIntegration);

  // Add to user's integration list
  const userIntegrationsKey = `user_integrations_${integration.userId}`;
  let userIntegrations: string[] = [];
  try {
    userIntegrations =
      ((await integrations.get(userIntegrationsKey, { type: "json" })) as string[] | null) || [];
  } catch {
    userIntegrations = [];
  }
  userIntegrations.push(integrationId);
  await integrations.setJSON(userIntegrationsKey, userIntegrations);

  return newIntegration;
}

/**
 * Get CRM integration by ID
 */
export async function getCRMIntegration(
  integrationId: string
): Promise<CRMIntegrationData | null> {
  const integrations = store(CRM_STORES.INTEGRATIONS);
  try {
    return (await integrations.get(integrationId, { type: "json" })) as CRMIntegrationData | null;
  } catch {
    return null;
  }
}

/**
 * Get all CRM integrations for a user
 */
export async function getUserCRMIntegrations(
  userId: string
): Promise<CRMIntegrationData[]> {
  const integrations = store(CRM_STORES.INTEGRATIONS);
  const userIntegrationsKey = `user_integrations_${userId}`;

  try {
    const integrationIds =
      ((await integrations.get(userIntegrationsKey, { type: "json" })) as string[] | null) || [];
    const integrationDetails = await Promise.all(
      integrationIds.map((id) => getCRMIntegration(id))
    );
    return integrationDetails.filter((i): i is CRMIntegrationData => i !== null);
  } catch {
    return [];
  }
}

/**
 * Update CRM integration
 */
export async function updateCRMIntegration(
  integrationId: string,
  updates: Partial<CRMIntegrationData>
): Promise<CRMIntegrationData | null> {
  const integrations = store(CRM_STORES.INTEGRATIONS);
  const integration = await getCRMIntegration(integrationId);
  if (!integration) return null;

  const updated: CRMIntegrationData = {
    ...integration,
    ...updates,
    updatedAt: Date.now(),
  };
  await integrations.setJSON(integrationId, updated);

  return updated;
}

/**
 * Delete CRM integration
 */
export async function deleteCRMIntegration(
  integrationId: string,
  userId: string
): Promise<boolean> {
  const integrations = store(CRM_STORES.INTEGRATIONS);

  await integrations.delete(integrationId);

  // Remove from user's integration list
  const userIntegrationsKey = `user_integrations_${userId}`;
  let userIntegrations: string[] = [];
  try {
    userIntegrations =
      ((await integrations.get(userIntegrationsKey, { type: "json" })) as string[] | null) || [];
  } catch {
    userIntegrations = [];
  }
  userIntegrations = userIntegrations.filter((id) => id !== integrationId);
  await integrations.setJSON(userIntegrationsKey, userIntegrations);

  return true;
}

/**
 * Create form integration
 */
export async function createFormIntegration(
  formIntegration: Omit<FormIntegrationData, "id" | "createdAt">
): Promise<FormIntegrationData> {
  const formIntegrations = store(CRM_STORES.FORM_INTEGRATIONS);
  const formIntegrationId =
    "fint_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);

  const newFormIntegration: FormIntegrationData = {
    ...formIntegration,
    id: formIntegrationId,
    createdAt: Date.now(),
  };

  await formIntegrations.setJSON(formIntegrationId, newFormIntegration);

  // Add to form's integration list
  const formIntegrationsKey = `form_integrations_${formIntegration.formId}`;
  let formIntegrationIds: string[] = [];
  try {
    formIntegrationIds =
      ((await formIntegrations.get(formIntegrationsKey, { type: "json" })) as string[] | null) || [];
  } catch {
    formIntegrationIds = [];
  }
  formIntegrationIds.push(formIntegrationId);
  await formIntegrations.setJSON(formIntegrationsKey, formIntegrationIds);

  return newFormIntegration;
}

/**
 * Get form integration by ID
 */
export async function getFormIntegration(
  formIntegrationId: string
): Promise<FormIntegrationData | null> {
  const formIntegrations = store(CRM_STORES.FORM_INTEGRATIONS);
  try {
    return (await formIntegrations.get(formIntegrationId, { type: "json" })) as FormIntegrationData | null;
  } catch {
    return null;
  }
}

/**
 * Get all form integrations for a form
 */
export async function getFormIntegrations(
  formId: string
): Promise<FormIntegrationData[]> {
  const formIntegrations = store(CRM_STORES.FORM_INTEGRATIONS);
  const formIntegrationsKey = `form_integrations_${formId}`;

  try {
    const formIntegrationIds =
      ((await formIntegrations.get(formIntegrationsKey, { type: "json" })) as string[] | null) || [];
    const formIntegrationDetails = await Promise.all(
      formIntegrationIds.map((id) => getFormIntegration(id))
    );
    return formIntegrationDetails.filter((i): i is FormIntegrationData => i !== null);
  } catch {
    return [];
  }
}

/**
 * Update form integration
 */
export async function updateFormIntegration(
  formIntegrationId: string,
  updates: Partial<FormIntegrationData>
): Promise<FormIntegrationData | null> {
  const formIntegrations = store(CRM_STORES.FORM_INTEGRATIONS);
  const formIntegration = await getFormIntegration(formIntegrationId);
  if (!formIntegration) return null;

  const updated: FormIntegrationData = {
    ...formIntegration,
    ...updates,
    updatedAt: Date.now(),
  };
  await formIntegrations.setJSON(formIntegrationId, updated);

  return updated;
}

/**
 * Delete form integration
 */
export async function deleteFormIntegration(
  formIntegrationId: string,
  formId: string
): Promise<boolean> {
  const formIntegrations = store(CRM_STORES.FORM_INTEGRATIONS);

  await formIntegrations.delete(formIntegrationId);

  // Remove from form's integration list
  const formIntegrationsKey = `form_integrations_${formId}`;
  let formIntegrationIds: string[] = [];
  try {
    formIntegrationIds =
      ((await formIntegrations.get(formIntegrationsKey, { type: "json" })) as string[] | null) || [];
  } catch {
    formIntegrationIds = [];
  }
  formIntegrationIds = formIntegrationIds.filter((id) => id !== formIntegrationId);
  await formIntegrations.setJSON(formIntegrationsKey, formIntegrationIds);

  return true;
}
