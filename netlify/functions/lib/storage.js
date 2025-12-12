import { getStore } from '@netlify/blobs';

// Store names
const STORES = {
  USERS: 'vf-users',
  FORMS: 'vf-forms',
  SUBMISSIONS: 'vf-submissions',
  API_KEYS: 'vf-api-keys',
  PASSWORD_RESET_TOKENS: 'vf-password-reset-tokens',
  EMAIL_VERIFICATION_TOKENS: 'vf-email-verification-tokens'
};

// Get a store instance
function store(name) {
  return getStore({ name, consistency: 'strong' });
}

// === USER OPERATIONS ===

export async function createUser(email, passwordHash) {
  const users = store(STORES.USERS);
  const userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  const user = {
    id: userId,
    email: email.toLowerCase(),
    passwordHash,
    createdAt: new Date().toISOString(),
    subscription: 'free',
    forms: [],
    emailVerified: false,
    emailVerifiedAt: null
  };
  await users.setJSON(email.toLowerCase(), user);
  // Store userId -> email mapping for reverse lookup
  await users.setJSON(`id_${userId}`, { email: email.toLowerCase() });
  return user;
}

export async function getUser(email) {
  const users = store(STORES.USERS);
  try {
    return await users.get(email.toLowerCase(), { type: 'json' });
  } catch (e) {
    return null;
  }
}

export async function getUserById(userId) {
  const users = store(STORES.USERS);
  try {
    // User ID includes a reference, look up by scanning or use index
    // For efficiency, we store a userId -> email mapping
    const mapping = await users.get(`id_${userId}`, { type: 'json' });
    if (mapping?.email) {
      return await getUser(mapping.email);
    }
    return null;
  } catch (e) {
    return null;
  }
}

export async function updateUser(email, updates) {
  const users = store(STORES.USERS);
  const user = await getUser(email);
  if (!user) return null;
  const updated = { ...user, ...updates, updatedAt: new Date().toISOString() };
  await users.setJSON(email.toLowerCase(), updated);
  return updated;
}

// === PASSWORD RESET TOKEN OPERATIONS ===

export async function createPasswordResetToken(email, token) {
  const tokens = store(STORES.PASSWORD_RESET_TOKENS);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour expiry

  const tokenData = {
    email: email.toLowerCase(),
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString()
  };

  await tokens.setJSON(token, tokenData);
  return tokenData;
}

export async function getPasswordResetToken(token) {
  const tokens = store(STORES.PASSWORD_RESET_TOKENS);
  try {
    const tokenData = await tokens.get(token, { type: 'json' });
    if (!tokenData) return null;

    // Check if token is expired
    if (new Date(tokenData.expiresAt) < new Date()) {
      await deletePasswordResetToken(token);
      return null;
    }

    return tokenData;
  } catch (e) {
    return null;
  }
}

export async function deletePasswordResetToken(token) {
  const tokens = store(STORES.PASSWORD_RESET_TOKENS);
  await tokens.delete(token);
  return true;
}

// === EMAIL VERIFICATION TOKEN OPERATIONS ===

export async function createEmailVerificationToken(email, token) {
  const tokens = store(STORES.EMAIL_VERIFICATION_TOKENS);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hour expiry

  const tokenData = {
    email: email.toLowerCase(),
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString()
  };

  await tokens.setJSON(token, tokenData);

  // Also store by email for easy lookup/resend
  await tokens.setJSON(`email_${email.toLowerCase()}`, { token, ...tokenData });

  return tokenData;
}

export async function getEmailVerificationToken(token) {
  const tokens = store(STORES.EMAIL_VERIFICATION_TOKENS);
  try {
    const tokenData = await tokens.get(token, { type: 'json' });
    if (!tokenData) return null;

    // Check if token is expired
    if (new Date(tokenData.expiresAt) < new Date()) {
      await deleteEmailVerificationToken(token);
      return null;
    }

    return tokenData;
  } catch (e) {
    return null;
  }
}

export async function getEmailVerificationTokenByEmail(email) {
  const tokens = store(STORES.EMAIL_VERIFICATION_TOKENS);
  try {
    const data = await tokens.get(`email_${email.toLowerCase()}`, { type: 'json' });
    if (!data) return null;

    // Check if token is expired
    if (new Date(data.expiresAt) < new Date()) {
      await deleteEmailVerificationToken(data.token);
      return null;
    }

    return data;
  } catch (e) {
    return null;
  }
}

export async function deleteEmailVerificationToken(token) {
  const tokens = store(STORES.EMAIL_VERIFICATION_TOKENS);

  // Get email before deleting
  try {
    const tokenData = await tokens.get(token, { type: 'json' });
    if (tokenData) {
      await tokens.delete(`email_${tokenData.email}`);
    }
  } catch (e) {
    // Ignore
  }

  await tokens.delete(token);
  return true;
}

// === FORM OPERATIONS ===

export async function createForm(userId, formData) {
  const forms = store(STORES.FORMS);
  const formId = 'vf_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);

  const form = {
    id: formId,
    userId,
    name: formData.name,
    publicKey: formData.publicKey,
    settings: {
      encryption: true,
      piiStrip: formData.settings?.piiStrip || false,
      webhookUrl: formData.settings?.webhookUrl || null,
      allowedOrigins: formData.settings?.allowedOrigins || ['*'],
      ...formData.settings
    },
    submissionCount: 0,
    createdAt: new Date().toISOString()
  };

  await forms.setJSON(formId, form);

  // Add to user's form list
  const userFormsKey = `user_forms_${userId}`;
  let userForms = [];
  try {
    userForms = await forms.get(userFormsKey, { type: 'json' }) || [];
  } catch (e) {
    userForms = [];
  }
  userForms.push(formId);
  await forms.setJSON(userFormsKey, userForms);

  return form;
}

