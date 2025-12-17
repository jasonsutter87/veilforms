/**
 * VeilForms - Multi-Tenant Storage Module
 * Secure, isolated storage for form responses
 * Based on ZTA.io Zero Trust principles
 */

import { createIdentityHash, createAnonymousId } from './identity.js';
import { validateNoPII, stripPII } from './pii.js';

/**
 * Storage adapter interface
 * Implementations can use different backends (IndexedDB, API, etc.)
 */
class StorageAdapter {
  async save(tenantId, formId, data) { throw new Error('Not implemented'); }
  async get(tenantId, formId, submissionId) { throw new Error('Not implemented'); }
  async list(tenantId, formId, options) { throw new Error('Not implemented'); }
  async delete(tenantId, formId, submissionId) { throw new Error('Not implemented'); }
}

/**
 * In-memory storage adapter (for development/testing)
 */
export class MemoryStorageAdapter extends StorageAdapter {
  constructor() {
    super();
    this.store = new Map();
  }

  _getKey(tenantId, formId) {
    return `${tenantId}:${formId}`;
  }

  async save(tenantId, formId, data) {
    const key = this._getKey(tenantId, formId);
    if (!this.store.has(key)) {
      this.store.set(key, new Map());
    }
    this.store.get(key).set(data.submissionId, data);
    return data.submissionId;
  }

  async get(tenantId, formId, submissionId) {
    const key = this._getKey(tenantId, formId);
    const formStore = this.store.get(key);
    return formStore ? formStore.get(submissionId) : null;
  }

  async list(tenantId, formId, options = {}) {
    const { limit = 100, offset = 0 } = options;
    const key = this._getKey(tenantId, formId);
    const formStore = this.store.get(key);
    if (!formStore) return { submissions: [], total: 0 };

    const all = Array.from(formStore.values())
      .sort((a, b) => b.timestamp - a.timestamp);

    return {
      submissions: all.slice(offset, offset + limit),
      total: all.length,
    };
  }

  async delete(tenantId, formId, submissionId) {
    const key = this._getKey(tenantId, formId);
    const formStore = this.store.get(key);
    if (formStore) {
      formStore.delete(submissionId);
      return true;
    }
    return false;
  }
}

/**
 * API storage adapter (for production use)
 */
export class APIStorageAdapter extends StorageAdapter {
  constructor(config) {
    super();
    this.endpoint = config.endpoint;
    this.apiKey = config.apiKey;
  }

