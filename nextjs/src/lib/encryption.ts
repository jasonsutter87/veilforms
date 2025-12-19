/**
 * VeilForms - Encryption Utilities
 *
 * Two types of encryption:
 * 1. Client-side RSA: For form submissions (user controls keys)
 * 2. Server-side AES: For OAuth tokens (server controls keys)
 */

import crypto from "crypto";
import { apiLogger } from "./logger";

// ============================================================================
// CLIENT-SIDE ENCRYPTION (Form Submissions)
// ============================================================================

/**
 * Generate RSA key pair for form encryption
 */
export async function generateKeyPair(): Promise<{
  publicKey: JsonWebKey;
  privateKey: JsonWebKey;
}> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );

  const publicKey = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const privateKey = await crypto.subtle.exportKey("jwk", keyPair.privateKey);

  return { publicKey, privateKey };
}

// ============================================================================
// SERVER-SIDE ENCRYPTION (OAuth Tokens)
// ============================================================================

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

/**
 * Get encryption key from environment
 * This should be a 32-byte hex string stored in environment variables
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    throw new Error("ENCRYPTION_KEY environment variable not set");
  }

  // Validate key format and length
  if (!/^[a-f0-9]{64}$/i.test(key)) {
    throw new Error("ENCRYPTION_KEY must be a 64-character hex string (32 bytes)");
  }

  return Buffer.from(key, "hex");
}

/**
 * Derive a key from the master key and a salt
 * This allows per-record encryption keys while storing a single master key
 */
function deriveKey(masterKey: Buffer, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(masterKey, salt, 100000, 32, "sha256");
}

export interface EncryptedData {
  encrypted: string; // Base64-encoded encrypted data
  iv: string; // Base64-encoded IV
  authTag: string; // Base64-encoded auth tag
  salt: string; // Base64-encoded salt
  version: string; // Encryption version for future upgrades
}

/**
 * Encrypt sensitive data (like OAuth tokens)
 * Returns an object with encrypted data and metadata
 */
export function encryptData(plaintext: string): EncryptedData {
  try {
    const masterKey = getEncryptionKey();

    // Generate random salt and IV
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);

    // Derive key from master key + salt
    const key = deriveKey(masterKey, salt);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Encrypt data
    const encrypted = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);

    // Get auth tag
    const authTag = cipher.getAuthTag();

    return {
      encrypted: encrypted.toString("base64"),
      iv: iv.toString("base64"),
      authTag: authTag.toString("base64"),
      salt: salt.toString("base64"),
      version: "1",
    };
  } catch (error) {
    apiLogger.error({ error }, "Encryption failed");
    throw new Error("Failed to encrypt data");
  }
}

/**
 * Decrypt encrypted data
 * Returns the original plaintext
 */
export function decryptData(encryptedData: EncryptedData): string {
  try {
    const masterKey = getEncryptionKey();

    // Decode base64 values
    const encrypted = Buffer.from(encryptedData.encrypted, "base64");
    const iv = Buffer.from(encryptedData.iv, "base64");
    const authTag = Buffer.from(encryptedData.authTag, "base64");
    const salt = Buffer.from(encryptedData.salt, "base64");

    // Derive the same key
    const key = deriveKey(masterKey, salt);

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt data
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch (error) {
    apiLogger.error({ error }, "Decryption failed");
    throw new Error("Failed to decrypt data");
  }
}

/**
 * Encrypt OAuth token for storage
 */
export function encryptToken(token: string): string {
  const encrypted = encryptData(token);
  return JSON.stringify(encrypted);
}

/**
 * Decrypt OAuth token from storage
 */
export function decryptToken(encryptedToken: string): string {
  try {
    const encrypted = JSON.parse(encryptedToken) as EncryptedData;
    return decryptData(encrypted);
  } catch (error) {
    apiLogger.error({ error }, "Token decryption failed");
    throw new Error("Failed to decrypt token");
  }
}

/**
 * Check if encryption key is configured
 */
export function isEncryptionConfigured(): boolean {
  try {
    getEncryptionKey();
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate a random encryption key (for setup/testing)
 * This should be run once and stored in environment variables
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString("hex");
}
