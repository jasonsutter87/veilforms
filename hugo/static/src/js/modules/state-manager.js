/**
 * VeilForms - Reactive State Manager
 * Centralized state management with subscription support
 */

/**
 * Create a reactive state store
 * @param {Object} initialState - Initial state values
 * @returns {Object} Store with get, set, subscribe methods
 */
export function createStore(initialState = {}) {
  let state = { ...initialState };
  const listeners = new Map();
  let listenerIdCounter = 0;

  /**
   * Get the current state
   * @param {string} key - Optional key to get specific value
   * @returns {*} State value or entire state
   */
  function get(key) {
    if (key !== undefined) {
      return state[key];
    }
    return { ...state };
  }

  /**
   * Set state values
   * @param {Object|Function} updates - Updates to apply (object or updater function)
   */
  function set(updates) {
    const prevState = { ...state };

    if (typeof updates === 'function') {
      state = { ...state, ...updates(state) };
    } else {
      state = { ...state, ...updates };
    }

    // Notify listeners of changed keys
    const changedKeys = new Set();
    for (const key of Object.keys(state)) {
      if (state[key] !== prevState[key]) {
        changedKeys.add(key);
      }
    }
    for (const key of Object.keys(prevState)) {
      if (!(key in state)) {
        changedKeys.add(key);
      }
    }

    // Notify all listeners
    if (changedKeys.size > 0) {
      listeners.forEach((listener) => {
        listener(state, prevState, changedKeys);
      });
    }
  }

  /**
   * Subscribe to state changes
   * @param {Function} listener - Callback for state changes
   * @param {string[]} keys - Optional keys to watch (watches all if empty)
   * @returns {Function} Unsubscribe function
   */
  function subscribe(listener, keys = []) {
    const id = listenerIdCounter++;

    const wrappedListener = keys.length > 0
      ? (newState, prevState, changedKeys) => {
          if (keys.some(k => changedKeys.has(k))) {
            listener(newState, prevState, changedKeys);
          }
        }
      : listener;

    listeners.set(id, wrappedListener);

    return () => {
      listeners.delete(id);
    };
  }

  /**
   * Reset state to initial values
   */
  function reset() {
    set(initialState);
  }

  return { get, set, subscribe, reset };
}

/**
 * Default dashboard state shape
 */
export const defaultState = {
  user: null,
  token: null,
  forms: [],
  currentForm: null,
  submissions: [],
  pagination: null,
  decryptionKey: null,
  loading: true,
  error: null,
  view: 'forms' // 'forms' | 'form-detail' | 'submissions' | 'builder'
};

/**
 * Create the main dashboard store
 */
export const store = createStore(defaultState);

/**
 * State selectors for common access patterns
 */
export const selectors = {
  getUser: () => store.get('user'),
  getForms: () => store.get('forms'),
  getCurrentForm: () => store.get('currentForm'),
  getSubmissions: () => store.get('submissions'),
  isLoading: () => store.get('loading'),
  getError: () => store.get('error'),
  getView: () => store.get('view'),

  getFormById: (id) => {
    const forms = store.get('forms');
    return forms.find(f => f.id === id);
  },

  getSubmissionById: (id) => {
    const submissions = store.get('submissions');
    return submissions.find(s => s.id === id);
  }
};

/**
 * State actions for common operations
 */
export const actions = {
  setLoading: (loading) => store.set({ loading }),
  setError: (error) => store.set({ error, loading: false }),
  clearError: () => store.set({ error: null }),

  setForms: (forms) => store.set({ forms, loading: false }),
  addForm: (form) => store.set(s => ({ forms: [...s.forms, form] })),
  updateForm: (id, updates) => store.set(s => ({
    forms: s.forms.map(f => f.id === id ? { ...f, ...updates } : f)
  })),
  removeForm: (id) => store.set(s => ({
    forms: s.forms.filter(f => f.id !== id)
  })),

  setCurrentForm: (form) => store.set({ currentForm: form }),
  clearCurrentForm: () => store.set({ currentForm: null }),

  setSubmissions: (submissions, pagination) => store.set({
    submissions,
    pagination,
    loading: false
  }),
  addSubmission: (submission) => store.set(s => ({
    submissions: [submission, ...s.submissions]
  })),
  removeSubmission: (id) => store.set(s => ({
    submissions: s.submissions.filter(sub => sub.id !== id)
  })),

  setView: (view) => store.set({ view }),

  setAuth: (user, token) => store.set({ user, token }),
  clearAuth: () => store.set({ user: null, token: null })
};
