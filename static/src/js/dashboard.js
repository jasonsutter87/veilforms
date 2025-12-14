// VeilForms Dashboard JavaScript

// Import shared modules
import {
  api,
  getToken,
  getUser,
  setAuth,
  clearAuth,
  isAuthenticated,
  redirectToLogin,
  formsApi,
  submissionsApi
} from './modules/index.js';

import {
  escapeHtml,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  copyToClipboard,
  debounce,
  show,
  hide,
  sanitizeHtml,
  sanitizeJson,
  sanitizeUrl,
  setSafeInnerHTML
} from './modules/index.js';

import {
  showToast,
  toast,
  confirm as confirmDialog
} from './modules/index.js';

import {
  $,
  $$,
  byId,
  on,
  delegate,
  addClass,
  removeClass,
  toggleClass,
  setHtml,
  setText,
  getFormData
} from './modules/index.js';

// State - keeping local for now, can migrate to state-manager later
const state = {
  user: null,
  token: null,
  forms: [],
  currentForm: null,
  submissions: [],
  pagination: null,
  decryptionKey: null,
  loading: true,
  error: null
};

// Auth Guard
function checkAuth() {
  if (!isAuthenticated()) {
    redirectToLogin();
    return false;
  }

  try {
    state.token = getToken();
    state.user = getUser();
    return true;
  } catch {
    redirectToLogin();
    return false;
  }
}

function showLoading() {
  show('loading-state');
  hide('error-state');
  hide('empty-state');
  hide('forms-grid');
  hide('form-detail');
  hide('submissions-view');
}

function showError(message) {
  hide('loading-state');
  show('error-state');
  document.getElementById('error-message').textContent = message;
}

function showEmpty() {
  hide('loading-state');
  hide('error-state');
  show('empty-state');
  hide('forms-grid');
}

function showForms() {
  hide('loading-state');
  hide('error-state');
  hide('empty-state');
  show('forms-grid');
  hide('form-detail');
  hide('submissions-view');
}

// Load Forms
async function loadForms() {
  showLoading();

  try {
    const data = await api('/api/forms/');
    state.forms = data.forms || [];

    if (state.forms.length === 0) {
      showEmpty();
    } else {
      renderForms();
      showForms();
    }
  } catch (err) {
    console.error('Load forms error:', err);
    showError(err.message);
  }
}

// Render Forms Grid
function renderForms() {
  const grid = document.getElementById('forms-grid');
  const formsHtml = state.forms.map(form => `
    <div class="form-card" data-form-id="${form.id}">
      <div class="form-card-header">
        <h3 class="form-card-title">${escapeHtml(form.name)}</h3>
        <span class="form-card-status ${form.status || 'active'}">${form.status || 'Active'}</span>
      </div>
      <div class="form-card-stats">
        <div class="form-stat">
          <span class="stat-value">${form.submissionCount || 0}</span>
          <span class="stat-label">Submissions</span>
        </div>
        <div class="form-stat">
          <span class="stat-value stat-time">${form.lastSubmissionAt ? formatRelativeTime(form.lastSubmissionAt) : 'Never'}</span>
          <span class="stat-label">Last submission</span>
        </div>
      </div>
      <div class="form-card-footer">
        <span>Created ${formatDate(form.createdAt)}</span>
        <div class="form-card-actions">
          <button class="btn-view" title="View submissions" data-action="view" data-form-id="${form.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          </button>
          <button class="btn-settings" title="Settings" data-action="settings" data-form-id="${form.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
          <button class="btn-delete" title="Delete" data-action="delete" data-form-id="${form.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `).join('');

  // Use sanitized innerHTML for XSS protection
  setSafeInnerHTML(grid, formsHtml);

  // Add click handlers
  grid.querySelectorAll('.form-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      const formId = card.dataset.formId;
      viewFormDetail(formId);
    });
  });

  grid.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      const formId = btn.dataset.formId;

      if (action === 'view') viewSubmissions(formId);
      if (action === 'settings') viewFormDetail(formId);
      if (action === 'delete') confirmDelete(formId);
    });
  });
}

// View Form Detail
async function viewFormDetail(formId) {
  const form = state.forms.find(f => f.id === formId);
  if (!form) return;

  state.currentForm = form;
  document.getElementById('page-title').textContent = form.name;

  hide('forms-grid');
  hide('empty-state');
  show('form-detail');

  const detail = document.getElementById('form-detail');
  const detailHtml = `
    <div class="detail-header">
      <button class="back-btn" id="back-to-forms">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
        Back to Forms
      </button>
      <div class="detail-actions">
        <button class="btn btn-primary" id="edit-form-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
          Edit Form
        </button>
        <button class="btn btn-secondary" id="view-submissions-btn">View Submissions</button>
      </div>
    </div>

    <div class="detail-section">
      <h3>Embed Code</h3>
      <p style="color: var(--text-muted); font-size: 0.875rem; margin-bottom: 16px;">
        Add this script to your website to enable form submissions.
      </p>
      <div class="embed-code">
        <pre>&lt;script src="https://veilforms.com/js/veilforms-1.0.0.min.js"&gt;&lt;/script&gt;
&lt;script&gt;
  VeilForms.init('${form.id}', {
    publicKey: ${JSON.stringify(form.publicKey)}
  });
&lt;/script&gt;</pre>
        <button class="btn btn-secondary copy-btn" data-copy="embed">Copy</button>
      </div>
    </div>

    <div class="detail-section">
      <h3>Public Key</h3>
      <p style="color: var(--text-muted); font-size: 0.875rem; margin-bottom: 16px;">
        This key is used to encrypt submissions. Share it in your embed code.
      </p>
      <div class="embed-code">
        <pre>${JSON.stringify(form.publicKey, null, 2)}</pre>
        <button class="btn btn-secondary copy-btn" data-copy="publicKey">Copy</button>
      </div>
    </div>

    <div class="detail-section">
      <h3>Settings</h3>
      <form id="form-settings-form">
        <div class="form-group">
          <label for="edit-form-name">Form Name</label>
          <input type="text" id="edit-form-name" value="${escapeHtml(form.name)}" maxlength="100">
        </div>
        <div class="form-group">
          <label for="edit-form-status">Status</label>
          <select id="edit-form-status">
            <option value="active" ${form.status === 'active' ? 'selected' : ''}>Active</option>
            <option value="paused" ${form.status === 'paused' ? 'selected' : ''}>Paused</option>
          </select>
        </div>
        <div class="form-group">
          <label>
            <input type="checkbox" id="edit-form-pii-strip" ${form.settings?.piiStrip ? 'checked' : ''}>
            Auto-strip PII before encryption
          </label>
          <small>Automatically detect and redact personal information</small>
        </div>
        <button type="submit" class="btn btn-primary">Save Changes</button>
      </form>
    </div>

    <div class="detail-section">
      <h3>Webhook Configuration</h3>
      <p style="color: var(--text-muted); font-size: 0.875rem; margin-bottom: 16px;">
        Receive real-time notifications when new submissions arrive.
      </p>
      <form id="webhook-form">
        <div class="form-group">
          <label for="webhook-url">Webhook URL</label>
          <input type="url" id="webhook-url" value="${escapeHtml(form.settings?.webhookUrl || '')}" placeholder="https://your-server.com/webhook">
          <small>We'll send a POST request with submission data to this URL</small>
        </div>
        <div class="webhook-actions">
          <button type="submit" class="btn btn-primary">Save Webhook</button>
          <button type="button" class="btn btn-secondary" id="test-webhook-btn" ${!form.settings?.webhookUrl ? 'disabled' : ''}>
            Test Webhook
          </button>
        </div>
      </form>

      <div class="webhook-test-result" id="webhook-test-result" style="display: none; margin-top: 16px;">
        <!-- Test result shown here -->
      </div>

      <div class="webhook-logs-section" style="margin-top: 24px;">
        <h4 style="font-size: 0.875rem; margin-bottom: 12px; color: var(--text-muted);">Recent Delivery Logs</h4>
        <div id="webhook-logs">
          <p style="color: var(--text-muted); font-size: 0.875rem; font-style: italic;">
            ${form.webhookLogs?.length > 0 ? '' : 'No webhook deliveries yet. Logs will appear here after webhooks are triggered.'}
          </p>
          ${form.webhookLogs?.length > 0 ? `
            <div class="webhook-logs-table">
              <table class="mini-table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Response</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  ${form.webhookLogs.slice(0, 10).map(log => `
                    <tr>
                      <td>
                        <span class="status-badge ${log.success ? 'success' : 'error'}">
                          ${log.statusCode || (log.success ? 'OK' : 'Failed')}
                        </span>
                      </td>
                      <td class="truncate">${escapeHtml(log.message || log.error || '-')}</td>
                      <td>${formatRelativeTime(log.timestamp)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}
        </div>
      </div>
    </div>

    <div class="detail-section" style="border-color: var(--danger);">
      <h3 style="color: var(--danger);">Danger Zone</h3>
      <p style="color: var(--text-muted); font-size: 0.875rem; margin-bottom: 16px;">
        These actions cannot be undone.
      </p>
      <button class="btn btn-danger" id="delete-form-btn">Delete Form</button>
    </div>
  `;

  // Use sanitized innerHTML for XSS protection
  setSafeInnerHTML(detail, detailHtml);

  // Event handlers
  document.getElementById('back-to-forms').addEventListener('click', () => {
    document.getElementById('page-title').textContent = 'Forms';
    hide('form-detail');
    show('forms-grid');
    state.currentForm = null;
  });

  document.getElementById('edit-form-btn').addEventListener('click', () => {
    showFormBuilder(formId, form.name, form.fields || []);
  });

  document.getElementById('view-submissions-btn').addEventListener('click', () => {
    viewSubmissions(formId);
  });

  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const pre = btn.previousElementSibling;
      navigator.clipboard.writeText(pre.textContent);
      btn.textContent = 'Copied!';
      setTimeout(() => btn.textContent = 'Copy', 2000);
    });
  });

  document.getElementById('form-settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await updateForm(formId);
  });

  document.getElementById('delete-form-btn').addEventListener('click', () => {
    confirmDelete(formId);
  });

  // Webhook form
  document.getElementById('webhook-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const webhookUrl = document.getElementById('webhook-url').value.trim();

    try {
      await api(`/api/forms/${formId}`, {
        method: 'PUT',
        body: JSON.stringify({
          settings: { webhookUrl: webhookUrl || null }
        })
      });

      // Update local form data
      if (!form.settings) form.settings = {};
      form.settings.webhookUrl = webhookUrl || null;

      // Enable/disable test button
      document.getElementById('test-webhook-btn').disabled = !webhookUrl;

      alert('Webhook saved successfully!');
    } catch (err) {
      alert('Failed to save webhook: ' + err.message);
    }
  });

  // Test webhook button
  document.getElementById('test-webhook-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('test-webhook-btn');
    const resultDiv = document.getElementById('webhook-test-result');
    const webhookUrl = document.getElementById('webhook-url').value.trim();

    if (!webhookUrl) {
      alert('Please enter a webhook URL first');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Testing...';
    resultDiv.style.display = 'block';
    setSafeInnerHTML(resultDiv, '<p style="color: var(--text-muted);">Sending test request...</p>');

    try {
      const result = await api(`/api/forms/${formId}/webhook-test`, {
        method: 'POST'
      });

      if (result.success) {
        const successHtml = `
          <div class="test-result success">
            <strong>Success!</strong>
            <p>Webhook responded with status ${result.statusCode || 200}</p>
            ${result.responseTime ? `<p>Response time: ${result.responseTime}ms</p>` : ''}
          </div>
        `;
        setSafeInnerHTML(resultDiv, successHtml);
      } else {
        const failHtml = `
          <div class="test-result error">
            <strong>Failed</strong>
            <p>${escapeHtml(result.error || 'Webhook did not respond successfully')}</p>
          </div>
        `;
        setSafeInnerHTML(resultDiv, failHtml);
      }
    } catch (err) {
      const errorHtml = `
        <div class="test-result error">
          <strong>Error</strong>
          <p>${escapeHtml(err.message)}</p>
        </div>
      `;
      setSafeInnerHTML(resultDiv, errorHtml);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Test Webhook';
    }
  });
}

// Update Form
async function updateForm(formId) {
  const name = document.getElementById('edit-form-name').value;
  const status = document.getElementById('edit-form-status').value;
  const piiStrip = document.getElementById('edit-form-pii-strip').checked;

  // Get the current form to preserve other settings
  const form = state.forms.find(f => f.id === formId);
  const currentSettings = form?.settings || {};

  try {
    await api(`/api/forms/${formId}`, {
      method: 'PUT',
      body: JSON.stringify({
        name,
        status,
        settings: {
          ...currentSettings,
          piiStrip
        }
      })
    });

    // Reload forms
    await loadForms();
    alert('Form updated successfully!');
  } catch (err) {
    alert('Failed to update form: ' + err.message);
  }
}

// View Submissions
async function viewSubmissions(formId) {
  const form = state.forms.find(f => f.id === formId);
  if (!form) return;

  state.currentForm = form;
  document.getElementById('page-title').textContent = `${form.name} - Submissions`;

  hide('forms-grid');
  hide('form-detail');
  hide('empty-state');
  show('submissions-view');
  showLoading();

  try {
    const data = await api(`/api/submissions/${formId}`);
    state.submissions = data.submissions || [];
    state.pagination = data.pagination;

    renderSubmissions();
    hide('loading-state');
  } catch (err) {
    showError(err.message);
  }
}

// Render Submissions
function renderSubmissions() {
  const view = document.getElementById('submissions-view');

  if (state.submissions.length === 0) {
    const emptyHtml = `
      <div class="submissions-header">
        <button class="back-btn" id="back-from-submissions">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          Back to Forms
        </button>
      </div>
      <div class="empty-state">
        <h2>No submissions yet</h2>
        <p>Submissions will appear here once your form receives data.</p>
      </div>
    `;
    setSafeInnerHTML(view, emptyHtml);
  } else {
    const decrypted = state.decryptionKey ? 'Decrypted' : 'Encrypted';

    const submissionsHtml = `
      <div class="submissions-header">
        <button class="back-btn" id="back-from-submissions">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          Back to Forms
        </button>
        <div class="submissions-actions">
          <button class="btn btn-secondary" id="decrypt-submissions-btn">
            ${state.decryptionKey ? 'Change Key' : 'Decrypt'}
          </button>
          <button class="btn btn-secondary" id="export-csv-btn" ${!state.decryptionKey ? 'disabled' : ''}>
            Export CSV
          </button>
        </div>
      </div>

      <div class="submissions-table-wrapper">
        <table class="submissions-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Date</th>
              <th>Status</th>
              <th>Data</th>
            </tr>
          </thead>
          <tbody>
            ${state.submissions.map(sub => `
              <tr data-id="${sub.id}">
                <td><code>${sub.id.substring(0, 12)}...</code></td>
                <td>${formatDate(sub.timestamp || sub.receivedAt)}</td>
                <td>
                  <span class="encrypted-badge">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                    ${decrypted}
                  </span>
                </td>
                <td class="submission-data">
                  ${state.decryptionKey && sub._decrypted
                    ? `<pre>${sanitizeJson(sub._decrypted, 2)}</pre>`
                    : '<em>Click "Decrypt" to view</em>'
                  }
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        ${state.pagination && state.pagination.total > state.pagination.limit ? `
          <div class="pagination">
            <button id="prev-page" ${state.pagination.offset === 0 ? 'disabled' : ''}>Previous</button>
            <span class="page-info">
              ${state.pagination.offset + 1}-${Math.min(state.pagination.offset + state.pagination.limit, state.pagination.total)}
              of ${state.pagination.total}
            </span>
            <button id="next-page" ${!state.pagination.hasMore ? 'disabled' : ''}>Next</button>
          </div>
        ` : ''}
      </div>
    `;
    setSafeInnerHTML(view, submissionsHtml);
  }

  // Event handlers
  document.getElementById('back-from-submissions')?.addEventListener('click', () => {
    document.getElementById('page-title').textContent = 'Forms';
    hide('submissions-view');
    show('forms-grid');
    state.currentForm = null;
    state.submissions = [];
    state.decryptionKey = null;
  });

  document.getElementById('decrypt-submissions-btn')?.addEventListener('click', () => {
    show('decrypt-modal');
  });

  document.getElementById('export-csv-btn')?.addEventListener('click', exportToCSV);
}

// Decrypt Submissions
async function decryptSubmissions(privateKeyJwk) {
  try {
    const privateKey = await crypto.subtle.importKey(
      'jwk',
      privateKeyJwk,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['decrypt']
    );

    for (const sub of state.submissions) {
      try {
        // Decrypt the symmetric key
        const encryptedKey = Uint8Array.from(atob(sub.payload.encryptedKey), c => c.charCodeAt(0));
        const symmetricKeyBuffer = await crypto.subtle.decrypt(
          { name: 'RSA-OAEP' },
          privateKey,
          encryptedKey
        );

        // Import symmetric key
        const symmetricKey = await crypto.subtle.importKey(
          'raw',
          symmetricKeyBuffer,
          { name: 'AES-GCM' },
          false,
          ['decrypt']
        );

        // Decrypt the data
        const iv = Uint8Array.from(atob(sub.payload.iv), c => c.charCodeAt(0));
        const encrypted = Uint8Array.from(atob(sub.payload.encrypted), c => c.charCodeAt(0));

        const decrypted = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv },
          symmetricKey,
          encrypted
        );

        const decoder = new TextDecoder();
        sub._decrypted = JSON.parse(decoder.decode(decrypted));
      } catch (err) {
        console.error('Failed to decrypt submission:', sub.id, err);
        sub._decrypted = { error: 'Failed to decrypt' };
      }
    }

    state.decryptionKey = privateKeyJwk;
    renderSubmissions();
    hide('decrypt-modal');
  } catch (err) {
    alert('Failed to decrypt: ' + err.message);
  }
}

