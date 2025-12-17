// VeilForms Form Builder UX Enhancements
// Keyboard shortcuts, toasts, confirmations, and loading states

// =====================
// Toast Notification System
// =====================

const Toast = {
  container: null,

  init() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'toast-container';
      this.container.className = 'toast-container';
      document.body.appendChild(this.container);
    }
  },

  show(message, type = 'info', duration = 3000) {
    this.init();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icon = this.getIcon(type);
    toast.innerHTML = `
      <div class="toast-icon">${icon}</div>
      <div class="toast-message">${this.escapeHtml(message)}</div>
      <button class="toast-close" aria-label="Close">×</button>
    `;

    this.container.appendChild(toast);

    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);

    // Close button
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => this.hide(toast));

    // Auto-hide
    if (duration > 0) {
      setTimeout(() => this.hide(toast), duration);
    }

    return toast;
  },

  hide(toast) {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  },

  getIcon(type) {
    const icons = {
      success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>`,
      error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>`,
      warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
        <line x1="12" y1="9" x2="12" y2="13"></line>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>`,
      info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>`
    };
    return icons[type] || icons.info;
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  success(message, duration) {
    return this.show(message, 'success', duration);
  },

  error(message, duration) {
    return this.show(message, 'error', duration);
  },

  warning(message, duration) {
    return this.show(message, 'warning', duration);
  },

  info(message, duration) {
    return this.show(message, 'info', duration);
  }
};

// =====================
// Confirmation Dialog System
// =====================

