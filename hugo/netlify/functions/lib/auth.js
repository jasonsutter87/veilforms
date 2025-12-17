import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { isTokenRevoked, revokeToken as revokeTokenFromBlocklist } from './token-blocklist.js';

// SECURITY: JWT_SECRET must be set in environment - no fallback
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is required');
}

// Reduced from 7d to 24h for better security
const JWT_EXPIRY = '24h';

// Password requirements
export const PASSWORD_REQUIREMENTS = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: false // keeping it reasonable
};

// Validate password strength
export function validatePassword(password) {
  const errors = [];

  if (!password || password.length < PASSWORD_REQUIREMENTS.minLength) {
    errors.push(`Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters`);
  }
  if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (PASSWORD_REQUIREMENTS.requireNumber && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (PASSWORD_REQUIREMENTS.requireSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// Hash password with cost factor 12 (OWASP recommended for 2024+)
// Cost factor 12 = 4096 iterations, provides strong protection against brute force
export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

// Verify password
export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// Create JWT token with explicit algorithm specification
export function createToken(payload) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRY,
    algorithm: 'HS256',
    issuer: 'veilforms',
    audience: 'veilforms-api'
  });
}

// Verify JWT token with explicit algorithm specification
// Also checks token blocklist for revoked tokens
export async function verifyToken(token) {
  try {
    // First verify the token signature and expiry
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'veilforms',
      audience: 'veilforms-api'
    });

    // Then check if token has been revoked
    const revoked = await isTokenRevoked(token);
    if (revoked) {
      return null;
    }

    return decoded;
  } catch (err) {
    return null;
  }
}

// Extract token from Authorization header
export function getTokenFromHeader(headers) {
  const auth = headers.get('authorization') || headers.get('Authorization');
  if (!auth) return null;

  const parts = auth.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;

  return parts[1];
}

// Middleware helper - verify auth and return user
export async function authenticateRequest(req) {
  const token = getTokenFromHeader(req.headers);
  if (!token) {
    return { error: 'No token provided', status: 401 };
  }

  const decoded = await verifyToken(token);
  if (!decoded) {
    return { error: 'Invalid token', status: 401 };
  }

  return { user: decoded };
}

// Generate API key
export function generateApiKey() {
  const prefix = process.env.NODE_ENV === 'production' ? 'vf_live_' : 'vf_test_';
  const randomPart = Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return prefix + randomPart;
}

// Re-export token revocation for convenience
export async function revokeToken(token) {
  return revokeTokenFromBlocklist(token);
}
