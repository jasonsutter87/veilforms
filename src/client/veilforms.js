/**
 * VeilForms Client SDK
 * Drop-in privacy-first form handler
 * Encrypts data client-side before submission
 */

import { encryptSubmission, hashField } from '../core/encryption.js';
import { createAnonymousId } from '../core/identity.js';
import { detectPII, stripPII } from '../core/pii.js';

const VeilForms = (function() {
  'use strict';

  const config = {
    endpoint: null,
    formId: null,
    publicKey: null,
    debug: false,
    encryption: true,
    piiWarning: true,
    piiStrip: false,
  };

  /**
   * Initialize VeilForms
   * @param {string} formId - Your form ID
   * @param {object} options - Configuration options
   */
  function init(formId, options = {}) {
    config.formId = formId;
    config.endpoint = options.endpoint || 'https://veilforms.com/api/submit';
    config.publicKey = options.publicKey || null;
    config.debug = options.debug || false;
    config.encryption = options.encryption !== false;
    config.piiWarning = options.piiWarning !== false;
    config.piiStrip = options.piiStrip || false;

    log('Initialized with form:', formId);

    // Auto-bind forms with data-veilform attribute
    if (options.autoBind !== false) {
      bindForms();
    }
  }

  /**
   * Auto-bind forms with data-veilform attribute
   */
  function bindForms() {
    document.querySelectorAll('form[data-veilform]').forEach(form => {
      form.addEventListener('submit', handleFormSubmit);
      log('Bound form:', form.id || form.name || 'unnamed');
    });
  }

  /**
   * Handle form submission
   * @param {Event} e - Submit event
   */
  async function handleFormSubmit(e) {
    e.preventDefault();
    const form = e.target;

    try {
      // Collect form data
      const formData = collectFormData(form);

      // Submit through VeilForms
      const result = await submit(formData, {
        formElement: form,
      });

      // Trigger success callback
      const successEvent = new CustomEvent('veilforms:success', {
        detail: result,
      });
      form.dispatchEvent(successEvent);

      // Clear form if configured
      if (form.dataset.veilformReset !== 'false') {
        form.reset();
      }

      log('Submission successful:', result.submissionId);
    } catch (error) {
      // Trigger error callback
      const errorEvent = new CustomEvent('veilforms:error', {
        detail: { error: error.message },
      });
      form.dispatchEvent(errorEvent);

      log('Submission failed:', error.message);
    }
  }

  /**
   * Collect data from a form element
   * @param {HTMLFormElement} form
   * @returns {object} - Form data object
   */
  function collectFormData(form) {
    const data = {};
    const formData = new FormData(form);

    for (const [key, value] of formData.entries()) {
      // Handle multiple values (checkboxes, multi-select)
      if (data[key]) {
        if (Array.isArray(data[key])) {
          data[key].push(value);
        } else {
          data[key] = [data[key], value];
        }
      } else {
        data[key] = value;
      }
    }

    return data;
  }

  /**
   * Submit form data to VeilForms
   * @param {object} formData - The form data
   * @param {object} options - Submission options
   * @returns {Promise<object>} - Submission result
   */
  async function submit(formData, options = {}) {
    if (!config.formId) {
      throw new Error('VeilForms not initialized. Call VeilForms.init() first.');
    }

    let processedData = { ...formData };

    // PII detection/handling
    if (config.piiWarning || config.piiStrip) {
      const detection = detectPII(processedData);

      if (detection.hasPII) {
        if (config.piiStrip) {
          const stripped = stripPII(processedData);
          processedData = stripped.data;
          log('PII stripped from fields:', stripped.strippedFields);
        } else if (config.piiWarning) {
          console.warn('[VeilForms] PII detected in submission:', detection);
        }
      }
    }

    // Generate anonymous submission ID
    const submissionId = createAnonymousId(config.formId);

    // Encrypt if enabled and public key available
    let payload;
    if (config.encryption && config.publicKey) {
      payload = await encryptSubmission(processedData, config.publicKey);
      log('Data encrypted client-side');
    } else {
      payload = { encrypted: false, data: processedData };
    }

    // Build submission
    const submission = {
      formId: config.formId,
      submissionId,
      payload,
      timestamp: Date.now(),
      // No PII metadata - just form version
      meta: {
        sdk: 'veilforms-js',
        version: '1.0.0',
      },
    };

    // Send to server
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(submission),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Submission failed: ${response.status}`);
    }

    return {
      success: true,
      submissionId,
      timestamp: submission.timestamp,
    };
  }

  /**
   * Manually submit data (not from form element)
   * @param {object} data - Data to submit
   * @returns {Promise<object>}
   */
  async function track(eventName, properties = {}) {
    return submit({
      _event: eventName,
      ...properties,
    });
  }

  /**
   * Debug logging
   */
  function log(...args) {
    if (config.debug && console) {
      console.log('[VeilForms]', ...args);
    }
  }

  // Public API
  return {
    init,
    submit,
    track,
    bindForms,
    // Expose utilities for advanced use
    utils: {
      collectFormData,
      hashField,
      detectPII,
    },
  };
})();

// Browser global
if (typeof window !== 'undefined') {
  window.VeilForms = VeilForms;
}

export default VeilForms;
