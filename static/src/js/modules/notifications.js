/**
 * VeilForms - Notifications Module
 * Toast notifications and user feedback
 */

/**
 * Toast types with associated styling
 */
export const ToastType = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
};

/**
 * Default toast configuration
 */
const DEFAULT_CONFIG = {
  duration: 3000,
  position: 'top-right',
  maxToasts: 5
};

let config = { ...DEFAULT_CONFIG };
let toastContainer = null;
let activeToasts = [];

/**
 * Configure the toast system
 * @param {Object} options - Configuration options
 */
export function configure(options) {
  config = { ...config, ...options };
}

/**
 * Get or create the toast container
 * @returns {HTMLElement} Toast container element
 */
function getContainer() {
  if (toastContainer && document.body.contains(toastContainer)) {
    return toastContainer;
  }

  toastContainer = document.createElement('div');
  toastContainer.id = 'vf-toast-container';
  toastContainer.style.cssText = `
    position: fixed;
    z-index: 10000;
    display: flex;
    flex-direction: column;
    gap: 8px;
    pointer-events: none;
    ${getPositionStyles()}
  `;

  document.body.appendChild(toastContainer);
  return toastContainer;
}

/**
 * Get CSS styles for toast position
 * @returns {string} CSS styles
 */
function getPositionStyles() {
  const positions = {
    'top-right': 'top: 16px; right: 16px;',
    'top-left': 'top: 16px; left: 16px;',
    'top-center': 'top: 16px; left: 50%; transform: translateX(-50%);',
    'bottom-right': 'bottom: 16px; right: 16px;',
    'bottom-left': 'bottom: 16px; left: 16px;',
    'bottom-center': 'bottom: 16px; left: 50%; transform: translateX(-50%);'
  };
  return positions[config.position] || positions['top-right'];
}

/**
 * Get icon SVG for toast type
 * @param {string} type - Toast type
 * @returns {string} SVG markup
 */
function getIcon(type) {
  const icons = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20,6 9,17 4,12"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
  };
  return icons[type] || icons.info;
}

/**
 * Get background color for toast type
 * @param {string} type - Toast type
 * @returns {string} CSS color value
 */
function getBackgroundColor(type) {
  const colors = {
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#6366f1'
  };
  return colors[type] || colors.info;
}

/**
 * Show a toast notification
 * @param {string} message - Message to display
 * @param {string} type - Toast type (success, error, warning, info)
 * @param {Object} options - Override options
 * @returns {Function} Function to dismiss the toast
 */
export function showToast(message, type = ToastType.SUCCESS, options = {}) {
  const container = getContainer();
  const duration = options.duration ?? config.duration;

  // Limit active toasts
  while (activeToasts.length >= config.maxToasts) {
    const oldest = activeToasts.shift();
    oldest?.remove();
  }

  // Create toast element
  const toast = document.createElement('div');
  toast.className = `vf-toast vf-toast-${type}`;
  toast.style.cssText = `
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: ${getBackgroundColor(type)};
    color: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    font-size: 14px;
    font-weight: 500;
    pointer-events: auto;
    animation: vf-toast-in 0.3s ease;
    max-width: 400px;
    word-break: break-word;
  `;

  // Add icon
  const iconWrapper = document.createElement('span');
  iconWrapper.innerHTML = getIcon(type);
  iconWrapper.style.cssText = 'width: 18px; height: 18px; flex-shrink: 0;';
  iconWrapper.querySelector('svg').style.cssText = 'width: 100%; height: 100%;';

  // Add message
  const messageSpan = document.createElement('span');
  messageSpan.textContent = message;
  messageSpan.style.cssText = 'flex: 1;';

  // Add close button
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '&times;';
  closeBtn.style.cssText = `
    background: none;
    border: none;
    color: white;
    font-size: 20px;
    cursor: pointer;
    padding: 0;
    margin-left: 8px;
    opacity: 0.7;
    line-height: 1;
  `;
  closeBtn.addEventListener('mouseenter', () => closeBtn.style.opacity = '1');
  closeBtn.addEventListener('mouseleave', () => closeBtn.style.opacity = '0.7');
  closeBtn.addEventListener('click', () => dismiss());

  toast.appendChild(iconWrapper);
  toast.appendChild(messageSpan);
  toast.appendChild(closeBtn);

  // Add animation styles if not present
  if (!document.getElementById('vf-toast-styles')) {
    const style = document.createElement('style');
    style.id = 'vf-toast-styles';
    style.textContent = `
      @keyframes vf-toast-in {
        from { opacity: 0; transform: translateY(-20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes vf-toast-out {
        from { opacity: 1; transform: translateY(0); }
        to { opacity: 0; transform: translateY(-20px); }
      }
    `;
    document.head.appendChild(style);
  }

  container.appendChild(toast);
  activeToasts.push(toast);

  // Dismiss function
  function dismiss() {
    toast.style.animation = 'vf-toast-out 0.3s ease forwards';
    setTimeout(() => {
      toast.remove();
      const idx = activeToasts.indexOf(toast);
      if (idx !== -1) activeToasts.splice(idx, 1);
    }, 300);
  }

  // Auto-dismiss
  if (duration > 0) {
    setTimeout(dismiss, duration);
  }

  return dismiss;
}

