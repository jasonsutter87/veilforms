/**
 * VeilForms - Client-Side Encryption Module
 * Encrypt form data BEFORE it leaves the browser
 * Based on ZTA.io Zero Trust principles
 */

/**
 * Generate a new encryption key pair for a form
 * Public key encrypts submissions, private key for owner to decrypt
 * @returns {Promise<object>} - Key pair with public/private keys
 */
export async function generateKeyPair() {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true, // extractable
    ['encrypt', 'decrypt']
  );

  const publicKey = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const privateKey = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

  return {
    publicKey,
    privateKey,
    createdAt: Date.now(),
  };
}

/**
 * Generate a symmetric key for form data encryption
 * @returns {Promise<CryptoKey>}
 */
async function generateSymmetricKey() {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt form data client-side before submission
 * Uses hybrid encryption: AES for data, RSA for the AES key
 * @param {object} formData - The form data to encrypt
 * @param {object} publicKeyJwk - Form owner's public key (JWK format)
 * @returns {Promise<object>} - Encrypted payload
 */
export async function encryptSubmission(formData, publicKeyJwk) {
  // Import the public key
  const publicKey = await crypto.subtle.importKey(
    'jwk',
    publicKeyJwk,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  );

  // Generate a one-time symmetric key for this submission
  const symmetricKey = await generateSymmetricKey();

  // Encrypt the form data with AES
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(JSON.stringify(formData));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encryptedData = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    symmetricKey,
    dataBytes
  );

  // Export and encrypt the symmetric key with RSA
  const symmetricKeyBytes = await crypto.subtle.exportKey('raw', symmetricKey);
  const encryptedKey = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    publicKey,
    symmetricKeyBytes
  );

  // Return the encrypted payload
  return {
    encrypted: true,
    version: 'vf-e1', // encryption version for future compatibility
    data: arrayBufferToBase64(encryptedData),
    key: arrayBufferToBase64(encryptedKey),
    iv: arrayBufferToBase64(iv),
  };
}

/**
 * Decrypt form submission (form owner only)
 * @param {object} encryptedPayload - The encrypted submission
 * @param {object} privateKeyJwk - Form owner's private key (JWK format)
 * @returns {Promise<object>} - Decrypted form data
 */
export async function decryptSubmission(encryptedPayload, privateKeyJwk) {
  if (!encryptedPayload.encrypted) {
    return encryptedPayload; // Not encrypted, return as-is
  }

  // Import the private key
  const privateKey = await crypto.subtle.importKey(
    'jwk',
    privateKeyJwk,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['decrypt']
  );

  // Decrypt the symmetric key
  const encryptedKeyBytes = base64ToArrayBuffer(encryptedPayload.key);
  const symmetricKeyBytes = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    privateKey,
    encryptedKeyBytes
  );

  // Import the symmetric key
  const symmetricKey = await crypto.subtle.importKey(
    'raw',
    symmetricKeyBytes,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  // Decrypt the data
  const iv = base64ToArrayBuffer(encryptedPayload.iv);
  const encryptedData = base64ToArrayBuffer(encryptedPayload.data);

  const decryptedBytes = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    symmetricKey,
    encryptedData
  );

  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(decryptedBytes));
}

/**
 * Hash sensitive field for anonymous matching
 * (e.g., detect duplicate submissions without storing email)
 * @param {string} value - Value to hash
 * @param {string} salt - Unique salt per form
 * @returns {Promise<string>} - Hashed value
 */
export async function hashField(value, salt = '') {
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + value.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return arrayBufferToBase64(hashBuffer);
}

// Utility functions
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
