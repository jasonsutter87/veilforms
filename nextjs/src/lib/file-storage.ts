/**
 * VeilForms - Encrypted File Storage
 * Manages encrypted file uploads using Netlify Blobs
 */

import { getStore } from "@netlify/blobs";

/**
 * File metadata structure stored alongside encrypted files
 */
export interface EncryptedFileMetadata {
  filename: string;
  mimeType: string;
  size: number;
  encryptedData: string; // Base64 encoded encrypted blob
  encryptedKey: string;  // RSA-encrypted AES key
  iv: string;            // Initialization vector for AES
  uploadedAt: string;    // ISO timestamp
}

/**
 * File storage configuration
 */
export const FILE_STORAGE_CONFIG = {
  // Maximum file size in bytes (50 MB default)
  MAX_FILE_SIZE: 50 * 1024 * 1024,

  // Maximum files per submission
  MAX_FILES_PER_SUBMISSION: 10,

  // Default file size limit in MB
  DEFAULT_MAX_SIZE_MB: 10,

  // Store name for file blobs
  STORE_NAME: "veilforms-files",
};

/**
 * Generate storage key for a file
 * Format: submission_{submissionId}_file_{fieldId}_{index}
 */
export function generateFileKey(
  submissionId: string,
  fieldId: string,
  index: number = 0
): string {
  return `submission_${submissionId}_file_${fieldId}_${index}`;
}

/**
 * Store an encrypted file in Netlify Blobs
 */
export async function storeEncryptedFile(
  submissionId: string,
  fieldId: string,
  fileMetadata: EncryptedFileMetadata,
  index: number = 0
): Promise<void> {
  const store = getStore(FILE_STORAGE_CONFIG.STORE_NAME);
  const key = generateFileKey(submissionId, fieldId, index);

  // Store file metadata as JSON
  await store.set(key, JSON.stringify(fileMetadata), {
    metadata: {
      submissionId,
      fieldId,
      filename: fileMetadata.filename,
      mimeType: fileMetadata.mimeType,
      size: String(fileMetadata.size),
      uploadedAt: fileMetadata.uploadedAt,
    },
  });
}

/**
 * Get an encrypted file from Netlify Blobs
 */
export async function getEncryptedFile(
  submissionId: string,
  fieldId: string,
  index: number = 0
): Promise<EncryptedFileMetadata | null> {
  const store = getStore(FILE_STORAGE_CONFIG.STORE_NAME);
  const key = generateFileKey(submissionId, fieldId, index);

  const data = await store.get(key, { type: "text" });

  if (!data) {
    return null;
  }

  return JSON.parse(data) as EncryptedFileMetadata;
}

/**
 * List all files for a submission
 */
export async function listSubmissionFiles(
  submissionId: string
): Promise<Array<{ fieldId: string; index: number; metadata: EncryptedFileMetadata }>> {
  const store = getStore(FILE_STORAGE_CONFIG.STORE_NAME);
  const prefix = `submission_${submissionId}_file_`;

  const files: Array<{ fieldId: string; index: number; metadata: EncryptedFileMetadata }> = [];

  // List all blobs with the submission prefix
  const { blobs } = await store.list({ prefix });

  for (const blob of blobs) {
    const data = await store.get(blob.key, { type: "text" });
    if (data) {
      const metadata = JSON.parse(data) as EncryptedFileMetadata;

      // Parse fieldId and index from key
      // Format: submission_{submissionId}_file_{fieldId}_{index}
      const keyParts = blob.key.replace(prefix, "").split("_");
      const index = parseInt(keyParts.pop() || "0", 10);
      const fieldId = keyParts.join("_");

      files.push({ fieldId, index, metadata });
    }
  }

  return files;
}

/**
 * Delete all files for a submission
 */
export async function deleteSubmissionFiles(submissionId: string): Promise<void> {
  const store = getStore(FILE_STORAGE_CONFIG.STORE_NAME);
  const prefix = `submission_${submissionId}_file_`;

  // List all blobs with the submission prefix
  const { blobs } = await store.list({ prefix });

  // Delete each blob
  for (const blob of blobs) {
    await store.delete(blob.key);
  }
}

/**
 * Delete a specific file
 */
export async function deleteFile(
  submissionId: string,
  fieldId: string,
  index: number = 0
): Promise<void> {
  const store = getStore(FILE_STORAGE_CONFIG.STORE_NAME);
  const key = generateFileKey(submissionId, fieldId, index);
  await store.delete(key);
}

/**
 * Validate file size against field validation rules
 */
export function validateFileSize(
  fileSize: number,
  maxSizeMB?: number
): { valid: boolean; error?: string } {
  const maxSize = (maxSizeMB || FILE_STORAGE_CONFIG.DEFAULT_MAX_SIZE_MB) * 1024 * 1024;

  if (fileSize > maxSize) {
    return {
      valid: false,
      error: `File size exceeds maximum of ${maxSizeMB || FILE_STORAGE_CONFIG.DEFAULT_MAX_SIZE_MB}MB`,
    };
  }

  if (fileSize > FILE_STORAGE_CONFIG.MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds platform maximum of ${FILE_STORAGE_CONFIG.MAX_FILE_SIZE / 1024 / 1024}MB`,
    };
  }

  return { valid: true };
}

/**
 * Validate file type against allowed types
 */
export function validateFileType(
  mimeType: string,
  allowedTypes?: string[]
): { valid: boolean; error?: string } {
  if (!allowedTypes || allowedTypes.length === 0) {
    return { valid: true };
  }

  // Check if MIME type matches any allowed type
  const isAllowed = allowedTypes.some((allowed) => {
    // Handle wildcard patterns like "image/*"
    if (allowed.endsWith("/*")) {
      const prefix = allowed.replace("/*", "");
      return mimeType.startsWith(prefix);
    }

    // Exact match
    return mimeType === allowed || mimeType.endsWith(allowed);
  });

  if (!isAllowed) {
    return {
      valid: false,
      error: `File type ${mimeType} is not allowed. Allowed types: ${allowedTypes.join(", ")}`,
    };
  }

  return { valid: true };
}

/**
 * Get file count for a field in a submission
 */
export async function getFileCount(
  submissionId: string,
  fieldId: string
): Promise<number> {
  const store = getStore(FILE_STORAGE_CONFIG.STORE_NAME);
  const prefix = `submission_${submissionId}_file_${fieldId}_`;

  const { blobs } = await store.list({ prefix });
  return blobs.length;
}