// Export to CSV
function exportToCSV() {
  if (!state.decryptionKey || state.submissions.length === 0) return;

  // Get all unique keys from decrypted data
  const allKeys = new Set(['id', 'timestamp']);
  state.submissions.forEach(sub => {
    if (sub._decrypted && typeof sub._decrypted === 'object') {
      Object.keys(sub._decrypted).forEach(key => allKeys.add(key));
    }
  });

  const headers = Array.from(allKeys);
  const rows = state.submissions.map(sub => {
    return headers.map(header => {
      if (header === 'id') return sub.id;
      if (header === 'timestamp') return new Date(sub.timestamp || sub.receivedAt).toISOString();
      const value = sub._decrypted?.[header];
      if (value === undefined || value === null) return '';
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value).replace(/"/g, '""');
    });
  });

  const csv = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.currentForm?.name || 'submissions'}-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Create Form
async function createForm() {
  const name = document.getElementById('form-name').value.trim();
  const piiStrip = document.getElementById('form-pii-strip').checked;
  const webhookUrl = document.getElementById('form-webhook').value.trim();

  if (!name) {
    alert('Please enter a form name');
    return;
  }

  // Validate webhook URL format if provided
  if (webhookUrl) {
    try {
      const url = new URL(webhookUrl);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        alert('Webhook URL must use http:// or https://');
        return;
      }
    } catch (err) {
      alert('Please enter a valid webhook URL');
      return;
    }
  }

  try {
    const data = await api('/api/forms/', {
      method: 'POST',
      body: JSON.stringify({
        name,
        settings: {
          piiStrip,
          webhookUrl: webhookUrl || null
        }
      })
    });

    // Close create modal
    hide('create-form-modal');

    // Show private key modal
    document.getElementById('private-key-display').value = JSON.stringify(data.form.privateKey, null, 2);
    show('private-key-modal');

    // Reset form
    document.getElementById('create-form-form').reset();

    // Reload forms list
    await loadForms();
  } catch (err) {
    alert('Failed to create form: ' + err.message);
  }
}

// Confirm Delete
function confirmDelete(formId) {
  const form = state.forms.find(f => f.id === formId);
  if (!form) return;

  document.getElementById('delete-form-name').textContent = form.name;
  document.getElementById('confirm-delete-btn').dataset.formId = formId;
  show('delete-modal');
}

// Delete Form
async function deleteForm(formId) {
  try {
    await api(`/api/forms/${formId}`, { method: 'DELETE' });
    hide('delete-modal');
    hide('form-detail');
    document.getElementById('page-title').textContent = 'Forms';
    await loadForms();
  } catch (err) {
    alert('Failed to delete form: ' + err.message);
  }
}

// Logout
async function logout() {
  const token = localStorage.getItem('veilforms_token');

  if (token) {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
    } catch (err) {
      console.error('Logout error:', err);
    }
  }

  localStorage.removeItem('veilforms_token');
  localStorage.removeItem('veilforms_user');
  window.location.href = '/login/';
}

// Utility functions imported from ./modules/index.js

