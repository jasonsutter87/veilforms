/**
 * VeilForms - Centralized API Client
 * Handles all API communication with consistent error handling
 */

const API_BASE = '';  // Same-origin, no base needed

/**
 * Storage keys for auth data
 */
export const STORAGE_KEYS = {
  TOKEN: 'veilforms_token',
  USER: 'veilforms_user'
};

/**
 * Get auth token from storage
 * @returns {string|null} The auth token
 */
export function getToken() {
  return localStorage.getItem(STORAGE_KEYS.TOKEN);
}

/**
 * Get user from storage
 * @returns {Object|null} The user object
 */
export function getUser() {
  try {
    const user = localStorage.getItem(STORAGE_KEYS.USER);
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
}

/**
 * Save auth data to storage
 * @param {string} token - The auth token
 * @param {Object} user - The user object
 */
export function setAuth(token, user) {
  localStorage.setItem(STORAGE_KEYS.TOKEN, token);
  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
}

/**
 * Clear auth data from storage
 */
export function clearAuth() {
  localStorage.removeItem(STORAGE_KEYS.TOKEN);
  localStorage.removeItem(STORAGE_KEYS.USER);
}

/**
 * Check if user is authenticated
 * @returns {boolean} Whether the user is authenticated
 */
export function isAuthenticated() {
  return !!getToken() && !!getUser();
}

/**
 * Redirect to login page
 */
export function redirectToLogin() {
  clearAuth();
  window.location.href = '/login/';
}

/**
 * API Error class for consistent error handling
 */
export class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Make an authenticated API request
 * @param {string} endpoint - API endpoint
 * @param {Object} options - Fetch options
 * @param {boolean} options.requireAuth - Whether to require authentication (default true)
 * @returns {Promise<Object>} Response data
 */
export async function api(endpoint, options = {}) {
  const { requireAuth = true, ...fetchOptions } = options;

  // Build headers
  const headers = {
    'Content-Type': 'application/json',
    ...fetchOptions.headers
  };

  // Add auth token if required
  if (requireAuth) {
    const token = getToken();
    if (!token) {
      redirectToLogin();
      throw new ApiError('Authentication required', 401);
    }
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...fetchOptions,
      headers
    });

    // Handle 401 - redirect to login
    if (response.status === 401) {
      redirectToLogin();
      throw new ApiError('Session expired', 401);
    }

    // Parse response
    const data = await response.json().catch(() => ({}));

    // Handle error responses
    if (!response.ok) {
      throw new ApiError(
        data.error || `Request failed with status ${response.status}`,
        response.status,
        data
      );
    }

    return data;
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError(err.message || 'Network error', 0);
  }
}

/**
 * Convenience methods for common HTTP methods
 */
export const http = {
  get: (endpoint, options = {}) =>
    api(endpoint, { ...options, method: 'GET' }),

  post: (endpoint, body, options = {}) =>
    api(endpoint, { ...options, method: 'POST', body: JSON.stringify(body) }),

  put: (endpoint, body, options = {}) =>
    api(endpoint, { ...options, method: 'PUT', body: JSON.stringify(body) }),

  patch: (endpoint, body, options = {}) =>
    api(endpoint, { ...options, method: 'PATCH', body: JSON.stringify(body) }),

  delete: (endpoint, options = {}) =>
    api(endpoint, { ...options, method: 'DELETE' })
};

/**
 * Form-specific API methods
 */
export const formsApi = {
  list: () => http.get('/api/forms/'),
  get: (id) => http.get(`/api/forms/${id}`),
  create: (data) => http.post('/api/forms/', data),
  update: (id, data) => http.put(`/api/forms/${id}`, data),
  delete: (id) => http.delete(`/api/forms/${id}`),
  getStats: (id) => http.get(`/api/forms/${id}/stats`),
  regenerateKeys: (id) => http.post(`/api/forms/${id}/regenerate-keys`)
};

/**
 * Submissions-specific API methods
 */
export const submissionsApi = {
  list: (formId, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return http.get(`/api/submissions/${formId}${query ? `?${query}` : ''}`);
  },
  get: (formId, submissionId) => http.get(`/api/submissions/${formId}/${submissionId}`),
  delete: (formId, submissionId) => http.delete(`/api/submissions/${formId}/${submissionId}`),
  deleteAll: (formId) => http.delete(`/api/submissions/${formId}`)
};

/**
 * Auth-specific API methods
 */
export const authApi = {
  login: (email, password) => http.post('/api/auth/login', { email, password }, { requireAuth: false }),
  register: (email, password, name) => http.post('/api/auth/register', { email, password, name }, { requireAuth: false }),
  logout: () => http.post('/api/auth/logout'),
  forgotPassword: (email) => http.post('/api/auth/forgot', { email }, { requireAuth: false }),
  resetPassword: (token, password) => http.post('/api/auth/reset', { token, password }, { requireAuth: false }),
  verifyEmail: (token) => http.post('/api/auth/verify', { token }, { requireAuth: false }),
  resendVerification: (email) => http.post('/api/auth/resend-verification', { email }, { requireAuth: false })
};

/**
 * API Keys management
 */
export const apiKeysApi = {
  list: () => http.get('/api/api-keys/'),
  create: (name, scopes) => http.post('/api/api-keys/', { name, scopes }),
  revoke: (id) => http.delete(`/api/api-keys/${id}`)
};

/**
 * Audit logs
 */
export const auditApi = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return http.get(`/api/audit-logs${query ? `?${query}` : ''}`);
  }
};
