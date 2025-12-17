/**
 * VeilForms - Library Index
 * Re-exports all library functions for convenient imports
 */

// Auth
export {
  PASSWORD_REQUIREMENTS,
  validatePasswordStrength,
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
} from "./validation";

// Token blocklist
export {
  revokeToken as revokeTokenFromBlocklist,
  isTokenRevoked,
  cleanupExpiredTokens,
  getBlocklistStats,
} from "./token-blocklist";