// Initialize Dashboard
function init() {
  // Check authentication
  if (!checkAuth()) return;

  // Update user info
  const userInfo = document.getElementById('user-info');
  if (userInfo && state.user) {
    userInfo.querySelector('.user-email').textContent = state.user.email;
    userInfo.querySelector('.user-plan').textContent = state.user.subscription || 'Free';
  }

  // Load forms
  loadForms();

  // Event Listeners

  // Mobile menu toggle
  document.getElementById('menu-toggle')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  document.getElementById('sidebar-close')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
  });

  // Create form button
  document.getElementById('create-form-btn')?.addEventListener('click', () => {
    show('create-form-modal');
  });

  document.getElementById('create-first-form-btn')?.addEventListener('click', () => {
    show('create-form-modal');
  });

  // Create form modal
  document.getElementById('cancel-create-btn')?.addEventListener('click', () => {
    hide('create-form-modal');
  });

  document.getElementById('submit-create-btn')?.addEventListener('click', createForm);

  document.querySelectorAll('.modal-backdrop, .modal-close').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
      });
    });
  });

  // Private key modal
  document.getElementById('copy-key-btn')?.addEventListener('click', () => {
    const textarea = document.getElementById('private-key-display');
    navigator.clipboard.writeText(textarea.value);
    document.getElementById('copy-key-btn').textContent = 'Copied!';
    setTimeout(() => {
      document.getElementById('copy-key-btn').textContent = 'Copy to Clipboard';
    }, 2000);
  });

  document.getElementById('download-key-btn')?.addEventListener('click', () => {
    const key = document.getElementById('private-key-display').value;
    const blob = new Blob([key], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `veilforms-private-key-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('confirm-saved-key')?.addEventListener('change', (e) => {
    document.getElementById('close-key-modal-btn').disabled = !e.target.checked;
  });

  document.getElementById('close-key-modal-btn')?.addEventListener('click', () => {
    hide('private-key-modal');
    document.getElementById('confirm-saved-key').checked = false;
    document.getElementById('close-key-modal-btn').disabled = true;
  });

  // Delete modal
  document.getElementById('cancel-delete-btn')?.addEventListener('click', () => {
    hide('delete-modal');
  });

  document.getElementById('confirm-delete-btn')?.addEventListener('click', (e) => {
    const formId = e.target.dataset.formId;
    if (formId) deleteForm(formId);
  });

  // Decrypt modal
  document.getElementById('decrypt-btn')?.addEventListener('click', () => {
    const keyText = document.getElementById('decrypt-key').value.trim();
    try {
      const key = JSON.parse(keyText);
      decryptSubmissions(key);
    } catch (err) {
      alert('Invalid private key format. Please paste a valid JWK.');
    }
  });

  document.querySelectorAll('.modal-close-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.modal').style.display = 'none';
    });
  });

  // Retry button
  document.getElementById('retry-btn')?.addEventListener('click', loadForms);

  // Logout
  document.getElementById('logout-btn')?.addEventListener('click', logout);

  // API Keys navigation
  document.getElementById('nav-api-keys')?.addEventListener('click', (e) => {
    e.preventDefault();
    showApiKeys();
  });

  // Settings navigation
  document.getElementById('nav-settings')?.addEventListener('click', (e) => {
    e.preventDefault();
    showSettings();
  });

  // Audit Logs navigation
  document.getElementById('nav-audit-logs')?.addEventListener('click', (e) => {
    e.preventDefault();
    showAuditLogs();
  });

  // Create API Key button
  document.getElementById('cancel-api-key-btn')?.addEventListener('click', () => {
    hide('create-api-key-modal');
  });

  document.getElementById('submit-api-key-btn')?.addEventListener('click', createApiKey);

  // API Key created modal
  document.getElementById('copy-api-key-btn')?.addEventListener('click', () => {
    const key = document.getElementById('new-api-key').textContent;
    navigator.clipboard.writeText(key);
    document.getElementById('copy-api-key-btn').textContent = 'Copied!';
    setTimeout(() => {
      document.getElementById('copy-api-key-btn').textContent = 'Copy';
    }, 2000);
  });

  document.getElementById('confirm-saved-api-key')?.addEventListener('change', (e) => {
    document.getElementById('close-api-key-modal-btn').disabled = !e.target.checked;
  });

  document.getElementById('close-api-key-modal-btn')?.addEventListener('click', () => {
    hide('api-key-created-modal');
    document.getElementById('confirm-saved-api-key').checked = false;
    document.getElementById('close-api-key-modal-btn').disabled = true;
    loadApiKeys();
  });
}

// API Keys State
let apiKeys = [];

// Show API Keys View
async function showApiKeys() {
  document.getElementById('page-title').textContent = 'API Keys';

  // Update nav active state
  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  document.getElementById('nav-api-keys')?.classList.add('active');

  // Hide other views
  hide('forms-grid');
  hide('form-detail');
  hide('submissions-view');
  hide('empty-state');
  show('api-keys-view');

  // Hide create form button, show create key button
  const topbarActions = document.querySelector('.topbar-actions');
  topbarActions.innerHTML = `
    <button class="btn btn-primary" id="create-api-key-btn">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
      New API Key
    </button>
  `;

  document.getElementById('create-api-key-btn')?.addEventListener('click', () => {
    show('create-api-key-modal');
  });

  await loadApiKeys();
}

// Load API Keys
async function loadApiKeys() {
  const view = document.getElementById('api-keys-view');
  setSafeInnerHTML(view, '<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>');

  try {
    const data = await api('/api/api-keys/');
    apiKeys = data.keys || [];
    renderApiKeys();
  } catch (err) {
    console.error('Load API keys error:', err);
    const errorHtml = `
      <div class="error-state">
        <div class="error-icon">!</div>
        <h2>Failed to load API keys</h2>
        <p>${escapeHtml(err.message)}</p>
        <button class="btn btn-secondary" onclick="loadApiKeys()">Try Again</button>
      </div>
    `;
    setSafeInnerHTML(view, errorHtml);
  }
}

// Render API Keys
function renderApiKeys() {
  const view = document.getElementById('api-keys-view');

  if (apiKeys.length === 0) {
    const emptyHtml = `
      <div class="api-keys-empty">
        <div class="empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="64" height="64">
            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
          </svg>
        </div>
        <h2>No API keys yet</h2>
        <p>Create an API key to access VeilForms programmatically.</p>
        <button class="btn btn-primary" onclick="document.getElementById('create-api-key-modal').style.display='block'">Create API Key</button>
      </div>
    `;
    setSafeInnerHTML(view, emptyHtml);
    return;
  }

  const apiKeysHtml = `
    <div class="api-keys-header">
      <p class="api-keys-info">API keys allow you to access VeilForms programmatically. Keep your keys secure!</p>
    </div>
    <div class="api-keys-table-wrapper">
      <table class="api-keys-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Key</th>
            <th>Permissions</th>
            <th>Created</th>
            <th>Last Used</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${apiKeys.map(key => `
            <tr data-key-id="${key.id}">
              <td><strong>${escapeHtml(key.name)}</strong></td>
              <td><code>${escapeHtml(key.prefix)}</code></td>
              <td class="permissions-cell">
                ${key.permissions.map(p => `<span class="permission-badge">${p.split(':')[1]}</span>`).join('')}
              </td>
              <td>${formatDate(key.createdAt)}</td>
              <td>${key.lastUsed ? formatDate(key.lastUsed) : 'Never'}</td>
              <td>
                <button class="btn-revoke" title="Revoke key" data-key-id="${key.id}" data-key-name="${escapeHtml(key.name)}">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
  setSafeInnerHTML(view, apiKeysHtml);

  // Add revoke handlers
  view.querySelectorAll('.btn-revoke').forEach(btn => {
    btn.addEventListener('click', () => {
      const keyId = btn.dataset.keyId;
      const keyName = btn.dataset.keyName;
      if (confirm(`Are you sure you want to revoke "${keyName}"? This cannot be undone.`)) {
        revokeApiKey(keyId);
      }
    });
  });
}

// Create API Key
async function createApiKey() {
  const name = document.getElementById('api-key-name').value.trim();
  const checkboxes = document.querySelectorAll('#create-api-key-form input[name="permissions"]:checked');
  const permissions = Array.from(checkboxes).map(cb => cb.value);

  if (!name) {
    alert('Please enter a key name');
    return;
  }

  if (permissions.length === 0) {
    alert('Please select at least one permission');
    return;
  }

  try {
    const data = await api('/api/api-keys/', {
      method: 'POST',
      body: JSON.stringify({ name, permissions })
    });

    // Hide create modal
    hide('create-api-key-modal');
    document.getElementById('create-api-key-form').reset();

    // Show the key
    document.getElementById('new-api-key').textContent = data.key.key;
    show('api-key-created-modal');
  } catch (err) {
    alert('Failed to create API key: ' + err.message);
  }
}

// Revoke API Key
async function revokeApiKey(keyId) {
  try {
    await api(`/api/api-keys/${keyId}`, { method: 'DELETE' });
    await loadApiKeys();
  } catch (err) {
    alert('Failed to revoke API key: ' + err.message);
  }
}

// =====================
// Form Builder
// =====================

const formBuilder = {
  formId: null,
  formName: '',
  fields: [],
  selectedFieldId: null,
  draggedFieldType: null,
  draggedFieldId: null,
  isDirty: false
};

// Field type configurations
const fieldTypes = {
  text: { label: 'Text Input', icon: 'text', hasPlaceholder: true, hasValidation: true },
  email: { label: 'Email', icon: 'email', hasPlaceholder: true, hasValidation: true },
  textarea: { label: 'Text Area', icon: 'textarea', hasPlaceholder: true, hasValidation: false },
  number: { label: 'Number', icon: 'number', hasPlaceholder: true, hasValidation: true, hasMinMax: true },
  phone: { label: 'Phone', icon: 'phone', hasPlaceholder: true, hasValidation: true },
  select: { label: 'Dropdown', icon: 'select', hasOptions: true },
  checkbox: { label: 'Checkbox', icon: 'checkbox', hasOptions: true },
  radio: { label: 'Radio', icon: 'radio', hasOptions: true },
  date: { label: 'Date', icon: 'date', hasMinMax: true },
  url: { label: 'URL', icon: 'url', hasPlaceholder: true, hasValidation: true },
  hidden: { label: 'Hidden', icon: 'hidden', hasDefaultValue: true },
  payment: { label: 'Payment', icon: 'payment', hasPaymentConfig: true, isSingleInstance: true },
  heading: { label: 'Heading', icon: 'heading', isLayout: true },
  paragraph: { label: 'Paragraph', icon: 'paragraph', isLayout: true },
  divider: { label: 'Divider', icon: 'divider', isLayout: true },
  page_break: { label: 'Page Break', icon: 'page_break', isLayout: true, hasStepSettings: true }
};

// Generate unique field ID using crypto API
function generateFieldId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return 'field_' + crypto.randomUUID().replace(/-/g, '').substring(0, 12);
  }
  // Fallback for older browsers
  return 'field_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// Toast notifications imported from ./modules/index.js

// Validate field name is a valid JavaScript property name
function isValidFieldName(name) {
  if (!name || typeof name !== 'string') return false;
  // Must start with letter or underscore, followed by letters, numbers, or underscores
  const validPattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
  return validPattern.test(name);
}

// Get unique field name (auto-increment if duplicate)
function getUniqueFieldName(baseName, excludeFieldId = null) {
  const existingNames = formBuilder.fields
    .filter(f => f.id !== excludeFieldId)
    .map(f => f.name)
    .filter(Boolean);

  if (!existingNames.includes(baseName)) {
    return baseName;
  }

  let counter = 1;
  let uniqueName = `${baseName}_${counter}`;
  while (existingNames.includes(uniqueName)) {
    counter++;
    uniqueName = `${baseName}_${counter}`;
  }

  return uniqueName;
}

// Validate field configuration
function validateField(field) {
  const errors = [];
  const typeConfig = fieldTypes[field.type];

  // Skip validation for layout elements
  if (typeConfig?.isLayout) {
    if (field.type === 'heading' && !field.content) {
      errors.push('Heading text is required');
    }
    if (field.type === 'paragraph' && !field.content) {
      errors.push('Paragraph text is required');
    }
    return errors;
  }

  // Validate field name
  if (!field.name) {
    errors.push('Field name is required');
  } else if (!isValidFieldName(field.name)) {
    errors.push('Field name must be a valid identifier (letters, numbers, underscores only, cannot start with a number)');
  }

  // Check for duplicate field names
  const duplicates = formBuilder.fields.filter(f => f.id !== field.id && f.name === field.name);
  if (duplicates.length > 0) {
    errors.push('Field name must be unique');
  }

  // Validate options for select/checkbox/radio
  if (typeConfig?.hasOptions) {
    if (!field.options || !Array.isArray(field.options) || field.options.length === 0) {
      errors.push('At least one option is required');
    } else {
      const emptyOptions = field.options.filter(opt => !opt || opt.trim() === '');
      if (emptyOptions.length > 0) {
        errors.push('Options cannot be empty');
      }
    }
  }

  return errors;
}

// Validate all fields before save
function validateAllFields() {
  const allErrors = [];

  formBuilder.fields.forEach((field, index) => {
    const errors = validateField(field);
    if (errors.length > 0) {
      const typeConfig = fieldTypes[field.type];
      const fieldLabel = typeConfig?.isLayout
        ? `${typeConfig.label} (position ${index + 1})`
        : `Field "${field.label || field.name || 'Untitled'}"`;
      allErrors.push({
        field: fieldLabel,
        errors: errors
      });
    }
  });

  return allErrors;
}

// Create default field config
function createFieldConfig(type) {
  const typeConfig = fieldTypes[type];
  const fieldId = generateFieldId();

  // Generate unique field name
  const baseName = typeConfig.isLayout ? '' : type + '_' + fieldId.substring(6, 10);
  const uniqueName = typeConfig.isLayout ? '' : getUniqueFieldName(baseName);

  const config = {
    id: fieldId,
    type,
    label: typeConfig.isLayout ? '' : typeConfig.label,
    name: uniqueName,
    required: false
  };

  if (typeConfig.hasPlaceholder) {
    config.placeholder = '';
  }

  if (typeConfig.hasOptions) {
    config.options = ['Option 1', 'Option 2', 'Option 3'];
  }

  if (typeConfig.hasDefaultValue) {
    config.defaultValue = '';
  }

  if (typeConfig.hasMinMax) {
    config.min = '';
    config.max = '';
  }

  if (type === 'heading') {
    config.content = 'Section Heading';
    config.level = 'h3';
  }

  if (type === 'paragraph') {
    config.content = 'Add your text here...';
  }

  if (type === 'page_break') {
    config.stepTitle = 'Step ' + (formBuilder.fields.filter(f => f.type === 'page_break').length + 2);
    config.stepDescription = '';
  }

  // Initialize conditional logic structure
  // SDK Note: The SDK should evaluate these conditions client-side to dynamically
  // show/hide fields based on user input. Rules are evaluated in order, and the
  // logic type ('all' = AND, 'any' = OR) determines how multiple rules combine.
  config.conditions = null;

  return config;
}

// Show Form Builder
function showFormBuilder(formId, formName, existingFields = []) {
  formBuilder.formId = formId;
  formBuilder.formName = formName;
  formBuilder.fields = existingFields.length > 0 ? existingFields : [];
  formBuilder.selectedFieldId = null;
  formBuilder.isDirty = false;

  document.getElementById('page-title').textContent = `Edit Form: ${formName}`;

  // Update nav
  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));

  // Hide other views
  hide('forms-grid');
  hide('form-detail');
  hide('submissions-view');
  hide('api-keys-view');
  hide('empty-state');
  hide('loading-state');

  // Show form builder
  show('form-builder-view');

  // Hide topbar create button
  document.querySelector('.topbar-actions').innerHTML = '';

  // Hide field properties initially
  hide('field-properties');

  // Render fields
  renderFormFields();

  // Initialize drag and drop
  initFormBuilderDragDrop();

  // Initialize event listeners
  initFormBuilderEvents();

  // Set up beforeunload warning for unsaved changes
  setupBeforeUnloadWarning();
}

// Setup beforeunload warning
function setupBeforeUnloadWarning() {
  // Remove any existing handler first to avoid duplicates
  window.removeEventListener('beforeunload', beforeUnloadHandler);

  // Add new handler
  window.addEventListener('beforeunload', beforeUnloadHandler);
}

// Beforeunload handler
function beforeUnloadHandler(e) {
  if (formBuilder.isDirty) {
    e.preventDefault();
    // Chrome requires returnValue to be set
    e.returnValue = '';
    return '';
  }
}

// Initialize Form Builder Events
function initFormBuilderEvents() {
  // Back button
  document.getElementById('builder-back-btn')?.addEventListener('click', () => {
    if (formBuilder.isDirty) {
      if (!confirm('You have unsaved changes. Are you sure you want to leave?')) {
        return;
      }
    }
    exitFormBuilder();
  });

  // Preview button
  document.getElementById('preview-form-btn')?.addEventListener('click', showFormPreview);

  // Save button
  document.getElementById('save-form-btn')?.addEventListener('click', saveFormBuilder);

  // Close properties
  document.getElementById('close-properties')?.addEventListener('click', () => {
    formBuilder.selectedFieldId = null;
    hide('field-properties');
    document.querySelectorAll('.form-field-item.selected').forEach(el => el.classList.remove('selected'));
  });

  // Field type buttons (click to add)
  document.querySelectorAll('.field-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.fieldType;
      addField(type);
    });
  });
}

// Initialize Drag and Drop
function initFormBuilderDragDrop() {
  const dropzone = document.getElementById('canvas-dropzone');

  // Drag start from palette
  document.querySelectorAll('.field-type-btn').forEach(btn => {
    btn.addEventListener('dragstart', (e) => {
      formBuilder.draggedFieldType = btn.dataset.fieldType;
      formBuilder.draggedFieldId = null;
      btn.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'copy';
    });

    btn.addEventListener('dragend', () => {
      btn.classList.remove('dragging');
      formBuilder.draggedFieldType = null;
    });
  });

  // Drop zone events
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = formBuilder.draggedFieldType ? 'copy' : 'move';
    dropzone.classList.add('drag-over');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('drag-over');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');

    if (formBuilder.draggedFieldType) {
      addField(formBuilder.draggedFieldType);
      formBuilder.draggedFieldType = null;
    } else if (formBuilder.draggedFieldId) {
      // Handle reordering
      const placeholder = dropzone.querySelector('.drag-placeholder');
      if (placeholder) {
        const targetIndex = Array.from(dropzone.children).indexOf(placeholder);
        const field = formBuilder.fields.find(f => f.id === formBuilder.draggedFieldId);
        const currentIndex = formBuilder.fields.indexOf(field);

        if (currentIndex !== -1 && targetIndex !== currentIndex) {
          formBuilder.fields.splice(currentIndex, 1);
          const newIndex = targetIndex > currentIndex ? targetIndex - 1 : targetIndex;
          formBuilder.fields.splice(newIndex, 0, field);
          formBuilder.isDirty = true;
          renderFormFields();
        }
        placeholder.remove();
      }
      formBuilder.draggedFieldId = null;
    }
  });
}

// Add field to form
function addField(type, index = -1) {
  const field = createFieldConfig(type);

  if (index === -1) {
    formBuilder.fields.push(field);
  } else {
    formBuilder.fields.splice(index, 0, field);
  }

  formBuilder.isDirty = true;
  renderFormFields();
  selectField(field.id);
}

// Delete field
function deleteField(fieldId) {
  const index = formBuilder.fields.findIndex(f => f.id === fieldId);
  if (index !== -1) {
    formBuilder.fields.splice(index, 1);
    formBuilder.isDirty = true;

    if (formBuilder.selectedFieldId === fieldId) {
      formBuilder.selectedFieldId = null;
      hide('field-properties');
    }

    renderFormFields();
  }
}

// Duplicate field
function duplicateField(fieldId) {
  const original = formBuilder.fields.find(f => f.id === fieldId);
  if (original) {
    const duplicate = { ...original, id: generateFieldId() };
    // Ensure unique field name for duplicate
    if (duplicate.name) {
      duplicate.name = getUniqueFieldName(original.name + '_copy');
    }
    const index = formBuilder.fields.indexOf(original);
    formBuilder.fields.splice(index + 1, 0, duplicate);
    formBuilder.isDirty = true;
    renderFormFields();
    selectField(duplicate.id);
  }
}

// Select field
function selectField(fieldId) {
  formBuilder.selectedFieldId = fieldId;

  // Update visual selection
  document.querySelectorAll('.form-field-item').forEach(el => {
    el.classList.toggle('selected', el.dataset.fieldId === fieldId);
  });

  // Show and populate properties panel
  const field = formBuilder.fields.find(f => f.id === fieldId);
  if (field) {
    renderFieldProperties(field);
    show('field-properties');
  }
}

// Render Form Fields
function renderFormFields() {
  const dropzone = document.getElementById('canvas-dropzone');

  if (formBuilder.fields.length === 0) {
    dropzone.classList.remove('has-fields');
    dropzone.innerHTML = `
      <div class="dropzone-hint">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        <p>Drag fields here to build your form</p>
        <p class="hint-sub">or click a field type to add it</p>
      </div>
    `;
    return;
  }

  dropzone.classList.add('has-fields');
  // Use sanitized innerHTML for XSS protection
  const fieldsHtml = formBuilder.fields.map(field => renderFieldItem(field)).join('');
  setSafeInnerHTML(dropzone, fieldsHtml);

  // Add event listeners to field items
  dropzone.querySelectorAll('.form-field-item').forEach(item => {
    const fieldId = item.dataset.fieldId;

    // Click to select
    item.addEventListener('click', (e) => {
      if (!e.target.closest('.field-actions')) {
        selectField(fieldId);
      }
    });

    // Drag to reorder
    item.setAttribute('draggable', 'true');
    item.addEventListener('dragstart', (e) => {
      formBuilder.draggedFieldId = fieldId;
      formBuilder.draggedFieldType = null;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      formBuilder.draggedFieldId = null;
      document.querySelectorAll('.drag-placeholder').forEach(el => el.remove());
    });

    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (formBuilder.draggedFieldId && formBuilder.draggedFieldId !== fieldId) {
        const placeholder = document.querySelector('.drag-placeholder') || document.createElement('div');
        placeholder.className = 'drag-placeholder';
        const rect = item.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        if (e.clientY < midY) {
          item.parentNode.insertBefore(placeholder, item);
        } else {
          item.parentNode.insertBefore(placeholder, item.nextSibling);
        }
      }
    });

    // Delete button
    item.querySelector('.btn-delete')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('Delete this field?')) {
        deleteField(fieldId);
      }
    });

    // Duplicate button
    item.querySelector('.btn-duplicate')?.addEventListener('click', (e) => {
      e.stopPropagation();
      duplicateField(fieldId);
    });
  });

  // Highlight selected
  if (formBuilder.selectedFieldId) {
    const selected = dropzone.querySelector(`[data-field-id="${formBuilder.selectedFieldId}"]`);
    selected?.classList.add('selected');
  }
}

// Render single field item
function renderFieldItem(field) {
  const typeConfig = fieldTypes[field.type];
  const isLayout = typeConfig?.isLayout;

  let preview = '';

  switch (field.type) {
    case 'text':
    case 'email':
    case 'phone':
    case 'url':
      preview = `<input type="${field.type === 'phone' ? 'tel' : field.type}" placeholder="${escapeHtml(field.placeholder || '')}" disabled>`;
      break;
    case 'textarea':
      preview = `<textarea placeholder="${escapeHtml(field.placeholder || '')}" disabled></textarea>`;
      break;
    case 'number':
      preview = `<input type="number" placeholder="${escapeHtml(field.placeholder || '')}" disabled>`;
      break;
    case 'date':
      preview = `<input type="date" disabled>`;
      break;
    case 'select':
      preview = `<select disabled><option>${escapeHtml((field.options || [])[0] || 'Select...')}</option></select>`;
      break;
    case 'checkbox':
      preview = `<div class="checkbox-preview">${(field.options || []).slice(0, 3).map(opt =>
        `<label class="checkbox-option"><input type="checkbox" disabled> ${escapeHtml(opt)}</label>`
      ).join('')}</div>`;
      break;
    case 'radio':
      preview = `<div class="radio-preview">${(field.options || []).slice(0, 3).map(opt =>
        `<label class="radio-option"><input type="radio" disabled> ${escapeHtml(opt)}</label>`
      ).join('')}</div>`;
      break;
    case 'hidden':
      preview = `<div style="color: var(--text-muted); font-style: italic; font-size: 0.875rem;">Hidden field: ${escapeHtml(field.name)}</div>`;
      break;
    case 'heading':
      preview = `<${field.level || 'h3'} style="margin: 0;">${escapeHtml(field.content || 'Heading')}</${field.level || 'h3'}>`;
      break;
    case 'paragraph':
      preview = `<p style="margin: 0; color: var(--text-muted);">${escapeHtml(field.content || 'Paragraph text')}</p>`;
      break;
    case 'divider':
      preview = `<hr style="border: none; height: 1px; background: var(--border);">`;
      break;
    default:
      preview = `<input type="text" disabled>`;
  }

  return `
    <div class="form-field-item" data-field-id="${field.id}">
      <div class="field-drag-handle">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <div class="field-content">
        ${!isLayout ? `
          <div class="field-label">
            ${escapeHtml(field.label || 'Untitled')}
            ${field.required ? '<span class="required-indicator">*</span>' : ''}
            <span class="field-type-tag">${field.type}</span>
          </div>
        ` : ''}
        <div class="field-preview">${preview}</div>
      </div>
      <div class="field-actions">
        <button class="btn-duplicate" title="Duplicate">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </button>
        <button class="btn-delete" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    </div>
  `;
}

// Render a single condition rule
function renderConditionRule(rule, index, currentFieldId) {
  // Get available fields (exclude current field and layout fields)
  const availableFields = formBuilder.fields.filter(f =>
    f.id !== currentFieldId &&
    !fieldTypes[f.type]?.isLayout &&
    f.name
  );

  // Determine operators based on field type
  const targetField = formBuilder.fields.find(f => f.id === rule.field);
  const isOptionsField = targetField && fieldTypes[targetField.type]?.hasOptions;

  const operators = [
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'not equals' },
    { value: 'contains', label: 'contains' },
    { value: 'is_empty', label: 'is empty' },
    { value: 'is_not_empty', label: 'is not empty' }
  ];

  const needsValue = rule.operator !== 'is_empty' && rule.operator !== 'is_not_empty';

  return `
    <div class="condition-rule" data-index="${index}">
      <div class="condition-rule-row">
        <select class="condition-field" data-index="${index}">
          <option value="">Select field...</option>
          ${availableFields.map(f => `
            <option value="${f.id}" ${rule.field === f.id ? 'selected' : ''}>
              ${escapeHtml(f.label || f.name)}
            </option>
          `).join('')}
        </select>

        <select class="condition-operator" data-index="${index}">
          ${operators.map(op => `
            <option value="${op.value}" ${rule.operator === op.value ? 'selected' : ''}>
              ${op.label}
            </option>
          `).join('')}
        </select>

        ${needsValue ? `
          ${isOptionsField ? `
            <select class="condition-value" data-index="${index}">
              <option value="">Select value...</option>
              ${(targetField.options || []).map(opt => `
                <option value="${escapeHtml(opt)}" ${rule.value === opt ? 'selected' : ''}>
                  ${escapeHtml(opt)}
                </option>
              `).join('')}
            </select>
          ` : `
            <input type="text" class="condition-value" data-index="${index}"
              value="${escapeHtml(rule.value || '')}" placeholder="Value">
          `}
        ` : `
          <span class="condition-value-placeholder"></span>
        `}

        <button type="button" class="btn-remove-condition" data-index="${index}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>
  `;
}

// Render Field Properties Panel
function renderFieldProperties(field) {
  const typeConfig = fieldTypes[field.type];
  const isLayout = typeConfig?.isLayout;

  const propertiesBody = document.getElementById('properties-body');

  let html = '';

  // Layout fields (heading, paragraph, divider)
  if (isLayout) {
    if (field.type === 'heading') {
      html += `
        <div class="property-group">
          <label>Heading Text</label>
          <input type="text" id="prop-content" value="${escapeHtml(field.content || '')}" placeholder="Enter heading text">
        </div>
        <div class="property-group">
          <label>Heading Level</label>
          <select id="prop-level">
            <option value="h2" ${field.level === 'h2' ? 'selected' : ''}>H2 - Large</option>
            <option value="h3" ${field.level === 'h3' ? 'selected' : ''}>H3 - Medium</option>
            <option value="h4" ${field.level === 'h4' ? 'selected' : ''}>H4 - Small</option>
          </select>
        </div>
      `;
    } else if (field.type === 'paragraph') {
      html += `
        <div class="property-group">
          <label>Paragraph Text</label>
          <textarea id="prop-content" rows="4">${escapeHtml(field.content || '')}</textarea>
        </div>
      `;
    } else if (field.type === 'divider') {
      html += `<p style="color: var(--text-muted); font-size: 0.875rem;">No properties for divider.</p>`;
    }
  } else {
    // Regular form fields
    html += `
      <div class="property-group">
        <label>Label</label>
        <input type="text" id="prop-label" value="${escapeHtml(field.label || '')}" placeholder="Field label">
      </div>
      <div class="property-group">
        <label>Field Name</label>
        <input type="text" id="prop-name" value="${escapeHtml(field.name || '')}" placeholder="field_name">
        <small>Used in form data. No spaces or special characters.</small>
      </div>
    `;

    // Placeholder
    if (typeConfig?.hasPlaceholder) {
      html += `
        <div class="property-group">
          <label>Placeholder</label>
          <input type="text" id="prop-placeholder" value="${escapeHtml(field.placeholder || '')}" placeholder="Placeholder text">
        </div>
      `;
    }

    // Default value for hidden fields
    if (typeConfig?.hasDefaultValue) {
      html += `
        <div class="property-group">
          <label>Default Value</label>
          <input type="text" id="prop-defaultValue" value="${escapeHtml(field.defaultValue || '')}">
        </div>
      `;
    }

    // Options for select, checkbox, radio
    if (typeConfig?.hasOptions) {
      html += `
        <div class="property-group">
          <label>Options</label>
          <div class="options-editor" id="options-editor">
            ${(field.options || []).map((opt, i) => `
              <div class="option-row" data-index="${i}">
                <input type="text" value="${escapeHtml(opt)}" class="option-input">
                <button type="button" class="btn-remove-option" ${field.options.length <= 1 ? 'disabled' : ''}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            `).join('')}
          </div>
          <button type="button" class="btn-add-option" id="add-option-btn">+ Add Option</button>
        </div>
      `;
    }

    // Min/Max for number and date
    if (typeConfig?.hasMinMax) {
      html += `
        <div class="property-group">
          <label>Min Value</label>
          <input type="${field.type === 'date' ? 'date' : 'number'}" id="prop-min" value="${escapeHtml(field.min || '')}">
        </div>
        <div class="property-group">
          <label>Max Value</label>
          <input type="${field.type === 'date' ? 'date' : 'number'}" id="prop-max" value="${escapeHtml(field.max || '')}">
        </div>
      `;
    }

    // Required checkbox
    if (field.type !== 'hidden') {
      html += `
        <div class="property-divider"></div>
        <div class="property-group">
          <label class="property-checkbox">
            <input type="checkbox" id="prop-required" ${field.required ? 'checked' : ''}>
            Required field
          </label>
        </div>
      `;
    }

    // Conditional Logic Section
    html += `
      <div class="property-divider"></div>
      <div class="property-group">
        <label style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
          <span>Conditional Logic</span>
          <button type="button" class="btn-toggle-conditions" id="toggle-conditions-btn"
            style="font-size: 0.75rem; padding: 4px 8px;">
            ${field.conditions ? 'Disable' : 'Enable'}
          </button>
        </label>
        <small style="margin-bottom: 12px;">Show or hide this field based on other field values</small>

        <div id="conditions-editor" style="display: ${field.conditions ? 'block' : 'none'};">
          <div class="property-group">
            <label>Action</label>
            <select id="conditions-action">
              <option value="show" ${field.conditions?.action === 'show' ? 'selected' : ''}>Show this field</option>
              <option value="hide" ${field.conditions?.action === 'hide' ? 'selected' : ''}>Hide this field</option>
            </select>
          </div>

          <div class="property-group">
            <label>When</label>
            <select id="conditions-logic">
              <option value="all" ${field.conditions?.logic === 'all' ? 'selected' : ''}>All conditions match (AND)</option>
              <option value="any" ${field.conditions?.logic === 'any' ? 'selected' : ''}>Any condition matches (OR)</option>
            </select>
          </div>

          <div class="property-group">
            <label>Conditions</label>
            <div id="conditions-rules">
              ${field.conditions?.rules?.length > 0 ? field.conditions.rules.map((rule, index) =>
                renderConditionRule(rule, index, field.id)
              ).join('') : ''}
            </div>
            <button type="button" class="btn-add-condition" id="add-condition-btn">+ Add Condition</button>
          </div>
        </div>
      </div>
    `;
  }

  // Delete button
  html += `<button class="btn-delete-field" id="delete-field-btn">Delete Field</button>`;

  // Use sanitized innerHTML for extra XSS protection
  setSafeInnerHTML(propertiesBody, html);

  // Attach event listeners
  attachPropertyListeners(field);
}

// Attach Property Panel Event Listeners
function attachPropertyListeners(field) {
  const updateField = (key, value) => {
    field[key] = value;
    formBuilder.isDirty = true;
    renderFormFields();
  };

  // Special handling for field name with validation
  const nameInput = document.getElementById('prop-name');
  if (nameInput) {
    // Show validation feedback
    const showValidationError = (message) => {
      let errorEl = nameInput.parentElement.querySelector('.validation-error');
      if (!errorEl) {
        errorEl = document.createElement('small');
        errorEl.className = 'validation-error';
        errorEl.style.cssText = 'color: #ef4444; display: block; margin-top: 4px; font-size: 0.75rem;';
        nameInput.parentElement.appendChild(errorEl);
      }
      errorEl.textContent = message;
      nameInput.style.borderColor = '#ef4444';
    };

    const clearValidationError = () => {
      const errorEl = nameInput.parentElement.querySelector('.validation-error');
      if (errorEl) errorEl.remove();
      nameInput.style.borderColor = '';
    };

    nameInput.addEventListener('input', (e) => {
      const newName = e.target.value;

      // Clear previous errors
      clearValidationError();

      // Validate field name
      if (newName && !isValidFieldName(newName)) {
        showValidationError('Must be a valid identifier (letters, numbers, underscores only)');
      } else if (newName) {
        // Check for duplicates
        const duplicates = formBuilder.fields.filter(f => f.id !== field.id && f.name === newName);
        if (duplicates.length > 0) {
          showValidationError('Field name must be unique');
        }
      }

      updateField('name', newName);
    });

    nameInput.addEventListener('blur', (e) => {
      const currentName = e.target.value;
      // Auto-fix invalid names on blur
      if (currentName && !isValidFieldName(currentName)) {
        // Remove invalid characters
        let fixed = currentName.replace(/[^a-zA-Z0-9_]/g, '_');
        // Ensure it doesn't start with a number
        if (/^\d/.test(fixed)) {
          fixed = '_' + fixed;
        }
        // Make it unique
        fixed = getUniqueFieldName(fixed, field.id);
        e.target.value = fixed;
        field.name = fixed;
        formBuilder.isDirty = true;
        renderFormFields();
        clearValidationError();
        showToast('Field name auto-corrected to valid format', 'info');
      }
    });
  }

  // Text inputs (excluding 'name' which is handled above)
  ['label', 'placeholder', 'defaultValue', 'content', 'min', 'max'].forEach(prop => {
    const input = document.getElementById(`prop-${prop}`);
    if (input) {
      input.addEventListener('input', (e) => {
        updateField(prop, e.target.value);
      });
    }
  });

  // Select inputs
  ['level'].forEach(prop => {
    const select = document.getElementById(`prop-${prop}`);
    if (select) {
      select.addEventListener('change', (e) => {
        updateField(prop, e.target.value);
      });
    }
  });

  // Checkbox inputs
  const requiredCheckbox = document.getElementById('prop-required');
  if (requiredCheckbox) {
    requiredCheckbox.addEventListener('change', (e) => {
      updateField('required', e.target.checked);
    });
  }

  // Options editor
  const optionsEditor = document.getElementById('options-editor');
  if (optionsEditor) {
    // Update option
    optionsEditor.querySelectorAll('.option-input').forEach((input, index) => {
      input.addEventListener('input', (e) => {
        field.options[index] = e.target.value;
        formBuilder.isDirty = true;
        renderFormFields();
      });
    });

    // Remove option
    optionsEditor.querySelectorAll('.btn-remove-option').forEach((btn) => {
      btn.addEventListener('click', () => {
        const row = btn.closest('.option-row');
        const index = parseInt(row.dataset.index);
        field.options.splice(index, 1);
        formBuilder.isDirty = true;
        renderFormFields();
        renderFieldProperties(field);
      });
    });
  }

  // Add option button
  document.getElementById('add-option-btn')?.addEventListener('click', () => {
    field.options.push(`Option ${field.options.length + 1}`);
    formBuilder.isDirty = true;
    renderFormFields();
    renderFieldProperties(field);
  });

  // Delete field button
  document.getElementById('delete-field-btn')?.addEventListener('click', () => {
    if (confirm('Delete this field?')) {
      deleteField(field.id);
    }
  });
}

// Show Form Preview
function showFormPreview() {
  const previewContainer = document.getElementById('preview-container');

  if (formBuilder.fields.length === 0) {
    previewContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted);">Add some fields to see a preview.</p>';
    show('form-preview-modal');
    return;
  }

  // Create view toggle controls
  let html = `
    <div class="preview-controls">
      <button class="preview-view-toggle active" data-view="desktop">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" style="vertical-align: middle; margin-right: 4px;">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
          <line x1="8" y1="21" x2="16" y2="21"></line>
          <line x1="12" y1="17" x2="12" y2="21"></line>
        </svg>
        Desktop
      </button>
      <button class="preview-view-toggle" data-view="mobile">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" style="vertical-align: middle; margin-right: 4px;">
          <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
          <line x1="12" y1="18" x2="12.01" y2="18"></line>
        </svg>
        Mobile
      </button>
    </div>
    <div class="preview-wrapper">
      <form class="preview-form">`;

  // Generate form fields

  formBuilder.fields.forEach(field => {
    const typeConfig = fieldTypes[field.type];

    if (field.type === 'heading') {
      html += `<${field.level || 'h3'} class="preview-heading">${escapeHtml(field.content || '')}</${field.level || 'h3'}>`;
    } else if (field.type === 'paragraph') {
      html += `<p class="preview-paragraph">${escapeHtml(field.content || '')}</p>`;
    } else if (field.type === 'divider') {
      html += `<hr class="preview-divider">`;
    } else if (field.type === 'hidden') {
      // Don't show hidden fields in preview
    } else {
      html += `<div class="form-group">`;
      html += `<label>${escapeHtml(field.label || 'Untitled')}${field.required ? ' <span style="color: var(--danger);">*</span>' : ''}</label>`;

      switch (field.type) {
        case 'text':
        case 'email':
        case 'phone':
        case 'url':
          html += `<input type="${field.type === 'phone' ? 'tel' : field.type}" name="${escapeHtml(field.name)}" placeholder="${escapeHtml(field.placeholder || '')}" ${field.required ? 'required' : ''}>`;
          break;
        case 'textarea':
          html += `<textarea name="${escapeHtml(field.name)}" placeholder="${escapeHtml(field.placeholder || '')}" rows="4" ${field.required ? 'required' : ''}></textarea>`;
          break;
        case 'number':
          html += `<input type="number" name="${escapeHtml(field.name)}" placeholder="${escapeHtml(field.placeholder || '')}" ${field.min ? `min="${field.min}"` : ''} ${field.max ? `max="${field.max}"` : ''} ${field.required ? 'required' : ''}>`;
          break;
        case 'date':
          html += `<input type="date" name="${escapeHtml(field.name)}" ${field.min ? `min="${field.min}"` : ''} ${field.max ? `max="${field.max}"` : ''} ${field.required ? 'required' : ''}>`;
          break;
        case 'select':
          html += `<select name="${escapeHtml(field.name)}" ${field.required ? 'required' : ''}>`;
          html += `<option value="">Select...</option>`;
          (field.options || []).forEach(opt => {
            html += `<option value="${escapeHtml(opt)}">${escapeHtml(opt)}</option>`;
          });
          html += `</select>`;
          break;
        case 'checkbox':
          (field.options || []).forEach(opt => {
            html += `<label class="property-checkbox" style="margin-bottom: 8px;"><input type="checkbox" name="${escapeHtml(field.name)}[]" value="${escapeHtml(opt)}"> ${escapeHtml(opt)}</label>`;
          });
          break;
        case 'radio':
          (field.options || []).forEach((opt, i) => {
            html += `<label class="property-checkbox" style="margin-bottom: 8px;"><input type="radio" name="${escapeHtml(field.name)}" value="${escapeHtml(opt)}" ${i === 0 && field.required ? 'required' : ''}> ${escapeHtml(opt)}</label>`;
          });
          break;
      }

      html += `</div>`;
    }
  });

  html += '<button type="button" class="btn-submit-preview">Submit (Preview)</button>';
  html += '</form></div>';

  // Use sanitized innerHTML for XSS protection
  setSafeInnerHTML(previewContainer, html);
  show('form-preview-modal');

  // Add event listeners for view toggle
  document.querySelectorAll('.preview-view-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      // Update active state
      document.querySelectorAll('.preview-view-toggle').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Toggle view
      const wrapper = document.querySelector('.preview-wrapper');
      if (btn.dataset.view === 'mobile') {
        wrapper.classList.add('mobile-view');
      } else {
        wrapper.classList.remove('mobile-view');
      }
    });
  });
}

// Save Form Builder
async function saveFormBuilder() {
  const saveBtn = document.getElementById('save-form-btn');
  const originalBtnText = saveBtn?.textContent || 'Save Form';

  // Validate form has at least one field
  if (formBuilder.fields.length === 0) {
    showToast('Please add at least one field to the form', 'error');
    return;
  }

  // Validate all fields
  const validationErrors = validateAllFields();
  if (validationErrors.length > 0) {
    let errorMessage = 'Please fix the following errors:\n\n';
    validationErrors.forEach(({ field, errors }) => {
      errorMessage += `${field}:\n`;
      errors.forEach(error => {
        errorMessage += `  - ${error}\n`;
      });
      errorMessage += '\n';
    });
    alert(errorMessage);
    return;
  }

  // Disable save button and show loading state
  if (saveBtn) {
    saveBtn.disabled = true;
    const spinnerHtml = `
      <svg class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" style="animation: spin 1s linear infinite; margin-right: 8px;">
        <circle cx="12" cy="12" r="10" opacity="0.25"></circle>
        <path d="M12 2a10 10 0 0 1 10 10" opacity="0.75"></path>
      </svg>
      Saving...
    `;
    setSafeInnerHTML(saveBtn, spinnerHtml);
  }

  // Add spinner animation if not present
  if (!document.getElementById('spinner-styles')) {
    const style = document.createElement('style');
    style.id = 'spinner-styles';
    style.textContent = `
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      .spinner { display: inline-block; vertical-align: middle; }
    `;
    document.head.appendChild(style);
  }

  try {
    // Send the update request
    const response = await api(`/api/forms/${formBuilder.formId}`, {
      method: 'PUT',
      body: JSON.stringify({
        fields: formBuilder.fields
      })
    });

    // Mark form as clean (no unsaved changes)
    formBuilder.isDirty = false;

    // Show success notification
    showToast('Form saved successfully!', 'success');

    // Update the form in state if needed
    if (response && response.form) {
      const formIndex = state.forms.findIndex(f => f.id === formBuilder.formId);
      if (formIndex !== -1) {
        state.forms[formIndex] = response.form;
      }
    }
  } catch (err) {
    console.error('Save error:', err);
    showToast(`Failed to save form: ${err.message || 'Unknown error'}`, 'error');
  } finally {
    // Re-enable save button
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = originalBtnText;
    }
  }
}

// =====================
// Settings
// =====================

// Show Settings View
async function showSettings() {
  document.getElementById('page-title').textContent = 'Settings';

  // Update nav active state
  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  document.getElementById('nav-settings')?.classList.add('active');

  // Hide other views
  hide('forms-grid');
  hide('form-detail');
  hide('submissions-view');
  hide('api-keys-view');
  hide('form-builder-view');
  hide('audit-logs-view');
  hide('empty-state');
  hide('loading-state');

  // Show settings view
  show('settings-view');

  // Hide topbar create button
  document.querySelector('.topbar-actions').innerHTML = '';

  // Load current settings
  await loadSettings();

  // Initialize settings event listeners
  initSettingsEvents();
}

// Load Settings
async function loadSettings() {
  // Populate email from stored user
  if (state.user) {
    document.getElementById('settings-email').value = state.user.email || '';
    document.getElementById('settings-name').value = state.user.name || '';

    // Update subscription info
    const planName = (state.user.subscription || 'free').charAt(0).toUpperCase() +
                     (state.user.subscription || 'free').slice(1);
    document.getElementById('current-plan-name').textContent = planName;

    // Update plan features based on subscription
    const features = getPlanFeatures(state.user.subscription || 'free');
    const featuresHtml = features.map(f => `<li>${sanitizeHtml(f)}</li>`).join('');
    setSafeInnerHTML(document.getElementById('plan-features-list'), featuresHtml);
  }

  // Try to load additional settings from API
  try {
    const data = await api('/api/user/settings');
    if (data.settings) {
      if (data.settings.branding) {
        document.getElementById('custom-logo').value = data.settings.branding.customLogo || '';
        document.getElementById('brand-color').value = data.settings.branding.brandColor || '#6366f1';
        document.getElementById('brand-color-hex').value = data.settings.branding.brandColor || '#6366f1';
      }
      if (data.settings.retention) {
        document.getElementById('retention-days').value = data.settings.retention.days || '0';
      }
    }
  } catch (err) {
    // Settings endpoint might not exist yet, use defaults
    if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production') {
      console.log('Could not load settings:', err.message);
    }
  }
}

// Get plan features
function getPlanFeatures(plan) {
  const features = {
    free: ['5 forms', '100 submissions/month', '7-day data retention', 'Basic encryption'],
    starter: ['25 forms', '1,000 submissions/month', '30-day data retention', 'Custom branding', 'Webhooks'],
    pro: ['Unlimited forms', '10,000 submissions/month', '1-year data retention', 'Priority support', 'Advanced analytics'],
    enterprise: ['Unlimited everything', 'Custom retention', 'SLA guarantee', 'Dedicated support', 'Self-hosting option']
  };
  return features[plan] || features.free;
}

// Initialize Settings Event Listeners
function initSettingsEvents() {
  // Profile form
  document.getElementById('profile-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('settings-name').value.trim();

    try {
      await api('/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify({ name })
      });

      // Update local state
      state.user.name = name;
      localStorage.setItem('veilforms_user', JSON.stringify(state.user));

      alert('Profile updated successfully!');
    } catch (err) {
      alert('Failed to update profile: ' + err.message);
    }
  });

  // Password form
  document.getElementById('password-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (newPassword !== confirmPassword) {
      alert('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      alert('Password must be at least 8 characters');
      return;
    }

    try {
      await api('/api/user/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword })
      });

      // Clear form
      document.getElementById('password-form').reset();
      alert('Password changed successfully!');
    } catch (err) {
      alert('Failed to change password: ' + err.message);
    }
  });

  // Branding form
  document.getElementById('branding-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const customLogo = document.getElementById('custom-logo').value.trim();
    const brandColor = document.getElementById('brand-color').value;

    try {
      await api('/api/user/branding', {
        method: 'PUT',
        body: JSON.stringify({ customLogo, brandColor })
      });

      alert('Branding settings saved!');
    } catch (err) {
      alert('Failed to save branding: ' + err.message);
    }
  });

  // Color picker sync
  document.getElementById('brand-color')?.addEventListener('input', (e) => {
    document.getElementById('brand-color-hex').value = e.target.value;
  });

  document.getElementById('brand-color-hex')?.addEventListener('input', (e) => {
    if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
      document.getElementById('brand-color').value = e.target.value;
    }
  });

  // Retention form
  document.getElementById('retention-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const days = parseInt(document.getElementById('retention-days').value);

    try {
      await api('/api/user/retention', {
        method: 'PUT',
        body: JSON.stringify({ days })
      });

      alert('Retention settings saved!');
    } catch (err) {
      alert('Failed to save retention settings: ' + err.message);
    }
  });

  // Upgrade plan button
  document.getElementById('upgrade-plan-btn')?.addEventListener('click', () => {
    showUpgradeModal();
  });

  // Manage billing button
  document.getElementById('manage-billing-btn')?.addEventListener('click', openBillingPortal);

  // Cancel subscription button
  document.getElementById('cancel-subscription-btn')?.addEventListener('click', cancelSubscription);

  // Export data button
  document.getElementById('export-data-btn')?.addEventListener('click', async () => {
    try {
      const data = await api('/api/user/export');

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `veilforms-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to export data: ' + err.message);
    }
  });

  // Delete account button
  document.getElementById('delete-account-btn')?.addEventListener('click', () => {
    if (confirm('Are you SURE you want to delete your account? This action CANNOT be undone. All your forms and submissions will be permanently deleted.')) {
      const confirmText = prompt('Type "DELETE" to confirm account deletion:');
      if (confirmText === 'DELETE') {
        deleteAccount();
      } else {
        alert('Account deletion cancelled.');
      }
    }
  });

  // Export encryption keys button
  document.getElementById('export-encryption-key-btn')?.addEventListener('click', () => {
    show('export-keys-modal');
  });

  // Import encryption keys button
  document.getElementById('import-encryption-key-btn')?.addEventListener('click', () => {
    show('import-keys-modal');
  });

  // Confirm export keys
  document.getElementById('confirm-export-keys-btn')?.addEventListener('click', exportEncryptionKeys);

  // Confirm import keys
  document.getElementById('confirm-import-keys-btn')?.addEventListener('click', importEncryptionKeys);
}

// =====================
// Key Management
// =====================

/**
 * Export encryption keys with password protection
 */
async function exportEncryptionKeys() {
  const password = document.getElementById('export-password').value;
  const passwordConfirm = document.getElementById('export-password-confirm').value;

  // Validation
  if (!password || !passwordConfirm) {
    alert('Please enter a password');
    return;
  }

  if (password !== passwordConfirm) {
    alert('Passwords do not match');
    return;
  }

  if (password.length < 8) {
    alert('Password must be at least 8 characters long');
    return;
  }

  try {
    // Fetch all forms to get their private keys
    const data = await api('/api/forms/');
    const forms = data.forms || [];

    if (forms.length === 0) {
      alert('No forms found to export keys from');
      return;
    }

    // Collect all private keys
    const keyData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      keys: forms.filter(form => form.privateKey).map(form => ({
        formId: form.id,
        formName: form.name,
        privateKey: form.privateKey
      }))
    };

    if (keyData.keys.length === 0) {
      alert('No private keys found in your forms');
      return;
    }

    // Encrypt the key data with PBKDF2 + AES-GCM
    const encryptedData = await encryptKeyExport(keyData, password);

    // Download as file
    const blob = new Blob([JSON.stringify(encryptedData, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `veilforms-keys-${Date.now()}.veilkeys`;
    a.click();
    URL.revokeObjectURL(url);

    // Close modal and reset
    hide('export-keys-modal');
    document.getElementById('export-password').value = '';
    document.getElementById('export-password-confirm').value = '';

    alert(`Successfully exported ${keyData.keys.length} encryption key(s)!`);
  } catch (err) {
    console.error('Key export error:', err);
    alert('Failed to export keys: ' + err.message);
  }
}

/**
 * Import encryption keys from encrypted file
 */
async function importEncryptionKeys() {
  const fileInput = document.getElementById('import-file');
  const password = document.getElementById('import-password').value;

  if (!fileInput.files || fileInput.files.length === 0) {
    alert('Please select a key file to import');
    return;
  }

  if (!password) {
    alert('Please enter the decryption password');
    return;
  }

  try {
    // Read file
    const file = fileInput.files[0];
    const fileContent = await file.text();
    const encryptedData = JSON.parse(fileContent);

    // Decrypt the key data
    const keyData = await decryptKeyExport(encryptedData, password);

    if (!keyData || !keyData.keys || !Array.isArray(keyData.keys)) {
      throw new Error('Invalid key file format');
    }

    // NOTE: In a real implementation, you would need an API endpoint
    // to update the form private keys. For now, we'll store them locally.

    // For demonstration, we'll store in localStorage with a warning
    const existingKeys = JSON.parse(localStorage.getItem('veilforms_imported_keys') || '{}');

    keyData.keys.forEach(({ formId, formName, privateKey }) => {
      existingKeys[formId] = {
        formName,
        privateKey,
        importedAt: new Date().toISOString()
      };
    });

    localStorage.setItem('veilforms_imported_keys', JSON.stringify(existingKeys));

    // Close modal and reset
    hide('import-keys-modal');
    document.getElementById('import-file').value = '';
    document.getElementById('import-password').value = '';

    alert(`Successfully imported ${keyData.keys.length} encryption key(s)!\n\nKeys are stored locally in your browser. You can now decrypt submissions.`);
  } catch (err) {
    console.error('Key import error:', err);
    if (err.message.includes('decrypt')) {
      alert('Failed to import keys: Incorrect password or corrupted file');
    } else {
      alert('Failed to import keys: ' + err.message);
    }
  }
}

/**
 * Encrypt key export data using PBKDF2 + AES-GCM
 */
async function encryptKeyExport(data, password) {
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);

  // Generate random salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Derive key from password using PBKDF2
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt the data
  const plaintext = encoder.encode(JSON.stringify(data));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv
    },
    derivedKey,
    plaintext
  );

  // Return encrypted package
  return {
    version: '1.0',
    algorithm: 'PBKDF2-AES-GCM-256',
    iterations: 100000,
    salt: Array.from(salt),
    iv: Array.from(iv),
    ciphertext: Array.from(new Uint8Array(ciphertext))
  };
}

