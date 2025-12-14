/**
 * VeilForms - Module Index
 * Central export point for all dashboard modules
 */

// API Client
export {
  api,
  http,
  formsApi,
  submissionsApi,
  authApi,
  apiKeysApi,
  auditApi,
  ApiError,
  getToken,
  getUser,
  setAuth,
  clearAuth,
  isAuthenticated,
  redirectToLogin,
  STORAGE_KEYS
} from './api-client.js';

// State Manager
export {
  createStore,
  store,
  selectors,
  actions,
  defaultState
} from './state-manager.js';

// Notifications
export {
  showToast,
  toast,
  ToastType,
  configure as configureToasts,
  clearAllToasts,
  confirm
} from './notifications.js';

// Utilities
export {
  escapeHtml,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatFileSize,
  formatNumber,
  generateId,
  debounce,
  throttle,
  deepClone,
  copyToClipboard,
  show,
  hide,
  setVisible,
  sleep,
  isValidEmail,
  truncate,
  parseQueryString,
  buildQueryString
} from './utils.js';

// DOM Utilities
export {
  $,
  $$,
  byId,
  createElement,
  on,
  delegate,
  addClass,
  removeClass,
  toggleClass,
  hasClass,
  setHtml,
  setText,
  val,
  data,
  empty,
  remove,
  append,
  prepend,
  isVisible,
  scrollIntoView,
  focus,
  getFormData,
  setFormData
} from './dom.js';

// Sanitization Utilities
export {
  sanitizeHtml,
  sanitizeStrict,
  sanitizePlainText,
  sanitizeJson,
  sanitizeUrl,
  sanitizeAttribute,
  setSafeInnerHTML,
  setSafeInnerHTMLStrict,
  DOMPurify,
  configs as sanitizeConfigs
} from './sanitize.js';