export async function getForm(formId) {
  const forms = store(STORES.FORMS);
  try {
    return await forms.get(formId, { type: 'json' });
  } catch (e) {
    return null;
  }
}

export async function updateForm(formId, updates) {
  const forms = store(STORES.FORMS);
  const form = await getForm(formId);
  if (!form) return null;

  const updated = {
    ...form,
    ...updates,
    settings: { ...form.settings, ...updates.settings },
    updatedAt: new Date().toISOString()
  };
  await forms.setJSON(formId, updated);
  return updated;
}

export async function deleteForm(formId, userId) {
  const forms = store(STORES.FORMS);

  // Delete the form
  await forms.delete(formId);

  // Remove from user's form list
  const userFormsKey = `user_forms_${userId}`;
  let userForms = [];
  try {
    userForms = await forms.get(userFormsKey, { type: 'json' }) || [];
  } catch (e) {
    userForms = [];
  }
  userForms = userForms.filter(id => id !== formId);
  await forms.setJSON(userFormsKey, userForms);

  return true;
}

export async function getUserForms(userId) {
  const forms = store(STORES.FORMS);
  const userFormsKey = `user_forms_${userId}`;

  try {
    const formIds = await forms.get(userFormsKey, { type: 'json' }) || [];
    const formDetails = await Promise.all(
      formIds.map(id => getForm(id))
    );
    return formDetails.filter(f => f !== null);
  } catch (e) {
    return [];
  }
}

// === API KEY OPERATIONS ===

export async function createApiKey(userId, keyHash, permissions = ['forms:read', 'forms:write', 'submissions:read', 'submissions:delete']) {
  const keys = store(STORES.API_KEYS);

  const keyData = {
    userId,
    keyHash,
    permissions,
    createdAt: new Date().toISOString(),
    lastUsed: null
  };

  await keys.setJSON(keyHash, keyData);

  // Add to user's key list
  const userKeysKey = `user_keys_${userId}`;
  let userKeys = [];
  try {
    userKeys = await keys.get(userKeysKey, { type: 'json' }) || [];
  } catch (e) {
    userKeys = [];
  }
  userKeys.push(keyHash);
  await keys.setJSON(userKeysKey, userKeys);

  return keyData;
}

export async function getApiKeyData(keyHash) {
  const keys = store(STORES.API_KEYS);
  try {
    return await keys.get(keyHash, { type: 'json' });
  } catch (e) {
    return null;
  }
}

export async function updateApiKeyLastUsed(keyHash) {
  const keys = store(STORES.API_KEYS);
  const keyData = await getApiKeyData(keyHash);
  if (!keyData) return null;

  keyData.lastUsed = new Date().toISOString();
  await keys.setJSON(keyHash, keyData);
  return keyData;
}

export async function revokeApiKey(keyHash, userId) {
  const keys = store(STORES.API_KEYS);

  await keys.delete(keyHash);

  // Remove from user's key list
  const userKeysKey = `user_keys_${userId}`;
  let userKeys = [];
  try {
    userKeys = await keys.get(userKeysKey, { type: 'json' }) || [];
  } catch (e) {
    userKeys = [];
  }
  userKeys = userKeys.filter(k => k !== keyHash);
  await keys.setJSON(userKeysKey, userKeys);

  return true;
}

// === SUBMISSION OPERATIONS ===

export async function getSubmissions(formId, limit = 50, offset = 0) {
  const submissions = store(`veilforms-${formId}`);

  try {
    const index = await submissions.get('_index', { type: 'json' }) || { submissions: [] };

    const slice = index.submissions.slice(offset, offset + limit);
    const submissionData = await Promise.all(
      slice.map(async (item) => {
        const data = await submissions.get(item.id, { type: 'json' });
        return data;
      })
    );

    return {
      submissions: submissionData.filter(s => s !== null),
      total: index.submissions.length,
      limit,
      offset
    };
  } catch (e) {
    return { submissions: [], total: 0, limit, offset };
  }
}

export async function getSubmission(formId, submissionId) {
  const submissions = store(`veilforms-${formId}`);
  try {
    return await submissions.get(submissionId, { type: 'json' });
  } catch (e) {
    return null;
  }
}

export async function deleteSubmission(formId, submissionId) {
  const submissions = store(`veilforms-${formId}`);

  await submissions.delete(submissionId);

  // Update index
  try {
    const index = await submissions.get('_index', { type: 'json' }) || { submissions: [] };
    index.submissions = index.submissions.filter(s => s.id !== submissionId);
    await submissions.setJSON('_index', index);
  } catch (e) {
    console.warn('Index update failed:', e);
  }

  return true;
}

export async function deleteAllSubmissions(formId) {
  const submissions = store(`veilforms-${formId}`);

  try {
    const index = await submissions.get('_index', { type: 'json' }) || { submissions: [] };
    const count = index.submissions.length;

    // Delete all submissions
    await Promise.all(
      index.submissions.map(s => submissions.delete(s.id))
    );

    // Clear index
    await submissions.setJSON('_index', { submissions: [] });

    return count;
  } catch (e) {
    return 0;
  }
}