/**
 * Decrypt key export data
 */
async function decryptKeyExport(encryptedData, password) {
  if (encryptedData.version !== '1.0') {
    throw new Error('Unsupported key file version');
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const passwordBytes = encoder.encode(password);

  // Convert arrays back to Uint8Array
  const salt = new Uint8Array(encryptedData.salt);
  const iv = new Uint8Array(encryptedData.iv);
  const ciphertext = new Uint8Array(encryptedData.ciphertext);

  // Derive key from password
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: encryptedData.iterations,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  // Decrypt the data
  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv
    },
    derivedKey,
    ciphertext
  );

  return JSON.parse(decoder.decode(plaintext));
}

// Delete Account
async function deleteAccount() {
  try {
    await api('/api/user/delete', { method: 'DELETE' });

    localStorage.removeItem('veilforms_token');
    localStorage.removeItem('veilforms_user');

    alert('Your account has been deleted.');
    window.location.href = '/';
  } catch (err) {
    alert('Failed to delete account: ' + err.message);
  }
}

// =====================
// Audit Logs
// =====================

let auditLogs = [];
let auditPagination = { offset: 0, limit: 50, total: 0 };

// Show Audit Logs View
async function showAuditLogs() {
  document.getElementById('page-title').textContent = 'Audit Logs';

  // Update nav active state
  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  document.getElementById('nav-audit-logs')?.classList.add('active');

  // Hide other views
  hide('forms-grid');
  hide('form-detail');
  hide('submissions-view');
  hide('api-keys-view');
  hide('form-builder-view');
  hide('settings-view');
  hide('empty-state');

  // Show audit logs view
  show('audit-logs-view');

  // Hide topbar create button
  document.querySelector('.topbar-actions').innerHTML = '';

  // Load audit logs
  await loadAuditLogs();
}

