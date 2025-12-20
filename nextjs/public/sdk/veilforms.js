/*!
 * VeilForms SDK v1.0.0
 * https://veilforms.com
 *
 * Privacy-first encrypted forms for the enterprise.
 *
 * (c) VeilForms. All rights reserved.
 */

(function(window, document) {
  'use strict';

  // Configuration
  var DEFAULT_BASE_URL = 'https://app.veilforms.com';
  var SDK_VERSION = '1.0.0';

  /**
   * VeilForms SDK Class
   */
  function VeilForms(options) {
    options = options || {};

    this.baseUrl = options.baseUrl || DEFAULT_BASE_URL;
    this.apiKey = options.apiKey || null;
    this.debug = options.debug || false;
    this.forms = {};

    this._log('VeilForms SDK initialized', { version: SDK_VERSION, baseUrl: this.baseUrl });
  }

  /**
   * Log debug messages
   */
  VeilForms.prototype._log = function(message, data) {
    if (this.debug) {
      console.log('[VeilForms]', message, data || '');
    }
  };

  /**
   * Make API request
   */
  VeilForms.prototype._request = function(method, endpoint, data) {
    var self = this;
    var url = this.baseUrl + '/api' + endpoint;

    return new Promise(function(resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open(method, url, true);
      xhr.setRequestHeader('Content-Type', 'application/json');

      if (self.apiKey) {
        xhr.setRequestHeader('Authorization', 'Bearer ' + self.apiKey);
      }

      xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
          try {
            var response = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(response);
            } else {
              reject(response);
            }
          } catch (e) {
            reject({ error: 'Invalid response', status: xhr.status });
          }
        }
      };

      xhr.onerror = function() {
        reject({ error: 'Network error' });
      };

      if (data) {
        xhr.send(JSON.stringify(data));
      } else {
        xhr.send();
      }
    });
  };

  /**
   * Load a form by ID
   */
  VeilForms.prototype.loadForm = function(formId) {
    var self = this;

    this._log('Loading form', formId);

    return this._request('GET', '/forms/' + formId + '/public')
      .then(function(form) {
        self.forms[formId] = form;
        self._log('Form loaded', form);
        return form;
      });
  };

  /**
   * Render a form into a container element
   */
  VeilForms.prototype.render = function(formId, containerId, options) {
    var self = this;
    options = options || {};

    var container = document.getElementById(containerId);
    if (!container) {
      console.error('[VeilForms] Container not found:', containerId);
      return Promise.reject({ error: 'Container not found' });
    }

    // Show loading state
    container.innerHTML = '<div class="veilforms-loading">Loading form...</div>';

    return this.loadForm(formId)
      .then(function(form) {
        container.innerHTML = '';

        // Create form element
        var formEl = document.createElement('form');
        formEl.className = 'veilforms-form';
        formEl.setAttribute('data-veilforms-id', formId);

        // Add title
        if (form.title && options.showTitle !== false) {
          var title = document.createElement('h2');
          title.className = 'veilforms-title';
          title.textContent = form.title;
          formEl.appendChild(title);
        }

        // Add description
        if (form.description && options.showDescription !== false) {
          var desc = document.createElement('p');
          desc.className = 'veilforms-description';
          desc.textContent = form.description;
          formEl.appendChild(desc);
        }

        // Render fields
        if (form.fields && form.fields.length) {
          form.fields.forEach(function(field) {
            var fieldWrapper = self._renderField(field);
            formEl.appendChild(fieldWrapper);
          });
        }

        // Add submit button
        var submitBtn = document.createElement('button');
        submitBtn.type = 'submit';
        submitBtn.className = 'veilforms-submit';
        submitBtn.textContent = options.submitText || 'Submit';
        formEl.appendChild(submitBtn);

        // Handle submission
        formEl.addEventListener('submit', function(e) {
          e.preventDefault();
          self._handleSubmit(formId, formEl, options);
        });

        container.appendChild(formEl);

        // Load default styles if not disabled
        if (options.includeStyles !== false) {
          self._injectStyles();
        }

        // Trigger callback
        if (options.onLoad) {
          options.onLoad(form);
        }

        return form;
      })
      .catch(function(error) {
        container.innerHTML = '<div class="veilforms-error">Failed to load form</div>';
        console.error('[VeilForms] Error loading form:', error);
        throw error;
      });
  };

  /**
   * Render a single field
   */
  VeilForms.prototype._renderField = function(field) {
    var wrapper = document.createElement('div');
    wrapper.className = 'veilforms-field veilforms-field-' + field.type;

    // Label
    if (field.label) {
      var label = document.createElement('label');
      label.className = 'veilforms-label';
      label.setAttribute('for', 'vf-' + field.id);
      label.textContent = field.label;
      if (field.required) {
        var required = document.createElement('span');
        required.className = 'veilforms-required';
        required.textContent = ' *';
        label.appendChild(required);
      }
      wrapper.appendChild(label);
    }

    // Input
    var input;
    switch (field.type) {
      case 'textarea':
        input = document.createElement('textarea');
        input.rows = field.rows || 4;
        break;

      case 'select':
        input = document.createElement('select');
        if (field.placeholder) {
          var placeholder = document.createElement('option');
          placeholder.value = '';
          placeholder.textContent = field.placeholder;
          placeholder.disabled = true;
          placeholder.selected = true;
          input.appendChild(placeholder);
        }
        if (field.options) {
          field.options.forEach(function(opt) {
            var option = document.createElement('option');
            option.value = opt.value || opt;
            option.textContent = opt.label || opt;
            input.appendChild(option);
          });
        }
        break;

      case 'checkbox':
        input = document.createElement('input');
        input.type = 'checkbox';
        break;

      case 'radio':
        // Radio group
        if (field.options) {
          var radioGroup = document.createElement('div');
          radioGroup.className = 'veilforms-radio-group';
          field.options.forEach(function(opt, idx) {
            var radioWrapper = document.createElement('div');
            radioWrapper.className = 'veilforms-radio-option';

            var radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = field.id;
            radio.id = 'vf-' + field.id + '-' + idx;
            radio.value = opt.value || opt;
            if (field.required) radio.required = true;

            var radioLabel = document.createElement('label');
            radioLabel.setAttribute('for', 'vf-' + field.id + '-' + idx);
            radioLabel.textContent = opt.label || opt;

            radioWrapper.appendChild(radio);
            radioWrapper.appendChild(radioLabel);
            radioGroup.appendChild(radioWrapper);
          });
          wrapper.appendChild(radioGroup);
          return wrapper;
        }
        break;

      case 'file':
        input = document.createElement('input');
        input.type = 'file';
        if (field.accept) input.accept = field.accept;
        if (field.multiple) input.multiple = true;
        break;

      default:
        input = document.createElement('input');
        input.type = field.type || 'text';
    }

    if (input) {
      input.id = 'vf-' + field.id;
      input.name = field.id;
      input.className = 'veilforms-input';
      if (field.placeholder) input.placeholder = field.placeholder;
      if (field.required) input.required = true;
      if (field.pattern) input.pattern = field.pattern;
      if (field.minLength) input.minLength = field.minLength;
      if (field.maxLength) input.maxLength = field.maxLength;
      wrapper.appendChild(input);
    }

    // Help text
    if (field.helpText) {
      var help = document.createElement('p');
      help.className = 'veilforms-help';
      help.textContent = field.helpText;
      wrapper.appendChild(help);
    }

    return wrapper;
  };

  /**
   * Handle form submission
   */
  VeilForms.prototype._handleSubmit = function(formId, formEl, options) {
    var self = this;
    var submitBtn = formEl.querySelector('.veilforms-submit');
    var originalText = submitBtn.textContent;

    // Disable button
    submitBtn.disabled = true;
    submitBtn.textContent = options.submittingText || 'Submitting...';

    // Collect data
    var formData = new FormData(formEl);
    var data = {};
    formData.forEach(function(value, key) {
      data[key] = value;
    });

    // Submit
    this._request('POST', '/forms/' + formId + '/submissions', { data: data })
      .then(function(response) {
        self._log('Form submitted', response);

        if (options.onSuccess) {
          options.onSuccess(response);
        } else {
          // Default success message
          formEl.innerHTML = '<div class="veilforms-success">' +
            (options.successMessage || 'Thank you! Your response has been recorded.') +
            '</div>';
        }
      })
      .catch(function(error) {
        self._log('Submission failed', error);

        submitBtn.disabled = false;
        submitBtn.textContent = originalText;

        if (options.onError) {
          options.onError(error);
        } else {
          alert(error.message || 'Failed to submit form. Please try again.');
        }
      });
  };

  /**
   * Inject default styles
   */
  VeilForms.prototype._injectStyles = function() {
    if (document.getElementById('veilforms-styles')) return;

    var styles = document.createElement('style');
    styles.id = 'veilforms-styles';
    styles.textContent = [
      '.veilforms-form { max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }',
      '.veilforms-title { margin: 0 0 0.5rem; font-size: 1.5rem; color: #1a1a2e; }',
      '.veilforms-description { margin: 0 0 1.5rem; color: #666; }',
      '.veilforms-field { margin-bottom: 1.25rem; }',
      '.veilforms-label { display: block; margin-bottom: 0.5rem; font-weight: 500; color: #333; }',
      '.veilforms-required { color: #e53935; }',
      '.veilforms-input { width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px; font-size: 1rem; box-sizing: border-box; transition: border-color 0.2s; }',
      '.veilforms-input:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1); }',
      'textarea.veilforms-input { resize: vertical; min-height: 100px; }',
      '.veilforms-radio-group { display: flex; flex-direction: column; gap: 0.5rem; }',
      '.veilforms-radio-option { display: flex; align-items: center; gap: 0.5rem; }',
      '.veilforms-radio-option input { margin: 0; }',
      '.veilforms-help { margin: 0.25rem 0 0; font-size: 0.875rem; color: #888; }',
      '.veilforms-submit { width: 100%; padding: 0.875rem; background: #6366f1; color: white; border: none; border-radius: 6px; font-size: 1rem; font-weight: 500; cursor: pointer; transition: background 0.2s; }',
      '.veilforms-submit:hover { background: #4f46e5; }',
      '.veilforms-submit:disabled { background: #a5b4fc; cursor: not-allowed; }',
      '.veilforms-loading, .veilforms-error, .veilforms-success { padding: 2rem; text-align: center; border-radius: 8px; }',
      '.veilforms-loading { background: #f5f5f5; color: #666; }',
      '.veilforms-error { background: #fef2f2; color: #dc2626; }',
      '.veilforms-success { background: #f0fdf4; color: #16a34a; }'
    ].join('\n');

    document.head.appendChild(styles);
  };

  /**
   * Create iframe embed
   */
  VeilForms.prototype.embed = function(formId, containerId, options) {
    options = options || {};

    var container = document.getElementById(containerId);
    if (!container) {
      console.error('[VeilForms] Container not found:', containerId);
      return;
    }

    var iframe = document.createElement('iframe');
    iframe.src = this.baseUrl + '/embed/' + formId;
    iframe.className = 'veilforms-iframe';
    iframe.style.width = options.width || '100%';
    iframe.style.height = options.height || '500px';
    iframe.style.border = 'none';
    iframe.style.borderRadius = options.borderRadius || '8px';
    iframe.setAttribute('loading', 'lazy');
    iframe.setAttribute('title', 'VeilForms Form');

    container.appendChild(iframe);

    return iframe;
  };

  /**
   * Submit form data programmatically
   */
  VeilForms.prototype.submit = function(formId, data) {
    this._log('Submitting form', { formId: formId, data: data });

    return this._request('POST', '/forms/' + formId + '/submissions', { data: data });
  };

  // Expose globally
  window.VeilForms = VeilForms;

  // Auto-initialize if data attributes present
  document.addEventListener('DOMContentLoaded', function() {
    var autoForms = document.querySelectorAll('[data-veilforms-auto]');
    if (autoForms.length) {
      var vf = new VeilForms();
      autoForms.forEach(function(el) {
        var formId = el.getAttribute('data-veilforms-id');
        if (formId) {
          vf.render(formId, el.id);
        }
      });
    }
  });

})(window, document);