/**
 * Convenience methods for common toast types
 */
export const toast = {
  success: (message, options) => showToast(message, ToastType.SUCCESS, options),
  error: (message, options) => showToast(message, ToastType.ERROR, options),
  warning: (message, options) => showToast(message, ToastType.WARNING, options),
  info: (message, options) => showToast(message, ToastType.INFO, options)
};

/**
 * Clear all active toasts
 */
export function clearAllToasts() {
  activeToasts.forEach(t => t.remove());
  activeToasts = [];
}

/**
 * Show a confirmation dialog
 * @param {string} title - Dialog title
 * @param {string} message - Dialog message
 * @param {Object} options - Configuration options
 * @returns {Promise<boolean>} Whether the user confirmed
 */
export function confirm(title, message, options = {}) {
  const {
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    danger = false
  } = options;

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10001;
      animation: vf-fade-in 0.2s ease;
    `;

    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 24px;
      max-width: 400px;
      width: 90%;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
    `;

    dialog.innerHTML = `
      <h3 style="margin: 0 0 8px; font-size: 18px; font-weight: 600; color: #1e293b;">${title}</h3>
      <p style="margin: 0 0 24px; color: #64748b; font-size: 14px; line-height: 1.5;">${message}</p>
      <div style="display: flex; gap: 12px; justify-content: flex-end;">
        <button class="vf-confirm-cancel" style="
          padding: 8px 16px;
          border: 1px solid #e2e8f0;
          background: white;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          color: #64748b;
        ">${cancelText}</button>
        <button class="vf-confirm-ok" style="
          padding: 8px 16px;
          border: none;
          background: ${danger ? '#ef4444' : '#6366f1'};
          color: white;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
        ">${confirmText}</button>
      </div>
    `;

    const close = (result) => {
      overlay.style.animation = 'vf-fade-out 0.2s ease forwards';
      setTimeout(() => overlay.remove(), 200);
      resolve(result);
    };

    dialog.querySelector('.vf-confirm-cancel').addEventListener('click', () => close(false));
    dialog.querySelector('.vf-confirm-ok').addEventListener('click', () => close(true));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(false);
    });

    // Add fade animations if not present
    if (!document.getElementById('vf-confirm-styles')) {
      const style = document.createElement('style');
      style.id = 'vf-confirm-styles';
      style.textContent = `
        @keyframes vf-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes vf-fade-out { from { opacity: 1; } to { opacity: 0; } }
      `;
      document.head.appendChild(style);
    }

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    dialog.querySelector('.vf-confirm-ok').focus();
  });
}

// showToast is already exported inline at function definition
