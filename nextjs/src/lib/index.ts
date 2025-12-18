/**
 * VeilForms - Library Index
 * Re-exports all library functions for convenient imports
 */

// Auth
export {
  PASSWORD_REQUIREMENTS,
  validatePasswordStrength,
  checkPasswordStrength,
  hashPassword,
  verifyPassword,
  createToken,
  verifyToken,
  getTokenFromHeader,
  authenticateRequest,
  generateApiKey,
  revokeToken,
} from "./auth";

// Storage
export {
  createUser,
  getUser,
  getUserById,
  updateUser,
  createOAuthUser,
  createPasswordResetToken,
  getPasswordResetToken,
  deletePasswordResetToken,
  createEmailVerificationToken,
  getEmailVerificationToken,
  getEmailVerificationTokenByEmail,
  deleteEmailVerificationToken,
  createForm,
  getForm,
  updateForm,
  deleteForm,
  getUserForms,
  createApiKey,
  getApiKeyData,
  updateApiKeyLastUsed,
  revokeApiKey,
  getSubmissions,
  getSubmission,
  deleteSubmission,
  deleteAllSubmissions,
} from "./storage";

// Storage types
export type {
  User,
  Form,
  FormSettings,
  Submission,
  ApiKeyData,
  TokenData,
} from "./storage";

// Errors
export {
  ErrorCodes,
  createError,
  errorResponse,
  validationErrorResponse,
  getErrorDefinition,
} from "./errors";

export type { ErrorCode } from "./errors";

// Responses
export {
  success,
  error,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  methodNotAllowed,
  tooManyRequests,
  serverError,
  created,
  noContent,
} from "./responses";

// Validation
export {
  isValidFormId,
  isValidSubmissionId,
  isValidUserId,
  isValidApiKey,
  isValidUuid,
  isValidEmail,
  isValidWebhookUrl,
  isValidHexColor,
  sanitizeString,
  validateFormName,
  validateRecipients,
  validateRetention,
  validateBranding,
  validatePassword,
  parseUrlPath,
} from "./validation";

// Token blocklist
export {
  revokeToken as revokeTokenFromBlocklist,
  isTokenRevoked,
  cleanupExpiredTokens,
  getBlocklistStats,
} from "./token-blocklist";

// CSRF Protection
export {
  generateCsrfToken,
  validateCsrfToken,
  createCsrfCookie,
  getCsrfHeaders,
} from "./csrf";

// Rate Limiting
export {
  checkRateLimit,
  recordFailedAttempt,
  clearFailedAttempts,
  isAccountLocked,
  getRateLimitHeaders,
} from "./rate-limit";

// Email
export {
  sendEmailVerification,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  FROM_EMAIL,
  FROM_NAME,
  BASE_URL,
} from "./email";

// Email Rate Limiting
export {
  checkEmailRateLimit,
  getEmailRateLimitHeaders,
  resetEmailRateLimit,
} from "./email-rate-limit";

// Encryption
export { generateKeyPair } from "./encryption";

// Audit Logging
export {
  AuditEvents,
  logAudit,
  getAuditLogs,
  getFormAuditLogs,
  getAuditContext,
} from "./audit";

export type { AuditEventType, AuditEntry, AuditContext } from "./audit";

// Idempotency
export {
  checkIdempotencyKey,
  storeIdempotencyKey,
  getIdempotencyKeyFromRequest,
  getIdempotencyHeaders,
  cleanupExpiredIdempotencyKeys,
} from "./idempotency";

// Route Handlers
export {
  publicRoute,
  authRoute,
  rateLimitResponse,
} from "./route-handler";

export type {
  AuthResult,
  RateLimitResult,
  RouteOptions,
  AuthenticatedContext,
} from "./route-handler";

// Webhooks
export {
  fireWebhookWithRetry,
  getFailedWebhooks,
  retryFailedWebhook,
} from "./webhook-retry";

// Form Helpers
export {
  verifyFormOwnership,
  getFormForSubmission,
} from "./form-helpers";

export type { FormOwnershipResult } from "./form-helpers";

// URL Helpers
export {
  getBaseUrl,
  buildTokenUrl,
  buildVerificationUrl,
  buildResetUrl,
} from "./url-helpers";

// Subscription Limits
export {
  SUBSCRIPTION_TIERS,
  getFormLimit,
  getSubmissionLimit,
  getRetentionDays,
} from "./subscription-limits";

export type { SubscriptionTier } from "./subscription-limits";

// Stripe (optional, may not want to re-export)
export {
  PLAN_CONFIG,
  getPlanConfig,
  getPlanLimits,
  getOrCreateCustomer,
  createCheckoutSession,
  createPortalSession,
  getSubscription,
  cancelSubscription,
  reactivateSubscription,
  constructWebhookEvent,
  mapSubscriptionStatus,
  getPlanFromPriceId,
  formatSubscriptionData,
  stripe,
} from "./stripe";

export type { SubscriptionData } from "./stripe";
