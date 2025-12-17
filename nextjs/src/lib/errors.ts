/**
 * VeilForms - Centralized Error Handling
 * Provides standardized error codes, messages, and helpful hints
 */

import { NextResponse } from "next/server";

/**
 * Error codes catalog
 */
export const ErrorCodes = {
  // Authentication errors (1xxx)
  AUTH_REQUIRED: "AUTH_REQUIRED",
  AUTH_INVALID_TOKEN: "AUTH_INVALID_TOKEN",
  AUTH_TOKEN_EXPIRED: "AUTH_TOKEN_EXPIRED",
  AUTH_INVALID_CREDENTIALS: "AUTH_INVALID_CREDENTIALS",
  AUTH_EMAIL_NOT_VERIFIED: "AUTH_EMAIL_NOT_VERIFIED",
  AUTH_USER_NOT_FOUND: "AUTH_USER_NOT_FOUND",
  AUTH_USER_ALREADY_EXISTS: "AUTH_USER_ALREADY_EXISTS",
  AUTH_WEAK_PASSWORD: "AUTH_WEAK_PASSWORD",
  AUTH_ACCOUNT_LOCKED: "AUTH_ACCOUNT_LOCKED",

  // Validation errors (2xxx)
  VALIDATION_ERROR: "VALIDATION_ERROR",
  VALIDATION_MISSING_FIELD: "VALIDATION_MISSING_FIELD",
  VALIDATION_INVALID_EMAIL: "VALIDATION_INVALID_EMAIL",
  VALIDATION_INVALID_FORMAT: "VALIDATION_INVALID_FORMAT",
  VALIDATION_TOO_LONG: "VALIDATION_TOO_LONG",
  VALIDATION_TOO_SHORT: "VALIDATION_TOO_SHORT",

  // Encryption errors (3xxx)
  ENCRYPTION_ERROR: "ENCRYPTION_ERROR",
  ENCRYPTION_INVALID_KEY: "ENCRYPTION_INVALID_KEY",
  ENCRYPTION_FAILED: "ENCRYPTION_FAILED",
  DECRYPTION_FAILED: "DECRYPTION_FAILED",
  DECRYPTION_KEY_MISMATCH: "DECRYPTION_KEY_MISMATCH",
  KEY_FORMAT_ERROR: "KEY_FORMAT_ERROR",
  KEY_NOT_FOUND: "KEY_NOT_FOUND",
  KEY_EXPORT_FAILED: "KEY_EXPORT_FAILED",
  KEY_IMPORT_FAILED: "KEY_IMPORT_FAILED",
  KEY_PASSWORD_WEAK: "KEY_PASSWORD_WEAK",
  KEY_PASSWORD_INCORRECT: "KEY_PASSWORD_INCORRECT",

  // Resource errors (4xxx)
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",
  RESOURCE_ALREADY_EXISTS: "RESOURCE_ALREADY_EXISTS",
  RESOURCE_FORBIDDEN: "RESOURCE_FORBIDDEN",
  RESOURCE_DELETED: "RESOURCE_DELETED",

  // Rate limiting (5xxx)
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  QUOTA_EXCEEDED: "QUOTA_EXCEEDED",

  // Payment & Billing (6xxx)
  PAYMENT_REQUIRED: "PAYMENT_REQUIRED",
  SUBSCRIPTION_REQUIRED: "SUBSCRIPTION_REQUIRED",
  SUBSCRIPTION_INACTIVE: "SUBSCRIPTION_INACTIVE",
  PAYMENT_FAILED: "PAYMENT_FAILED",

  // Server errors (9xxx)
  SERVER_ERROR: "SERVER_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
  EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",
  NETWORK_ERROR: "NETWORK_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

interface ErrorDefinition {
  message: string;
  hint: string;
  statusCode: number;
}

/**
 * Error definitions with messages and hints
 */
const errorDefinitions: Record<ErrorCode, ErrorDefinition> = {
  // Authentication
  [ErrorCodes.AUTH_REQUIRED]: {
    message: "Authentication required",
    hint: "Please log in to access this resource. Include your JWT token in the Authorization header.",
    statusCode: 401,
  },
  [ErrorCodes.AUTH_INVALID_TOKEN]: {
    message: "Invalid authentication token",
    hint: "Your authentication token is malformed or invalid. Please log in again.",
    statusCode: 401,
  },
  [ErrorCodes.AUTH_TOKEN_EXPIRED]: {
    message: "Authentication token expired",
    hint: "Your session has expired. Please log in again to continue.",
    statusCode: 401,
  },
  [ErrorCodes.AUTH_INVALID_CREDENTIALS]: {
    message: "Invalid email or password",
    hint: "Please check your credentials and try again. Passwords are case-sensitive.",
    statusCode: 401,
  },
  [ErrorCodes.AUTH_EMAIL_NOT_VERIFIED]: {
    message: "Email not verified",
    hint: "Please verify your email address before logging in. Check your inbox for the verification link.",
    statusCode: 403,
  },
  [ErrorCodes.AUTH_USER_NOT_FOUND]: {
    message: "User not found",
    hint: "No account exists with this email address. Please sign up first.",
    statusCode: 404,
  },
  [ErrorCodes.AUTH_USER_ALREADY_EXISTS]: {
    message: "User already exists",
    hint: "An account with this email already exists. Try logging in instead.",
    statusCode: 409,
  },
  [ErrorCodes.AUTH_WEAK_PASSWORD]: {
    message: "Password is too weak",
    hint: "Password must be at least 12 characters long and contain uppercase, lowercase, and numbers.",
    statusCode: 400,
  },
  [ErrorCodes.AUTH_ACCOUNT_LOCKED]: {
    message: "Account temporarily locked",
    hint: "Too many failed login attempts. Please try again in 15 minutes.",
    statusCode: 429,
  },

  // Validation
  [ErrorCodes.VALIDATION_ERROR]: {
    message: "Validation error",
    hint: "One or more fields failed validation. Check the error details.",
    statusCode: 400,
  },
  [ErrorCodes.VALIDATION_MISSING_FIELD]: {
    message: "Required field missing",
    hint: "Please provide all required fields in your request.",
    statusCode: 400,
  },
  [ErrorCodes.VALIDATION_INVALID_EMAIL]: {
    message: "Invalid email address",
    hint: "Please provide a valid email address in the format: user@example.com",
    statusCode: 400,
  },
  [ErrorCodes.VALIDATION_INVALID_FORMAT]: {
    message: "Invalid format",
    hint: "The provided data does not match the expected format. Check the documentation.",
    statusCode: 400,
  },
  [ErrorCodes.VALIDATION_TOO_LONG]: {
    message: "Value too long",
    hint: "The provided value exceeds the maximum allowed length.",
    statusCode: 400,
  },
  [ErrorCodes.VALIDATION_TOO_SHORT]: {
    message: "Value too short",
    hint: "The provided value does not meet the minimum length requirement.",
    statusCode: 400,
  },

  // Encryption
  [ErrorCodes.ENCRYPTION_ERROR]: {
    message: "Encryption error",
    hint: "Failed to encrypt data. Please ensure you have valid encryption keys configured.",
    statusCode: 500,
  },
  [ErrorCodes.ENCRYPTION_INVALID_KEY]: {
    message: "Invalid encryption key",
    hint: "The provided encryption key is invalid or malformed. Keys must be valid JWK format.",
    statusCode: 400,
  },
  [ErrorCodes.ENCRYPTION_FAILED]: {
    message: "Encryption failed",
    hint: "Unable to encrypt the data. This may be a temporary issue, please try again.",
    statusCode: 500,
  },
  [ErrorCodes.DECRYPTION_FAILED]: {
    message: "Decryption failed",
    hint: "Unable to decrypt the data. Ensure you are using the correct private key.",
    statusCode: 400,
  },
  [ErrorCodes.DECRYPTION_KEY_MISMATCH]: {
    message: "Decryption key mismatch",
    hint: "The private key does not match the public key used for encryption.",
    statusCode: 400,
  },
  [ErrorCodes.KEY_FORMAT_ERROR]: {
    message: "Invalid key format",
    hint: "The provided encryption key is not in valid JWK (JSON Web Key) format.",
    statusCode: 400,
  },
  [ErrorCodes.KEY_NOT_FOUND]: {
    message: "Encryption key not found",
    hint: "The private key for this form could not be found.",
    statusCode: 404,
  },
  [ErrorCodes.KEY_EXPORT_FAILED]: {
    message: "Key export failed",
    hint: "Unable to export encryption keys. Please try again.",
    statusCode: 500,
  },
  [ErrorCodes.KEY_IMPORT_FAILED]: {
    message: "Key import failed",
    hint: "Unable to import encryption keys. Ensure the file is a valid VeilForms key export.",
    statusCode: 400,
  },
  [ErrorCodes.KEY_PASSWORD_WEAK]: {
    message: "Key password is too weak",
    hint: "Password must be at least 8 characters long for key export.",
    statusCode: 400,
  },
  [ErrorCodes.KEY_PASSWORD_INCORRECT]: {
    message: "Incorrect key password",
    hint: "The password you entered is incorrect.",
    statusCode: 401,
  },

  // Resources
  [ErrorCodes.RESOURCE_NOT_FOUND]: {
    message: "Resource not found",
    hint: "The requested resource does not exist or has been deleted.",
    statusCode: 404,
  },
  [ErrorCodes.RESOURCE_ALREADY_EXISTS]: {
    message: "Resource already exists",
    hint: "A resource with this identifier already exists.",
    statusCode: 409,
  },
  [ErrorCodes.RESOURCE_FORBIDDEN]: {
    message: "Access forbidden",
    hint: "You do not have permission to access this resource.",
    statusCode: 403,
  },
  [ErrorCodes.RESOURCE_DELETED]: {
    message: "Resource has been deleted",
    hint: "This resource was previously deleted and cannot be accessed.",
    statusCode: 410,
  },

  // Rate limiting
  [ErrorCodes.RATE_LIMIT_EXCEEDED]: {
    message: "Rate limit exceeded",
    hint: "You have made too many requests. Please wait before trying again.",
    statusCode: 429,
  },
  [ErrorCodes.QUOTA_EXCEEDED]: {
    message: "Quota exceeded",
    hint: "You have exceeded your plan limits. Upgrade your plan or wait for the next billing cycle.",
    statusCode: 429,
  },

  // Payment & Billing
  [ErrorCodes.PAYMENT_REQUIRED]: {
    message: "Payment required",
    hint: "This feature requires a paid plan. Please upgrade your subscription.",
    statusCode: 402,
  },
  [ErrorCodes.SUBSCRIPTION_REQUIRED]: {
    message: "Active subscription required",
    hint: "This action requires an active subscription. Please subscribe to a plan.",
    statusCode: 402,
  },
  [ErrorCodes.SUBSCRIPTION_INACTIVE]: {
    message: "Subscription is inactive",
    hint: "Your subscription is paused or expired. Please update your payment method.",
    statusCode: 403,
  },
  [ErrorCodes.PAYMENT_FAILED]: {
    message: "Payment failed",
    hint: "Unable to process payment. Please check your payment method and try again.",
    statusCode: 402,
  },

  // Server errors
  [ErrorCodes.SERVER_ERROR]: {
    message: "Internal server error",
    hint: "An unexpected error occurred. Please try again later.",
    statusCode: 500,
  },
  [ErrorCodes.DATABASE_ERROR]: {
    message: "Database error",
    hint: "Unable to access the database. This may be a temporary issue.",
    statusCode: 500,
  },
  [ErrorCodes.EXTERNAL_SERVICE_ERROR]: {
    message: "External service error",
    hint: "A third-party service is currently unavailable. Please try again later.",
    statusCode: 503,
  },
  [ErrorCodes.NETWORK_ERROR]: {
    message: "Network error",
    hint: "Unable to complete the request due to a network issue.",
    statusCode: 500,
  },
};

interface CreateErrorOptions {
  message?: string;
  hint?: string;
  details?: Record<string, unknown>;
  field?: string;
}

interface ErrorObject {
  error: string;
  code: ErrorCode;
  hint: string;
  details?: Record<string, unknown>;
  field?: string;
}

/**
 * Create a standardized error object
 */
export function createError(
  code: ErrorCode,
  options: CreateErrorOptions = {}
): ErrorObject {
  const definition =
    errorDefinitions[code] || errorDefinitions[ErrorCodes.SERVER_ERROR];

  return {
    error: options.message || definition.message,
    code,
    hint: options.hint || definition.hint,
    ...(options.details && { details: options.details }),
    ...(options.field && { field: options.field }),
  };
}

interface ErrorResponseOptions extends CreateErrorOptions {
  statusCode?: number;
}

/**
 * Create a standardized error Response for Next.js
 */
export function errorResponse(
  code: ErrorCode,
  options: ErrorResponseOptions = {}
): NextResponse {
  const definition =
    errorDefinitions[code] || errorDefinitions[ErrorCodes.SERVER_ERROR];
  const errorData = createError(code, options);

  return NextResponse.json(errorData, {
    status: options.statusCode || definition.statusCode,
  });
}

interface FieldError {
  field: string;
  message: string;
  code?: string;
}

/**
 * Create a validation error response with multiple field errors
 */
export function validationErrorResponse(fieldErrors: FieldError[]): NextResponse {
  return NextResponse.json(
    {
      error: "Validation error",
      code: ErrorCodes.VALIDATION_ERROR,
      hint: "One or more fields failed validation. See details for more information.",
      details: fieldErrors,
    },
    { status: 400 }
  );
}

/**
 * Get error definition for a code
 */
export function getErrorDefinition(code: ErrorCode): ErrorDefinition {
  return errorDefinitions[code] || errorDefinitions[ErrorCodes.SERVER_ERROR];
}