const ConfirmDialog = {
  show(title, message, options = {}) {
    return new Promise((resolve) => {
      const dialog = document.createElement('div');
      dialog.className = 'modal confirm-dialog';
      dialog.style.display = 'flex';

      const confirmText = options.confirmText || 'Confirm';
      const cancelText = options.cancelText || 'Cancel';
      const type = options.type || 'default';

      dialog.innerHTML = `
        <div class="modal-backdrop"></div>
        <div class="modal-content modal-${type}">
          <div class="modal-header">
            <h2>${this.escapeHtml(title)}</h2>
          </div>
          <div class="modal-body">
            <p>${this.escapeHtml(message)}</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary confirm-cancel">${this.escapeHtml(cancelText)}</button>
            <button class="btn ${type === 'danger' ? 'btn-danger' : 'btn-primary'} confirm-ok">${this.escapeHtml(confirmText)}</button>
          </div>
        </div>
      `;

      document.body.appendChild(dialog);

      const handleClose = (result) => {
        dialog.style.display = 'none';
        setTimeout(() => dialog.remove(), 300);
        resolve(result);
      };

      dialog.querySelector('.confirm-ok').addEventListener('click', () => handleClose(true));
      dialog.querySelector('.confirm-cancel').addEventListener('click', () => handleClose(false));
      dialog.querySelector('.modal-backdrop').addEventListener('click', () => handleClose(false));

      // Escape key to cancel
      const escHandler = (e) => {
        if (e.key === 'Escape') {
          handleClose(false);
          document.removeEventListener('keydown', escHandler);
        }
      };
      document.addEventListener('keydown', escHandler);

      // Focus confirm button
      setTimeout(() => dialog.querySelector('.confirm-ok').focus(), 100);
    });
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

// =====================
// Enhanced Form Builder State
// =====================

const builderState = {
  isLoading: false,
  isSaving: false,
  keyboardShortcutsActive: false
};

// =====================
// Keyboard Shortcuts for Form Builder
// =====================

function initFormBuilderKeyboardShortcuts() {
  if (builderState.keyboardShortcutsActive) return;
  builderState.keyboardShortcutsActive = true;

  document.addEventListener('keydown', handleFormBuilderKeyboard);
}

function removeFormBuilderKeyboardShortcuts() {
  builderState.keyboardShortcutsActive = false;
  document.removeEventListener('keydown', handleFormBuilderKeyboard);
}

function handleFormBuilderKeyboard(e) {
  // Only active when form builder is visible
  const builderView = document.getElementById('form-builder-view');
  if (!builderView || builderView.style.display === 'none') return;

  // Ignore if typing in input/textarea
  if (e.target.matches('input, textarea, select')) return;

  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

  // Cmd/Ctrl + S: Save form
  if (cmdOrCtrl && e.key === 's') {
    e.preventDefault();
    document.getElementById('save-form-btn')?.click();
    return;
  }

  // Escape: Deselect field / Close properties panel
  if (e.key === 'Escape') {
    e.preventDefault();
    if (window.formBuilder && window.formBuilder.selectedFieldId) {
      window.formBuilder.selectedFieldId = null;
      const hideFunc = window.hide;
      if (hideFunc) hideFunc('field-properties');
      document.querySelectorAll('.form-field-item.selected').forEach(el => el.classList.remove('selected'));
      Toast.info('Field deselected');
    }
    return;
  }

  // Delete/Backspace: Delete selected field
  if ((e.key === 'Delete' || e.key === 'Backspace') && window.formBuilder && window.formBuilder.selectedFieldId) {
    e.preventDefault();
    deleteFieldWithConfirmation(window.formBuilder.selectedFieldId);
    return;
  }

  // Arrow keys: Navigate between fields
  if (window.formBuilder && window.formBuilder.fields.length > 0 && ['ArrowUp', 'ArrowDown'].includes(e.key)) {
    e.preventDefault();
    navigateFields(e.key === 'ArrowDown' ? 1 : -1);
    return;
  }
}

function navigateFields(direction) {
  if (!window.formBuilder) return;

  const currentIndex = window.formBuilder.selectedFieldId
    ? window.formBuilder.fields.findIndex(f => f.id === window.formBuilder.selectedFieldId)
    : -1;

  let newIndex = currentIndex + direction;

  if (newIndex < 0) newIndex = window.formBuilder.fields.length - 1;
  if (newIndex >= window.formBuilder.fields.length) newIndex = 0;

  if (window.formBuilder.fields[newIndex] && window.selectField) {
    window.selectField(window.formBuilder.fields[newIndex].id);

    // Scroll field into view
    const fieldElement = document.querySelector(`[data-field-id="${window.formBuilder.fields[newIndex].id}"]`);
    if (fieldElement) {
      fieldElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
}

async function deleteFieldWithConfirmation(fieldId) {
  if (!window.formBuilder) return;

  const field = window.formBuilder.fields.find(f => f.id === fieldId);
  if (!field) return;

  const confirmed = await ConfirmDialog.show(
    'Delete Field',
    `Are you sure you want to delete "${field.label || field.type}"?`,
    { confirmText: 'Delete', type: 'danger' }
  );

  if (confirmed && window.deleteField) {
    window.deleteField(fieldId);
    Toast.success('Field deleted');
  }
}

// =====================
// Loading States for Form Builder
// =====================

function showBuilderLoading(message = 'Loading...') {
  builderState.isLoading = true;
  const canvas = document.getElementById('canvas-dropzone');
  if (canvas && window.escapeHtml) {
    canvas.innerHTML = `
      <div class="builder-loading-state">
        <div class="spinner"></div>
        <p>${window.escapeHtml(message)}</p>
      </div>
    `;
  }
}

function hideBuilderLoading() {
  builderState.isLoading = false;
}

function setSaveButtonLoading(loading) {
  const saveBtn = document.getElementById('save-form-btn');
  if (!saveBtn) return;

  if (loading) {
    builderState.isSaving = true;
    saveBtn.disabled = true;
    saveBtn.dataset.originalText = saveBtn.textContent;
    saveBtn.innerHTML = `
      <div class="btn-spinner"></div>
      <span>Saving...</span>
    `;
  } else {
    builderState.isSaving = false;
    saveBtn.disabled = false;
    saveBtn.textContent = saveBtn.dataset.originalText || 'Save Form';
  }
}

// =====================
// Keyboard Shortcuts Hint Panel
// =====================

function showKeyboardShortcutsHint() {
  const builderView = document.getElementById('form-builder-view');
  if (!builderView) return;

  // Don't show if already dismissed
  if (localStorage.getItem('veilforms_shortcuts_hint_dismissed') === 'true') return;

  let hintPanel = document.getElementById('keyboard-shortcuts-hint');
  if (!hintPanel) {
    hintPanel = document.createElement('div');
    hintPanel.id = 'keyboard-shortcuts-hint';
    hintPanel.className = 'keyboard-shortcuts-hint';

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modifier = isMac ? '⌘' : 'Ctrl';

    hintPanel.innerHTML = `
      <div class="shortcuts-header">
        <strong>Keyboard Shortcuts</strong>
        <button class="shortcuts-close" aria-label="Close">×</button>
      </div>
      <div class="shortcuts-list">
        <div class="shortcut-item">
          <kbd>${modifier}</kbd> + <kbd>S</kbd>
          <span>Save form</span>
        </div>
        <div class="shortcut-item">
          <kbd>Esc</kbd>
          <span>Deselect field</span>
        </div>
        <div class="shortcut-item">
          <kbd>Del</kbd> / <kbd>⌫</kbd>
          <span>Delete selected field</span>
        </div>
        <div class="shortcut-item">
          <kbd>↑</kbd> / <kbd>↓</kbd>
          <span>Navigate fields</span>
        </div>
      </div>
    `;

    const canvasWrapper = builderView.querySelector('.form-canvas-wrapper');
    if (canvasWrapper) {
      canvasWrapper.appendChild(hintPanel);
    }

    // Close button
    hintPanel.querySelector('.shortcuts-close').addEventListener('click', () => {
      hintPanel.remove();
      localStorage.setItem('veilforms_shortcuts_hint_dismissed', 'true');
    });

    // Auto-hide after 8 seconds
    setTimeout(() => {
      if (hintPanel.parentNode) {
        hintPanel.classList.add('fade-out');
        setTimeout(() => hintPanel.remove(), 300);
      }
    }, 8000);
  }
}

// Export for global use
window.Toast = Toast;
window.ConfirmDialog = ConfirmDialog;
window.builderState = builderState;
window.initFormBuilderKeyboardShortcuts = initFormBuilderKeyboardShortcuts;
window.removeFormBuilderKeyboardShortcuts = removeFormBuilderKeyboardShortcuts;
window.showBuilderLoading = showBuilderLoading;
window.hideBuilderLoading = hideBuilderLoading;
window.setSaveButtonLoading = setSaveButtonLoading;
window.showKeyboardShortcutsHint = showKeyboardShortcutsHint;
window.deleteFieldWithConfirmation = deleteFieldWithConfirmation;
window.navigateFields = navigateFields;