// Load Audit Logs
async function loadAuditLogs(eventFilter = '', formFilter = '') {
  const view = document.getElementById('audit-logs-view');
  setSafeInnerHTML(view, '<div class="loading-state"><div class="spinner"></div><p>Loading audit logs...</p></div>');

  try {
    let url = `/api/audit-logs?limit=${auditPagination.limit}&offset=${auditPagination.offset}`;
    if (eventFilter) url += `&event=${eventFilter}`;
    if (formFilter) url += `&formId=${formFilter}`;

    const data = await api(url);
    auditLogs = data.logs || [];
    auditPagination.total = data.total || 0;

    renderAuditLogs();
  } catch (err) {
    console.error('Load audit logs error:', err);
    const errorHtml = `
      <div class="error-state">
        <div class="error-icon">!</div>
        <h2>Failed to load audit logs</h2>
        <p>${escapeHtml(err.message)}</p>
        <button class="btn btn-secondary" onclick="loadAuditLogs()">Try Again</button>
      </div>
    `;
    setSafeInnerHTML(view, errorHtml);
  }
}

// Render Audit Logs
function renderAuditLogs() {
  const view = document.getElementById('audit-logs-view');

  if (auditLogs.length === 0) {
    const emptyHtml = `
      <div class="audit-logs-header">
        <h2>Activity Log</h2>
      </div>
      <div class="empty-state">
        <h2>No audit logs yet</h2>
        <p>Activity logs will appear here as you use VeilForms.</p>
      </div>
    `;
    setSafeInnerHTML(view, emptyHtml);
    return;
  }

  const auditLogsHtml = `
    <div class="audit-logs-header">
      <div>
        <h2 style="margin: 0 0 8px 0;">Activity Log</h2>
        <p style="color: var(--text-muted); margin: 0;">Track all account and form activity</p>
      </div>
      <div class="audit-filters">
        <select id="event-filter">
          <option value="">All Events</option>
          <option value="form">Form Events</option>
          <option value="submission">Submission Events</option>
          <option value="user">Auth Events</option>
          <option value="api_key">API Key Events</option>
        </select>
        <select id="form-filter">
          <option value="">All Forms</option>
          ${state.forms.map(f => `<option value="${f.id}">${escapeHtml(f.name)}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="audit-logs-table-wrapper">
      <table class="audit-logs-table">
        <thead>
          <tr>
            <th>Event</th>
            <th>Details</th>
            <th>IP</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          ${auditLogs.map(log => {
            const eventCategory = log.event.split('.')[0];
            return `
              <tr>
                <td><span class="event-badge ${eventCategory}">${escapeHtml(log.event)}</span></td>
                <td>${formatLogDetails(log.details)}</td>
                <td><code>${escapeHtml(log.meta?.ip || 'N/A')}</code></td>
                <td>${formatDateTime(log.timestamp)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      ${auditPagination.total > auditPagination.limit ? `
        <div class="pagination">
          <button id="audit-prev-page" ${auditPagination.offset === 0 ? 'disabled' : ''}>Previous</button>
          <span class="page-info">
            ${auditPagination.offset + 1}-${Math.min(auditPagination.offset + auditPagination.limit, auditPagination.total)}
            of ${auditPagination.total}
          </span>
          <button id="audit-next-page" ${auditPagination.offset + auditPagination.limit >= auditPagination.total ? 'disabled' : ''}>Next</button>
        </div>
      ` : ''}
    </div>
  `;
  setSafeInnerHTML(view, auditLogsHtml);

  // Event listeners
  document.getElementById('event-filter')?.addEventListener('change', (e) => {
    auditPagination.offset = 0;
    const formFilter = document.getElementById('form-filter')?.value || '';
    loadAuditLogs(e.target.value, formFilter);
  });

  document.getElementById('form-filter')?.addEventListener('change', (e) => {
    auditPagination.offset = 0;
    const eventFilter = document.getElementById('event-filter')?.value || '';
    loadAuditLogs(eventFilter, e.target.value);
  });

  document.getElementById('audit-prev-page')?.addEventListener('click', () => {
    auditPagination.offset = Math.max(0, auditPagination.offset - auditPagination.limit);
    const eventFilter = document.getElementById('event-filter')?.value || '';
    const formFilter = document.getElementById('form-filter')?.value || '';
    loadAuditLogs(eventFilter, formFilter);
  });

  document.getElementById('audit-next-page')?.addEventListener('click', () => {
    auditPagination.offset += auditPagination.limit;
    const eventFilter = document.getElementById('event-filter')?.value || '';
    const formFilter = document.getElementById('form-filter')?.value || '';
    loadAuditLogs(eventFilter, formFilter);
  });
}

// Format log details
function formatLogDetails(details) {
  if (!details) return '<em>-</em>';

  const parts = [];
  if (details.formName) parts.push(`Form: ${escapeHtml(details.formName)}`);
  if (details.formId && !details.formName) parts.push(`Form ID: ${escapeHtml(details.formId.substring(0, 12))}...`);
  if (details.submissionId) parts.push(`Submission: ${escapeHtml(details.submissionId.substring(0, 12))}...`);
  if (details.keyName) parts.push(`Key: ${escapeHtml(details.keyName)}`);
  if (details.changes) {
    const changes = Object.keys(details.changes).join(', ');
    parts.push(`Changed: ${changes}`);
  }

  return parts.length > 0 ? parts.join(' | ') : '<em>-</em>';
}

// formatDateTime imported from ./modules/index.js

// Exit Form Builder
function exitFormBuilder() {
  formBuilder.formId = null;
  formBuilder.formName = '';
  formBuilder.fields = [];
  formBuilder.selectedFieldId = null;
  formBuilder.isDirty = false;

  // Remove beforeunload warning when exiting builder
  window.removeEventListener('beforeunload', beforeUnloadHandler);

  hide('form-builder-view');
  document.getElementById('page-title').textContent = 'Forms';

  // Restore topbar
  document.querySelector('.topbar-actions').innerHTML = `
    <button class="btn btn-primary" id="create-form-btn">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
      New Form
    </button>
  `;

  document.getElementById('create-form-btn')?.addEventListener('click', () => {
    show('create-form-modal');
  });

  // Restore nav
  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  document.querySelector('[data-page="forms"]')?.classList.add('active');

  loadForms();
}

// =====================
// Billing
// =====================

// Show Upgrade Modal
function showUpgradeModal() {
  const modal = document.getElementById('upgrade-modal');
  if (!modal) {
    // Create modal dynamically if it doesn't exist
    const modalHtml = `
      <div class="modal" id="upgrade-modal" style="display:block">
        <div class="modal-content" style="max-width: 700px;">
          <div class="modal-header">
            <h2>Upgrade Your Plan</h2>
            <button class="modal-close" onclick="document.getElementById('upgrade-modal').style.display='none'">&times;</button>
          </div>
          <div class="modal-body">
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;">
              <div class="plan-card" data-plan="pro" style="border: 1px solid var(--border); border-radius: 8px; padding: 20px; cursor: pointer; transition: border-color 0.2s;">
                <h3 style="margin: 0 0 8px;">Pro</h3>
                <div style="font-size: 2rem; font-weight: 700; margin-bottom: 16px;">$19<span style="font-size: 0.875rem; font-weight: 400; color: var(--text-muted);">/month</span></div>
                <ul style="list-style: none; padding: 0; margin: 0; font-size: 0.875rem; color: var(--text-muted);">
                  <li style="margin-bottom: 8px;">25 forms</li>
                  <li style="margin-bottom: 8px;">5,000 submissions/mo</li>
                  <li style="margin-bottom: 8px;">Webhooks</li>
                  <li style="margin-bottom: 8px;">Custom branding</li>
                </ul>
                <button class="btn btn-primary" style="width: 100%; margin-top: 16px;" onclick="startCheckout('pro')">Select Pro</button>
              </div>
              <div class="plan-card" data-plan="team" style="border: 2px solid var(--primary); border-radius: 8px; padding: 20px; cursor: pointer; position: relative;">
                <span style="position: absolute; top: -10px; left: 50%; transform: translateX(-50%); background: var(--primary); color: white; padding: 2px 12px; border-radius: 12px; font-size: 0.75rem;">Most Popular</span>
                <h3 style="margin: 0 0 8px;">Team</h3>
                <div style="font-size: 2rem; font-weight: 700; margin-bottom: 16px;">$49<span style="font-size: 0.875rem; font-weight: 400; color: var(--text-muted);">/month</span></div>
                <ul style="list-style: none; padding: 0; margin: 0; font-size: 0.875rem; color: var(--text-muted);">
                  <li style="margin-bottom: 8px;">Unlimited forms</li>
                  <li style="margin-bottom: 8px;">25,000 submissions/mo</li>
                  <li style="margin-bottom: 8px;">Priority support</li>
                  <li style="margin-bottom: 8px;">Advanced analytics</li>
                </ul>
                <button class="btn btn-primary" style="width: 100%; margin-top: 16px;" onclick="startCheckout('team')">Select Team</button>
              </div>
              <div class="plan-card" data-plan="enterprise" style="border: 1px solid var(--border); border-radius: 8px; padding: 20px;">
                <h3 style="margin: 0 0 8px;">Enterprise</h3>
                <div style="font-size: 2rem; font-weight: 700; margin-bottom: 16px;">Custom</div>
                <ul style="list-style: none; padding: 0; margin: 0; font-size: 0.875rem; color: var(--text-muted);">
                  <li style="margin-bottom: 8px;">Unlimited everything</li>
                  <li style="margin-bottom: 8px;">Custom retention</li>
                  <li style="margin-bottom: 8px;">SLA guarantee</li>
                  <li style="margin-bottom: 8px;">Self-hosting option</li>
                </ul>
                <a href="/contact/" class="btn btn-secondary" style="width: 100%; margin-top: 16px; display: block; text-align: center;">Contact Sales</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  } else {
    modal.style.display = 'block';
  }
}

// Start Stripe Checkout
async function startCheckout(plan) {
  try {
    // Show loading state
    const btn = document.querySelector(`[onclick="startCheckout('${plan}')"]`);
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Loading...';
    }

    const data = await api('/api/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ plan })
    });

    if (data.checkoutUrl) {
      window.location.href = data.checkoutUrl;
    } else {
      throw new Error('No checkout URL returned');
    }
  } catch (err) {
    alert('Failed to start checkout: ' + err.message);

    // Reset button
    const btn = document.querySelector(`[onclick="startCheckout('${plan}')"]`);
    if (btn) {
      btn.disabled = false;
      btn.textContent = `Select ${plan.charAt(0).toUpperCase() + plan.slice(1)}`;
    }
  }
}

// Open Billing Portal
async function openBillingPortal() {
  try {
    const data = await api('/api/billing/portal', { method: 'POST' });

    if (data.portalUrl) {
      window.location.href = data.portalUrl;
    } else {
      throw new Error('No portal URL returned');
    }
  } catch (err) {
    alert('Failed to open billing portal: ' + err.message);
  }
}

// Cancel Subscription
async function cancelSubscription() {
  if (!confirm('Are you sure you want to cancel your subscription? You will lose access to premium features at the end of your billing period.')) {
    return;
  }

  try {
    const data = await api('/api/billing/cancel', { method: 'POST' });

    alert('Your subscription has been canceled. You will retain access until ' + new Date(data.cancelAt).toLocaleDateString());

    // Refresh settings to show updated status
    await loadSettings();
  } catch (err) {
    alert('Failed to cancel subscription: ' + err.message);
  }
}

// Load Subscription Status
async function loadSubscriptionStatus() {
  try {
    const data = await api('/api/billing/subscription');

    if (data.subscription) {
      const sub = data.subscription;

      // Update UI elements
      const planNameEl = document.getElementById('current-plan-name');
      if (planNameEl) {
        planNameEl.textContent = sub.planName;
      }

      // Show/hide billing management buttons based on subscription
      const manageBillingBtn = document.getElementById('manage-billing-btn');
      const cancelSubBtn = document.getElementById('cancel-subscription-btn');
      const upgradeBtn = document.getElementById('upgrade-plan-btn');

      if (sub.plan !== 'free' && sub.stripeSubscriptionId) {
        // Paid plan - show manage and cancel buttons
        if (manageBillingBtn) manageBillingBtn.style.display = 'inline-flex';
        if (cancelSubBtn) {
          cancelSubBtn.style.display = sub.cancelAtPeriodEnd ? 'none' : 'inline-flex';
        }
        if (upgradeBtn) upgradeBtn.textContent = 'Change Plan';

        // Show subscription status
        const statusEl = document.getElementById('subscription-status');
        if (statusEl) {
          if (sub.cancelAtPeriodEnd) {
            statusEl.innerHTML = `<span style="color: var(--warning);">Cancels on ${new Date(sub.currentPeriodEnd).toLocaleDateString()}</span>`;
          } else {
            statusEl.innerHTML = `<span style="color: var(--success);">Active - Renews ${new Date(sub.currentPeriodEnd).toLocaleDateString()}</span>`;
          }
        }
      } else {
        // Free plan - show upgrade button only
        if (manageBillingBtn) manageBillingBtn.style.display = 'none';
        if (cancelSubBtn) cancelSubBtn.style.display = 'none';
        if (upgradeBtn) upgradeBtn.textContent = 'Upgrade Plan';
      }
    }
  } catch (err) {
    if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production') {
      console.log('Could not load subscription status:', err.message);
    }
  }
}

// Check for billing callback parameters
function handleBillingCallback() {
  const params = new URLSearchParams(window.location.search);

  if (params.get('billing') === 'success') {
    const plan = params.get('plan') || 'premium';
    alert(`Welcome to VeilForms ${plan.charAt(0).toUpperCase() + plan.slice(1)}! Your subscription is now active.`);

    // Clean up URL
    window.history.replaceState({}, document.title, window.location.pathname);

    // Refresh user data
    refreshUserData();
  } else if (params.get('billing') === 'canceled') {
    // User canceled checkout - no action needed
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

// Refresh user data from API
async function refreshUserData() {
  try {
    const data = await api('/api/user/me');
    if (data.user) {
      state.user = data.user;
      localStorage.setItem('veilforms_user', JSON.stringify(data.user));

      // Update sidebar
      const userInfo = document.querySelector('.user-info');
      if (userInfo) {
        userInfo.querySelector('.user-plan').textContent = state.user.subscription || 'Free';
      }
    }
  } catch (err) {
    if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production') {
      console.log('Could not refresh user data:', err.message);
    }
  }
}

// Export functions to global scope for form-builder-integration.js
// These are needed for patching and UX enhancements
window.formBuilder = formBuilder;
window.showFormBuilder = showFormBuilder;
window.exitFormBuilder = exitFormBuilder;
window.addField = addField;
window.deleteField = deleteField;
window.selectField = selectField;
window.show = show;
window.hide = hide;
window.escapeHtml = escapeHtml;
window.showToast = showToast;

// Start
document.addEventListener('DOMContentLoaded', () => {
  init();
  handleBillingCallback();
});
