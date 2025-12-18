/**
 * API Test Helpers
 * Utilities for creating mock NextRequest objects and authenticated requests
 */

import { NextRequest } from 'next/server';
import { createToken } from '@/lib/auth';

/**
 * Create a mock NextRequest object for testing
 */
export function createMockRequest(
  method: string,
  url: string,
  options: {
    body?: unknown;
    headers?: Record<string, string>;
    searchParams?: Record<string, string>;
  } = {}
): NextRequest {
  const fullUrl = url.startsWith('http') ? url : `http://localhost:3000${url}`;
  const urlObj = new URL(fullUrl);

  // Add search params if provided
  if (options.searchParams) {
    Object.entries(options.searchParams).forEach(([key, value]) => {
      urlObj.searchParams.set(key, value);
    });
  }

  const headers = new Headers(options.headers || {});

  // Set default headers
  if (!headers.has('content-type') && options.body) {
    headers.set('content-type', 'application/json');
  }

  const requestInit: RequestInit = {
    method,
    headers,
  };

  if (options.body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    requestInit.body = JSON.stringify(options.body);
  }

  return new NextRequest(urlObj, requestInit);
}

/**
 * Create an authenticated mock request with a valid JWT token
 */
export function createAuthenticatedRequest(
  method: string,
  url: string,
  userId: string,
  email: string,
  options: {
    body?: unknown;
    headers?: Record<string, string>;
    searchParams?: Record<string, string>;
  } = {}
): NextRequest {
  const token = createToken({ userId, email });

  const headers = {
    ...options.headers,
    authorization: `Bearer ${token}`,
  };

  return createMockRequest(method, url, {
    ...options,
    headers,
  });
}

/**
 * Create a request with CSRF token
 */
export function createRequestWithCsrf(
  method: string,
  url: string,
  options: {
    body?: unknown;
    headers?: Record<string, string>;
    searchParams?: Record<string, string>;
  } = {}
): NextRequest {
  const headers = {
    ...options.headers,
    'x-csrf-token': 'test-csrf-token',
  };

  return createMockRequest(method, url, {
    ...options,
    headers,
  });
}

/**
 * Create an authenticated request with CSRF token
 */
export function createAuthenticatedRequestWithCsrf(
  method: string,
  url: string,
  userId: string,
  email: string,
  options: {
    body?: unknown;
    headers?: Record<string, string>;
    searchParams?: Record<string, string>;
  } = {}
): NextRequest {
  const token = createToken({ userId, email });

  const headers = {
    ...options.headers,
    authorization: `Bearer ${token}`,
    'x-csrf-token': 'test-csrf-token',
  };

  return createMockRequest(method, url, {
    ...options,
    headers,
  });
}

/**
 * Extract JSON response body from NextResponse
 */
export async function getResponseJson<T = unknown>(response: Response): Promise<T> {
  const text = await response.text();
  return JSON.parse(text) as T;
}

/**
 * Mock Netlify Blobs store for testing
 */
export function createMockStore() {
  const storage = new Map<string, string>();

  return {
    storage,
    get: vi.fn(async (key: string, options?: { type?: string }) => {
      const value = storage.get(key);
      if (!value) return null;
      if (options?.type === 'json') {
        return JSON.parse(value);
      }
      return value;
    }),
    set: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
    setJSON: vi.fn(async (key: string, value: unknown) => {
      storage.set(key, JSON.stringify(value));
    }),
    delete: vi.fn(async (key: string) => {
      storage.delete(key);
    }),
    list: vi.fn(async () => ({
      blobs: Array.from(storage.keys()).map(key => ({ key })),
    })),
  };
}

/**
 * Create a mock getStore function that returns the same mock store
 */
export function createMockGetStore() {
  const stores = new Map<string, ReturnType<typeof createMockStore>>();

  return {
    stores,
    getStore: vi.fn((options: { name: string }) => {
      if (!stores.has(options.name)) {
        stores.set(options.name, createMockStore());
      }
      return stores.get(options.name)!;
    }),
  };
}

/**
 * Wait for a promise to resolve or reject (for testing async operations)
 */
export function waitFor(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Mock rate limit that always allows
 */
export const mockRateLimitAllowed = {
  allowed: true,
  limit: 100,
  remaining: 99,
  reset: Date.now() + 60000,
};

/**
 * Mock rate limit that blocks
 */
export const mockRateLimitBlocked = {
  allowed: false,
  limit: 100,
  remaining: 0,
  reset: Date.now() + 60000,
  retryAfter: 60,
};
