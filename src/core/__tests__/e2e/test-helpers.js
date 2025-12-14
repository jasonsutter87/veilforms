/**
 * E2E Test Helpers
 * Utilities for smoke testing critical VeilForms paths
 */

/**
 * Generate random test data
 */
export function generateTestEmail() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `test-${timestamp}-${random}@veilforms-test.com`;
}

export function generateTestPassword() {
  // Meets PASSWORD_REQUIREMENTS: min 12 chars, uppercase, lowercase, number
  return `TestPass${Math.random().toString(36).substring(2, 10)}123!`;
}

export function generateFormId() {
  return `vf_test_${Math.random().toString(36).substring(2, 11)}`;
}

export function generateSubmissionId() {
  // Generate UUID v4 format with vf- prefix
  return 'vf-' + 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Mock form data generators
 */
export function createMockFormConfig(overrides = {}) {
  return {
    name: 'Test Contact Form',
    fields: [
      {
        id: 'field_name',
        type: 'text',
        name: 'name',
        label: 'Full Name',
        required: true
      },
      {
        id: 'field_email',
        type: 'email',
        name: 'email',
        label: 'Email Address',
        required: true
      },
      {
        id: 'field_message',
        type: 'textarea',
        name: 'message',
        label: 'Message',
        required: false
      }
    ],
    settings: {
      encryption: true,
      piiStrip: false,
      allowedOrigins: ['*']
    },
    ...overrides
  };
}

export function createMockSubmissionData(overrides = {}) {
  return {
    name: 'John Doe',
    email: 'john.doe@example.com',
    message: 'This is a test submission message.',
    ...overrides
  };
}

/**
 * Deep equality check for objects
 */
export function deepEqual(obj1, obj2) {
  if (obj1 === obj2) return true;

  if (typeof obj1 !== 'object' || typeof obj2 !== 'object' || obj1 == null || obj2 == null) {
    return false;
  }

  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    if (!keys2.includes(key)) return false;
    if (!deepEqual(obj1[key], obj2[key])) return false;
  }

  return true;
}

/**
 * Wait utility for async operations
 */
export function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry utility for flaky operations
 */
export async function retry(fn, options = {}) {
  const { maxAttempts = 3, delay = 100, backoff = 2 } = options;

  let lastError;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < maxAttempts - 1) {
        await wait(delay * Math.pow(backoff, i));
      }
    }
  }

  throw lastError;
}

/**
 * Mock storage implementation for testing
 */
export class MockStorage {
  constructor() {
    this.data = new Map();
  }

  async set(key, value) {
    this.data.set(key, value);
    return true;
  }

  async get(key) {
    return this.data.get(key) || null;
  }

  async delete(key) {
    return this.data.delete(key);
  }

  async list(prefix = '') {
    const results = [];
    for (const [key, value] of this.data.entries()) {
      if (key.startsWith(prefix)) {
        results.push({ key, value });
      }
    }
    return results;
  }

  clear() {
    this.data.clear();
  }
}

/**
 * Mock API response builder
 */
export class MockApiResponse {
  constructor(status, data, headers = {}) {
    this.status = status;
    this.data = data;
    this.headers = headers;
  }

  async json() {
    return this.data;
  }

  get ok() {
    return this.status >= 200 && this.status < 300;
  }
}

/**
 * Assert helpers for better test readability
 */
export const assert = {
  isTrue(condition, message = 'Expected condition to be true') {
    if (!condition) {
      throw new Error(message);
    }
  },

  isFalse(condition, message = 'Expected condition to be false') {
    if (condition) {
      throw new Error(message);
    }
  },

  equals(actual, expected, message = `Expected ${actual} to equal ${expected}`) {
    if (actual !== expected) {
      throw new Error(message);
    }
  },

  notEquals(actual, expected, message = `Expected ${actual} to not equal ${expected}`) {
    if (actual === expected) {
      throw new Error(message);
    }
  },

  exists(value, message = 'Expected value to exist') {
    if (value === null || value === undefined) {
      throw new Error(message);
    }
  },

  isNull(value, message = 'Expected value to be null') {
    if (value !== null) {
      throw new Error(message);
    }
  },

  isType(value, type, message = `Expected value to be of type ${type}`) {
    if (typeof value !== type) {
      throw new Error(message);
    }
  },

  arrayContains(array, item, message = 'Expected array to contain item') {
    if (!Array.isArray(array) || !array.includes(item)) {
      throw new Error(message);
    }
  },

  throws(fn, message = 'Expected function to throw') {
    let thrown = false;
    try {
      fn();
    } catch (e) {
      thrown = true;
    }
    if (!thrown) {
      throw new Error(message);
    }
  },

  async throwsAsync(fn, message = 'Expected async function to throw') {
    let thrown = false;
    try {
      await fn();
    } catch (e) {
      thrown = true;
    }
    if (!thrown) {
      throw new Error(message);
    }
  }
};
