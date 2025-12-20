/**
 * VeilForms - Authentication Library
 * JWT tokens, password hashing, and authentication middleware
 */

import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import {
  isTokenRevoked,
  revokeToken as revokeTokenFromBlocklist,
} from "./token-blocklist";

/**
 * Calculate Shannon entropy of a string
 * Returns entropy in bits per character
 */
function calculateEntropy(str: string): number {
  const len = str.length;
  const frequencies: Record<string, number> = {};

  // Count character frequencies
  for (const char of str) {
    frequencies[char] = (frequencies[char] || 0) + 1;
  }

  // Calculate entropy
  let entropy = 0;
  for (const char in frequencies) {
    const freq = frequencies[char];
    if (freq === undefined) continue;
    const p = freq / len;
    entropy -= p * Math.log2(p);
  }

  return entropy;
}

/**
 * Validate JWT secret meets security requirements
 * - Minimum 32 characters
 * - Must contain uppercase, lowercase, digits, AND special characters
 * - Must have sufficient entropy (minimum 3.5 bits per character)
 */
function validateJwtSecret(secret: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (secret.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters');
  }

  if (!/[A-Z]/.test(secret)) {
    errors.push('JWT_SECRET must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(secret)) {
    errors.push('JWT_SECRET must contain at least one lowercase letter');
  }

  if (!/[0-9]/.test(secret)) {
    errors.push('JWT_SECRET must contain at least one digit');
  }

  if (!/[!@#$%^&*(),.?":{}|<>_\-+=[\]\\/`~;']/.test(secret)) {
    errors.push('JWT_SECRET must contain at least one special character');
  }

  // Check entropy (minimum 3.5 bits per character for good randomness)
  const entropy = calculateEntropy(secret);
  if (entropy < 3.5) {
    errors.push(`JWT_SECRET has insufficient entropy (${entropy.toFixed(2)} bits/char, minimum 3.5)`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// SECURITY: JWT_SECRET must be set in environment with strong entropy
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable must be set');
  }

  const validation = validateJwtSecret(secret);
  if (!validation.valid) {
    throw new Error(`JWT_SECRET validation failed:\n${validation.errors.join('\n')}`);
  }

  return secret;
}

const JWT_EXPIRY = "24h";

// Password requirements
export const PASSWORD_REQUIREMENTS = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: false,
};

interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

interface TokenPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

interface AuthResult {
  user?: TokenPayload;
  error?: string;
  status?: number;
}

interface PasswordStrengthIndicators {
  length: boolean;
  uppercase: boolean;
  lowercase: boolean;
  number: boolean;
  special?: boolean;
}

/**
 * Validate password strength
 */
export function validatePasswordStrength(
  password: string
): PasswordValidationResult {
  const errors: string[] = [];

  if (!password || password.length < PASSWORD_REQUIREMENTS.minLength) {
    errors.push(
      `Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters`
    );
  }
  if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  if (PASSWORD_REQUIREMENTS.requireNumber && !/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }
  if (
    PASSWORD_REQUIREMENTS.requireSpecial &&
    !/[!@#$%^&*(),.?":{}|<>]/.test(password)
  ) {
    errors.push("Password must contain at least one special character");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check password strength indicators for UI feedback
 * Returns individual boolean flags for each requirement
 */
export function checkPasswordStrength(
  password: string
): PasswordStrengthIndicators {
  return {
    length: password.length >= PASSWORD_REQUIREMENTS.minLength,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    ...(PASSWORD_REQUIREMENTS.requireSpecial && {
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    }),
  };
}

/**
 * Hash password with bcrypt cost factor 12
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/**
 * Verify password against hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Create JWT token
 */
export function createToken(payload: { userId: string; email: string }): string {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: JWT_EXPIRY,
    algorithm: "HS256",
    issuer: "veilforms",
    audience: "veilforms-api",
  });
}

/**
 * Verify JWT token and check blocklist
 */
export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const decoded = jwt.verify(token, getJwtSecret(), {
      algorithms: ["HS256"],
      issuer: "veilforms",
      audience: "veilforms-api",
    }) as TokenPayload;

    // Check if token has been revoked
    const revoked = await isTokenRevoked(token);
    if (revoked) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

/**
 * Extract token from Authorization header
 */
export function getTokenFromHeader(headers: Headers): string | null {
  const auth = headers.get("authorization") || headers.get("Authorization");
  if (!auth) return null;

  const parts = auth.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;

  return parts[1] ?? null;
}

/**
 * Middleware helper - verify auth and return user
 */
export async function authenticateRequest(req: NextRequest): Promise<AuthResult> {
  const token = getTokenFromHeader(req.headers);
  if (!token) {
    return { error: "No token provided", status: 401 };
  }

  const decoded = await verifyToken(token);
  if (!decoded) {
    return { error: "Invalid token", status: 401 };
  }

  return { user: decoded };
}

/**
 * Generate API key
 */
export function generateApiKey(): string {
  const prefix =
    process.env.NODE_ENV === "production" ? "vf_live_" : "vf_test_";
  const randomBytes = new Uint8Array(24);
  crypto.getRandomValues(randomBytes);
  const randomPart = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return prefix + randomPart;
}

/**
 * Revoke a token
 */
export async function revokeToken(token: string) {
  return revokeTokenFromBlocklist(token);
}

/**
 * Interface for requireAuth result
 */
export interface RequireAuthResult {
  authenticated: boolean;
  userId: string;
  email?: string;
}

/**
 * Require authentication - returns userId if authenticated
 * Use this in API routes for cleaner auth checking
 */
export async function requireAuth(
  req: NextRequest
): Promise<RequireAuthResult | { authenticated: false }> {
  const result = await authenticateRequest(req);

  if (result.user) {
    return {
      authenticated: true,
      userId: result.user.userId,
      email: result.user.email,
    };
  }

  return { authenticated: false };
}
