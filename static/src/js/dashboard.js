// VeilForms Dashboard JavaScript

// State
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

// API Helper
async function api(endpoint, options = {}) {
  const token = localStorage.getItem('veilforms_token');
  if (!token) {
    window.location.href = '/login/';
    return;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers
    }
  });

  if (response.status === 401) {
    localStorage.removeItem('veilforms_token');
    localStorage.removeItem('veilforms_user');
    window.location.href = '/login/';
    return;
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

// Auth Guard
function checkAuth() {
  const token = localStorage.getItem('veilforms_token');
  const user = localStorage.getItem('veilforms_user');

  if (!token || !user) {
    window.location.href = '/login/';
    return false;
  }

  try {
    state.token = token;
    state.user = JSON.parse(user);
    return true;
  } catch {
    window.location.href = '/login/';
    return false;
  }
}

// UI Helpers
function show(id) {
  document.getElementById(id).style.display = 'block';
}

function hide(id) {
  document.getElementById(id).style.display = 'none';
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
  grid.innerHTML = state.forms.map(form => `
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
  detail.innerHTML = `
    <div class="detail-header">
      <button class="back-btn" id="back-to-forms">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
        Back to Forms
      </button>
      <div class="detail-actions">
        <button class="btn btn-secondary" id="view-submissions-btn">View Submissions</button>
      </div>
    </div>

    <div class="detail-section">
      <h3>Embed Code</h3>
      <p style="color: var(--text-muted); font-size: 0.875rem; margin-bottom: 16px;">
        Add this script to your website to enable form submissions.
      </p>
      <div class="embed-code">
        <pre>&lt;script src="https://veilforms.com/js/veilforms.min.js"&gt;&lt;/script&gt;
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
          <label for="edit-webhook-url">Webhook URL</label>
          <input type="url" id="edit-webhook-url" value="${form.settings?.webhookUrl || ''}" placeholder="https://your-server.com/webhook">
        </div>
        <button type="submit" class="btn btn-primary">Save Changes</button>
      </form>
    </div>

    <div class="detail-section" style="border-color: var(--danger);">
      <h3 style="color: var(--danger);">Danger Zone</h3>
      <p style="color: var(--text-muted); font-size: 0.875rem; margin-bottom: 16px;">
        These actions cannot be undone.
      </p>
      <button class="btn btn-danger" id="delete-form-btn">Delete Form</button>
    </div>
  `;

  // Event handlers
  document.getElementById('back-to-forms').addEventListener('click', () => {
    document.getElementById('page-title').textContent = 'Forms';
    hide('form-detail');
    show('forms-grid');
    state.currentForm = null;
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
}

// Update Form
async function updateForm(formId) {
  const name = document.getElementById('edit-form-name').value;
  const status = document.getElementById('edit-form-status').value;
  const webhookUrl = document.getElementById('edit-webhook-url').value;

  try {
    await api(`/api/forms/${formId}`, {
      method: 'PUT',
      body: JSON.stringify({
        name,
        status,
        settings: { webhookUrl: webhookUrl || null }
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
    view.innerHTML = `
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
  } else {
    const decrypted = state.decryptionKey ? 'Decrypted' : 'Encrypted';

    view.innerHTML = `
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
                    ? `<pre>${escapeHtml(JSON.stringify(sub._decrypted, null, 2))}</pre>`
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

// Utility Functions
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(timestamp) {
  if (!timestamp) return 'N/A';
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return 'Never';
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatDate(timestamp);
}

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
  view.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>';

  try {
    const data = await api('/api/api-keys/');
    apiKeys = data.keys || [];
    renderApiKeys();
  } catch (err) {
    console.error('Load API keys error:', err);
    view.innerHTML = `
      <div class="error-state">
        <div class="error-icon">!</div>
        <h2>Failed to load API keys</h2>
        <p>${escapeHtml(err.message)}</p>
        <button class="btn btn-secondary" onclick="loadApiKeys()">Try Again</button>
      </div>
    `;
  }
}

// Render API Keys
function renderApiKeys() {
  const view = document.getElementById('api-keys-view');

  if (apiKeys.length === 0) {
    view.innerHTML = `
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
    return;
  }

  view.innerHTML = `
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

// Start
document.addEventListener('DOMContentLoaded', init);
