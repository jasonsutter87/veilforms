import { describe, it, expect, vi } from 'vitest';
import {
  ErrorCodes,
  createError,
  errorResponse,
  validationErrorResponse,
  getErrorDefinition,
} from './errors';

// Mock NextResponse
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data, options) => ({
      data,
      status: options?.status,
      json: async () => data,
    })),
  },
}));

describe('errors', () => {
  describe('ErrorCodes', () => {
    it('should have all expected error categories', () => {
      // Auth errors
      expect(ErrorCodes.AUTH_REQUIRED).toBe('AUTH_REQUIRED');
      expect(ErrorCodes.AUTH_INVALID_TOKEN).toBe('AUTH_INVALID_TOKEN');
      expect(ErrorCodes.AUTH_INVALID_CREDENTIALS).toBe('AUTH_INVALID_CREDENTIALS');

      // Validation errors
      expect(ErrorCodes.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
      expect(ErrorCodes.VALIDATION_MISSING_FIELD).toBe('VALIDATION_MISSING_FIELD');

      // Encryption errors
      expect(ErrorCodes.ENCRYPTION_ERROR).toBe('ENCRYPTION_ERROR');
      expect(ErrorCodes.DECRYPTION_FAILED).toBe('DECRYPTION_FAILED');

      // Resource errors
      expect(ErrorCodes.RESOURCE_NOT_FOUND).toBe('RESOURCE_NOT_FOUND');
      expect(ErrorCodes.RESOURCE_FORBIDDEN).toBe('RESOURCE_FORBIDDEN');

      // Rate limiting
      expect(ErrorCodes.RATE_LIMIT_EXCEEDED).toBe('RATE_LIMIT_EXCEEDED');

      // Payment errors
      expect(ErrorCodes.PAYMENT_REQUIRED).toBe('PAYMENT_REQUIRED');

      // Server errors
      expect(ErrorCodes.SERVER_ERROR).toBe('SERVER_ERROR');
    });
  });

  describe('createError', () => {
    it('should create error object with default message and hint', () => {
      const error = createError(ErrorCodes.AUTH_REQUIRED);

      expect(error.code).toBe('AUTH_REQUIRED');
      expect(error.error).toBe('Authentication required');
      expect(error.hint).toContain('log in');
    });

    it('should allow custom message override', () => {
      const error = createError(ErrorCodes.AUTH_REQUIRED, {
        message: 'Custom auth message',
      });

      expect(error.error).toBe('Custom auth message');
      expect(error.code).toBe('AUTH_REQUIRED');
    });

    it('should allow custom hint override', () => {
      const error = createError(ErrorCodes.AUTH_REQUIRED, {
        hint: 'Custom hint',
      });

      expect(error.hint).toBe('Custom hint');
    });

    it('should include optional details', () => {
      const error = createError(ErrorCodes.VALIDATION_ERROR, {
        details: { field: 'email', reason: 'invalid format' },
      });

      expect(error.details).toEqual({ field: 'email', reason: 'invalid format' });
    });

    it('should include optional field', () => {
      const error = createError(ErrorCodes.VALIDATION_MISSING_FIELD, {
        field: 'email',
      });

      expect(error.field).toBe('email');
    });

    it('should fallback to SERVER_ERROR for unknown codes', () => {
      // @ts-expect-error - testing invalid code
      const error = createError('UNKNOWN_CODE');

      expect(error.error).toBe('Internal server error');
    });
  });

  describe('errorResponse', () => {
    it('should create NextResponse with correct status', () => {
      const response = errorResponse(ErrorCodes.AUTH_REQUIRED);

      expect(response.status).toBe(401);
      expect(response.data.code).toBe('AUTH_REQUIRED');
    });

    it('should use status from error definition', () => {
      const response = errorResponse(ErrorCodes.RESOURCE_NOT_FOUND);
      expect(response.status).toBe(404);
    });

    it('should allow status override', () => {
      const response = errorResponse(ErrorCodes.AUTH_REQUIRED, {
        statusCode: 403,
      });

      expect(response.status).toBe(403);
    });

    it('should include all error fields', () => {
      const response = errorResponse(ErrorCodes.VALIDATION_ERROR, {
        message: 'Custom message',
        hint: 'Custom hint',
        details: { field: 'name' },
      });

      expect(response.data.error).toBe('Custom message');
      expect(response.data.hint).toBe('Custom hint');
      expect(response.data.details).toEqual({ field: 'name' });
    });
  });

  describe('validationErrorResponse', () => {
    it('should create response with field errors', () => {
      const response = validationErrorResponse([
        { field: 'email', message: 'Invalid email' },
        { field: 'name', message: 'Required' },
      ]);

      expect(response.status).toBe(400);
      expect(response.data.code).toBe('VALIDATION_ERROR');
      expect(response.data.details).toHaveLength(2);
      expect(response.data.details[0].field).toBe('email');
    });

    it('should handle empty field errors', () => {
      const response = validationErrorResponse([]);

      expect(response.status).toBe(400);
      expect(response.data.details).toEqual([]);
    });

    it('should include error codes in field errors', () => {
      const response = validationErrorResponse([
        { field: 'password', message: 'Too weak', code: 'PASSWORD_WEAK' },
      ]);

      expect(response.data.details[0].code).toBe('PASSWORD_WEAK');
    });
  });

  describe('getErrorDefinition', () => {
    it('should return definition for valid codes', () => {
      const def = getErrorDefinition(ErrorCodes.AUTH_REQUIRED);

      expect(def.message).toBe('Authentication required');
      expect(def.statusCode).toBe(401);
      expect(def.hint).toBeTruthy();
    });

    it('should return all expected status codes', () => {
      expect(getErrorDefinition(ErrorCodes.AUTH_REQUIRED).statusCode).toBe(401);
      expect(getErrorDefinition(ErrorCodes.RESOURCE_NOT_FOUND).statusCode).toBe(404);
      expect(getErrorDefinition(ErrorCodes.AUTH_USER_ALREADY_EXISTS).statusCode).toBe(409);
      expect(getErrorDefinition(ErrorCodes.RATE_LIMIT_EXCEEDED).statusCode).toBe(429);
      expect(getErrorDefinition(ErrorCodes.PAYMENT_REQUIRED).statusCode).toBe(402);
      expect(getErrorDefinition(ErrorCodes.RESOURCE_FORBIDDEN).statusCode).toBe(403);
      expect(getErrorDefinition(ErrorCodes.SERVER_ERROR).statusCode).toBe(500);
    });

    it('should fallback to SERVER_ERROR for unknown codes', () => {
      // @ts-expect-error - testing invalid code
      const def = getErrorDefinition('UNKNOWN_CODE');

      expect(def.statusCode).toBe(500);
      expect(def.message).toBe('Internal server error');
    });
  });
});