  async _request(method, path, body = null) {
    const response = await fetch(`${this.endpoint}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: body ? JSON.stringify(body) : null,
    });

    if (!response.ok) {
      const error = new Error(`API error: ${response.status}`);
      error.status = response.status;
      throw error;
    }

    return response.json();
  }

  async save(tenantId, formId, data) {
    const result = await this._request('POST', `/tenants/${tenantId}/forms/${formId}/submissions`, data);
    return result.submissionId;
  }

  async get(tenantId, formId, submissionId) {
    return this._request('GET', `/tenants/${tenantId}/forms/${formId}/submissions/${submissionId}`);
  }

  async list(tenantId, formId, options = {}) {
    const params = new URLSearchParams(options);
    return this._request('GET', `/tenants/${tenantId}/forms/${formId}/submissions?${params}`);
  }

  async delete(tenantId, formId, submissionId) {
    await this._request('DELETE', `/tenants/${tenantId}/forms/${formId}/submissions/${submissionId}`);
    return true;
  }
}

/**
 * Multi-tenant form storage manager
 */
export class FormStorage {
  constructor(config = {}) {
    this.adapter = config.adapter || new MemoryStorageAdapter();
    this.encryptionEnabled = config.encryption !== false;
    this.piiValidation = config.piiValidation !== false;
    this.piiStripping = config.piiStripping || false;
  }

  /**
   * Save a form submission
   * @param {string} tenantId - Tenant identifier
   * @param {string} formId - Form identifier
   * @param {object} formData - The form data to save
   * @param {object} options - Save options
   * @returns {Promise<object>} - Saved submission with ID
   */
  async saveSubmission(tenantId, formId, formData, options = {}) {
    // Validate tenant isolation
    if (!tenantId || typeof tenantId !== 'string') {
      throw new Error('Valid tenantId is required');
    }
    if (!formId || typeof formId !== 'string') {
      throw new Error('Valid formId is required');
    }

    let processedData = { ...formData };

    // PII validation/stripping
    if (this.piiValidation) {
      if (this.piiStripping) {
        const stripped = stripPII(processedData, options.piiOptions);
        processedData = stripped.data;
      } else {
        validateNoPII(processedData, options.piiOptions);
      }
    }

    // Generate anonymous submission ID
    const identity = await createIdentityHash(formId);

    const submission = {
      submissionId: identity.id,
      tenantId,
      formId,
      data: processedData,
      timestamp: identity.timestamp,
      metadata: {
        // Only non-PII metadata
        formVersion: options.formVersion || '1.0',
        submittedAt: new Date(identity.timestamp).toISOString(),
        // Explicitly NO: IP, user agent, cookies, etc.
      },
    };

    await this.adapter.save(tenantId, formId, submission);

    return {
      submissionId: submission.submissionId,
      timestamp: submission.timestamp,
    };
  }

  /**
   * Retrieve a submission
   * @param {string} tenantId - Tenant identifier
   * @param {string} formId - Form identifier
   * @param {string} submissionId - Submission ID
   * @returns {Promise<object|null>} - The submission or null
   */
  async getSubmission(tenantId, formId, submissionId) {
    // Enforce tenant isolation
    const submission = await this.adapter.get(tenantId, formId, submissionId);

    // Double-check tenant match (defense in depth)
    if (submission && submission.tenantId !== tenantId) {
      console.error('Tenant isolation violation detected');
      return null;
    }

    return submission;
  }

  /**
   * List submissions for a form
   * @param {string} tenantId - Tenant identifier
   * @param {string} formId - Form identifier
   * @param {object} options - List options (limit, offset, etc.)
   * @returns {Promise<object>} - Paginated submissions
   */
  async listSubmissions(tenantId, formId, options = {}) {
    return this.adapter.list(tenantId, formId, options);
  }

  /**
   * Delete a submission
   * @param {string} tenantId - Tenant identifier
   * @param {string} formId - Form identifier
   * @param {string} submissionId - Submission ID
   * @returns {Promise<boolean>} - Success status
   */
  async deleteSubmission(tenantId, formId, submissionId) {
    // Verify ownership before delete
    const submission = await this.getSubmission(tenantId, formId, submissionId);
    if (!submission) {
      return false;
    }

    return this.adapter.delete(tenantId, formId, submissionId);
  }

  /**
   * Export all submissions for a form (for data portability)
   * @param {string} tenantId - Tenant identifier
   * @param {string} formId - Form identifier
   * @returns {Promise<object>} - All submissions
   */
  async exportSubmissions(tenantId, formId) {
    const { submissions, total } = await this.adapter.list(tenantId, formId, { limit: 10000 });

    return {
      tenantId,
      formId,
      exportedAt: new Date().toISOString(),
      total,
      submissions: submissions.map(s => ({
        submissionId: s.submissionId,
        data: s.data,
        submittedAt: s.metadata.submittedAt,
      })),
    };
  }

  /**
   * Purge all submissions for a form (GDPR right to erasure)
   * @param {string} tenantId - Tenant identifier
   * @param {string} formId - Form identifier
   * @returns {Promise<number>} - Number of deleted submissions
   */
  async purgeForm(tenantId, formId) {
    const { submissions } = await this.adapter.list(tenantId, formId, { limit: 10000 });
    let deleted = 0;

    for (const submission of submissions) {
      const success = await this.adapter.delete(tenantId, formId, submission.submissionId);
      if (success) deleted++;
    }

    return deleted;
  }
}

// Default export for convenience
export default FormStorage;
