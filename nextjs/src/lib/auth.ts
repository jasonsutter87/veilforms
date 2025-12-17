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

// SECURITY: JWT_SECRET must be set in environment
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";

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
  return jwt.sign(payload, JWT_SECRET, {
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
    const decoded = jwt.verify(token, JWT_SECRET, {
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

  return parts[1];
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
