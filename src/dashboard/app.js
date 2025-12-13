/**
 * VeilForms Dashboard
 * Client-first form management
 * All decryption happens in YOUR browser
 */

import { generateKeyPair, decryptSubmission } from '../core/encryption.js';
import { createAnonymousId } from '../core/identity.js';

class VeilFormsDashboard {
  constructor() {
    this.apiEndpoint = 'https://veilforms.com/api';
    this.apiKey = null;
    this.privateKeys = {}; // formId -> privateKey (stored locally only)
    this.currentTenant = null;
  }

  /**
   * Initialize dashboard with API key
   */
  async init(apiKey) {
    this.apiKey = apiKey;

    // Load private keys from localStorage (never sent to server)
    this.loadPrivateKeys();

    // Verify API key and get tenant info
    const tenant = await this.verifyApiKey();
    this.currentTenant = tenant;

    return tenant;
  }

  /**
   * Load private keys from local storage
   * CRITICAL: Keys never leave the browser
   */
  loadPrivateKeys() {
    try {
      const stored = localStorage.getItem('veilforms_private_keys');
      if (stored) {
        this.privateKeys = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to load private keys:', e);
      this.privateKeys = {};
    }
  }

  /**
   * Save private key locally
   */
  savePrivateKey(formId, privateKey) {
    this.privateKeys[formId] = privateKey;
    localStorage.setItem('veilforms_private_keys', JSON.stringify(this.privateKeys));
  }

  /**
   * Verify API key with server
   */
  async verifyApiKey() {
    const response = await fetch(`${this.apiEndpoint}/auth/verify`, {
      headers: { 'Authorization': `Bearer ${this.apiKey}` }
    });

    if (!response.ok) {
      throw new Error('Invalid API key');
    }

    return response.json();
  }

  /**
   * Create a new form
   * Generates encryption keys CLIENT-SIDE
   */
  async createForm(config) {
    const { name, fields, settings = {} } = config;

    // Generate key pair in browser
    const keyPair = await generateKeyPair();

    // Generate form ID
    const formId = createAnonymousId('form');

    // Only send public key to server - private key stays local
    const formData = {
      formId,
      name,
      fields,
      settings,
      publicKey: keyPair.publicKey,
      createdAt: Date.now(),
    };

    const response = await fetch(`${this.apiEndpoint}/forms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(formData),
    });

    if (!response.ok) {
      throw new Error('Failed to create form');
    }

    // Store private key locally - NEVER sent to server
    this.savePrivateKey(formId, keyPair.privateKey);

    return {
      formId,
      publicKey: keyPair.publicKey,
      // Return private key for user to backup
      privateKey: keyPair.privateKey,
      embedCode: this.generateEmbedCode(formId, keyPair.publicKey),
    };
  }

  /**
   * Generate embed code for a form
   */
  generateEmbedCode(formId, publicKey) {
    const publicKeyB64 = btoa(JSON.stringify(publicKey));

    return `<!-- VeilForms - Client-Side Encrypted -->
<script src="https://veilforms.com/js/veilforms.min.js"></script>
<script>
  VeilForms.init('${formId}', {
    publicKey: '${publicKeyB64}',
    encryption: true,
    piiStrip: true
  });
</script>

<form data-veilform>
  <!-- Your form fields here -->
  <button type="submit">Submit</button>
</form>`;
  }

  /**
   * List all forms for tenant
   */
  async listForms() {
    const response = await fetch(`${this.apiEndpoint}/forms`, {
      headers: { 'Authorization': `Bearer ${this.apiKey}` }
    });

    if (!response.ok) {
      throw new Error('Failed to list forms');
    }

    const data = await response.json();

    // Mark which forms we have private keys for
    return data.forms.map(form => ({
      ...form,
      canDecrypt: !!this.privateKeys[form.formId],
    }));
  }

  /**
   * Get form submissions
   * Decrypted CLIENT-SIDE with local private key
   */
  async getSubmissions(formId, options = {}) {
    const { limit = 50, offset = 0, decrypt = true } = options;

    const response = await fetch(
      `${this.apiEndpoint}/submissions?formId=${formId}&limit=${limit}&offset=${offset}`,
      { headers: { 'Authorization': `Bearer ${this.apiKey}` } }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch submissions');
    }

    const data = await response.json();

    // Decrypt submissions in browser if we have the private key
    if (decrypt && this.privateKeys[formId]) {
      const privateKey = this.privateKeys[formId];

      data.submissions = await Promise.all(
        data.submissions.map(async (sub) => {
          if (sub.payload.encrypted) {
            try {
              const decrypted = await decryptSubmission(sub.payload, privateKey);
              return { ...sub, data: decrypted, decrypted: true };
            } catch (e) {
              return { ...sub, decrypted: false, decryptError: e.message };
            }
          }
          return { ...sub, data: sub.payload.data, decrypted: false };
        })
      );
    }

    return data;
  }

  /**
   * Export submissions as CSV
   * All processing happens client-side
   */
  async exportCSV(formId) {
    const { submissions } = await this.getSubmissions(formId, { limit: 10000 });

    if (submissions.length === 0) {
      return '';
    }

    // Get all unique field names
    const fields = new Set();
    submissions.forEach(sub => {
      if (sub.data) {
        Object.keys(sub.data).forEach(key => fields.add(key));
      }
    });

    const fieldArray = ['submissionId', 'timestamp', ...Array.from(fields)];

    // Build CSV
    const rows = [fieldArray.join(',')];

    submissions.forEach(sub => {
      const row = fieldArray.map(field => {
        if (field === 'submissionId') return sub.submissionId;
        if (field === 'timestamp') return new Date(sub.timestamp).toISOString();
        const value = sub.data?.[field] || '';
        // Escape CSV values
        return `"${String(value).replace(/"/g, '""')}"`;
      });
      rows.push(row.join(','));
    });

    return rows.join('\n');
  }

  /**
   * Delete a submission
   */
  async deleteSubmission(formId, submissionId) {
    const response = await fetch(
      `${this.apiEndpoint}/submissions/${submissionId}?formId=${formId}`,
      {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
      }
    );

    return response.ok;
  }

  /**
   * Delete a form and all submissions
   */
  async deleteForm(formId) {
    const response = await fetch(`${this.apiEndpoint}/forms/${formId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${this.apiKey}` },
    });

    if (response.ok) {
      // Remove local private key
      delete this.privateKeys[formId];
      localStorage.setItem('veilforms_private_keys', JSON.stringify(this.privateKeys));
    }

    return response.ok;
  }

  /**
   * Import a private key (for key recovery)
   */
  importPrivateKey(formId, privateKeyJwk) {
    this.savePrivateKey(formId, privateKeyJwk);
  }

  /**
   * Export private key for backup
   * CRITICAL: User must store this securely
   */
  exportPrivateKey(formId) {
    const key = this.privateKeys[formId];
    if (!key) {
      throw new Error('No private key found for this form');
    }
    return key;
  }

  /**
   * Update form settings (including spam protection)
   */
  async updateFormSettings(formId, settings) {
    const response = await fetch(`${this.apiEndpoint}/forms/${formId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ settings }),
    });

    if (!response.ok) {
      throw new Error('Failed to update form settings');
    }

    return response.json();
  }

  /**
   * Get form details
   */
  async getForm(formId) {
    const response = await fetch(`${this.apiEndpoint}/forms/${formId}`, {
      headers: { 'Authorization': `Bearer ${this.apiKey}` }
    });

    if (!response.ok) {
      throw new Error('Failed to get form');
    }

    return response.json();
  }
}

// Export singleton
const dashboard = new VeilFormsDashboard();
export default dashboard;
