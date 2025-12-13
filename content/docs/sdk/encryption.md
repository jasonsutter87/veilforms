---
title: "Encryption"
description: "How VeilForms encrypts data client-side before submission"
type: "pages"
layout: "docs"
css: ["docs.css"]
priority: 0.5
---

# Encryption

VeilForms uses hybrid encryption to secure form data in the browser before it ever leaves the user's device.

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│ User's Browser                                              │
│                                                             │
│  1. User fills form                                         │
│           ↓                                                 │
│  2. SDK collects form data                                  │
│           ↓                                                 │
│  3. Generate random AES-256 key                             │
│           ↓                                                 │
│  4. Encrypt form data with AES key                          │
│           ↓                                                 │
│  5. Encrypt AES key with your RSA public key                │
│           ↓                                                 │
│  6. Send encrypted payload to VeilForms                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ VeilForms Server                                            │
│                                                             │
│  Receives and stores encrypted blob                         │
│  Cannot decrypt (no private key)                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Encryption Algorithms

| Component | Algorithm | Key Size | Purpose |
|-----------|-----------|----------|---------|
| Asymmetric | RSA-OAEP | 2048 bits | Encrypt the AES key |
| Symmetric | AES-GCM | 256 bits | Encrypt form data |
| Hash | SHA-256 | 256 bits | RSA padding, integrity |

### Why Hybrid Encryption?

**RSA alone is insufficient:**
- Limited to ~190 bytes with RSA-2048 + OAEP padding
- Slow for large data
- Deterministic (same input = same output without proper padding)

**AES alone lacks key distribution:**
- Symmetric keys must be shared securely
- No public/private key benefit

**Hybrid combines the best of both:**
- AES encrypts unlimited data, fast
- RSA securely delivers the AES key
- Each submission uses a unique AES key

## Encrypted Payload Structure

When data is encrypted, the SDK produces this payload:

```json
{
  "encrypted": true,
  "version": "vf-e1",
  "data": "aGVsbG8gd29ybGQuLi4=",
  "key": "ZW5jcnlwdGVkIGFlcyBrZXkuLi4=",
  "iv": "cmFuZG9tIGl2Li4u"
}
```

| Field | Description |
|-------|-------------|
| `encrypted` | Boolean flag indicating encryption status |
| `version` | Encryption format version for future compatibility |
| `data` | AES-GCM encrypted form data (base64) |
| `key` | RSA-OAEP encrypted AES key (base64) |
| `iv` | AES initialization vector (base64) |

## Encryption Code

The SDK uses the Web Crypto API:

### Encrypt Submission

```javascript
async function encryptSubmission(formData, publicKeyJwk) {
  // Import the public key
  const publicKey = await crypto.subtle.importKey(
    'jwk',
    publicKeyJwk,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  );

  // Generate a one-time AES key
  const aesKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  // Encrypt form data with AES
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(JSON.stringify(formData));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encryptedData = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    dataBytes
  );

  // Encrypt AES key with RSA
  const aesKeyBytes = await crypto.subtle.exportKey('raw', aesKey);
  const encryptedKey = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    publicKey,
    aesKeyBytes
  );

  return {
    encrypted: true,
    version: 'vf-e1',
    data: arrayBufferToBase64(encryptedData),
    key: arrayBufferToBase64(encryptedKey),
    iv: arrayBufferToBase64(iv)
  };
}
```

### Decrypt Submission

Decryption happens in your browser when viewing submissions:

```javascript
async function decryptSubmission(encryptedPayload, privateKeyJwk) {
  // Import private key
  const privateKey = await crypto.subtle.importKey(
    'jwk',
    privateKeyJwk,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['decrypt']
  );

  // Decrypt the AES key
  const encryptedKeyBytes = base64ToArrayBuffer(encryptedPayload.key);
  const aesKeyBytes = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    privateKey,
    encryptedKeyBytes
  );

  // Import AES key
  const aesKey = await crypto.subtle.importKey(
    'raw',
    aesKeyBytes,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  // Decrypt form data
  const iv = base64ToArrayBuffer(encryptedPayload.iv);
  const encryptedData = base64ToArrayBuffer(encryptedPayload.data);

  const decryptedBytes = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    encryptedData
  );

  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(decryptedBytes));
}
```

## Using the Encryption Utilities

The SDK exposes encryption utilities for advanced use:

```javascript
import {
  generateKeyPair,
  encryptSubmission,
  decryptSubmission,
  hashField
} from 'veilforms/core/encryption';

// Generate new key pair
const keys = await generateKeyPair();
console.log('Public key:', keys.publicKey);
console.log('Private key:', keys.privateKey);

// Encrypt data
const encrypted = await encryptSubmission(
  { name: 'John', message: 'Hello' },
  keys.publicKey
);

// Decrypt data
const decrypted = await decryptSubmission(encrypted, keys.privateKey);
console.log(decrypted); // { name: 'John', message: 'Hello' }
```

## Field Hashing

Hash sensitive fields for de-duplication without storing PII:

```javascript
import { hashField } from 'veilforms/core/encryption';

// Hash an email for duplicate detection
const emailHash = await hashField('john@example.com', 'form-salt');
// Returns: "a3f2b8c9d4e5f6a7..."

// Same email always produces same hash (with same salt)
const emailHash2 = await hashField('john@example.com', 'form-salt');
// Returns: "a3f2b8c9d4e5f6a7..." (identical)

// Different salt = different hash
const emailHash3 = await hashField('john@example.com', 'other-salt');
// Returns: "7b9c3d4e5f6a2b8c..." (different)
```

## Encryption in Transit

In addition to client-side encryption, all data is transmitted over HTTPS:

```
Browser ──[HTTPS]──> VeilForms Server
         └── TLS 1.3
             └── Already encrypted payload inside
```

This provides two layers:
1. **Client-side encryption** — Protects data from VeilForms
2. **HTTPS** — Protects data from network attackers

## Encryption at Rest

Encrypted payloads are stored as-is in Netlify Blob storage:

- No additional server-side encryption (already encrypted)
- No decryption keys on our servers
- Standard storage redundancy and durability

## Key Security

| Key Type | Where Stored | Who Can Access |
|----------|--------------|----------------|
| Public Key | VeilForms servers, embedded in SDK | Anyone (safe) |
| Private Key | Your browser localStorage | Only you |
| AES Keys | Generated per-submission, never stored | Nobody after encryption |

## Cryptographic Guarantees

With VeilForms encryption:

1. **Confidentiality** — Only private key holder can read data
2. **Integrity** — AES-GCM detects tampering
3. **Forward Secrecy** — Each submission uses a unique AES key
4. **Non-repudiation** — Submissions tied to form via public key

## Without Encryption

If you disable encryption (`encryption: false`):

```javascript
VeilForms.init('vf-abc123', {
  encryption: false
});
```

Data is sent as plaintext JSON:

```json
{
  "encrypted": false,
  "data": {
    "name": "John",
    "message": "Hello"
  }
}
```

<div class="callout warning">
<strong>Warning:</strong> With encryption disabled, VeilForms and anyone with database access can read your submissions. Only disable for testing.
</div>

## Troubleshooting

### "Invalid public key format"

Ensure your public key is valid JWK format:

```javascript
// Correct - JWK object or base64-encoded JWK
const publicKey = {
  kty: 'RSA',
  n: '0vx7agoebG...',
  e: 'AQAB'
};

// Or base64 encoded
const publicKey = 'eyJrdHkiOiJSU0EiLCJuIjoiMHZ4N2Fnb2ViRy4uLiIsImUiOiJBUUFCIn0=';
```

### "Decryption failed"

Common causes:
- Wrong private key for this form
- Corrupted payload
- Key/payload version mismatch

```javascript
try {
  const data = await decryptSubmission(payload, privateKey);
} catch (error) {
  if (error.name === 'OperationError') {
    console.error('Wrong key or corrupted data');
  }
}
```

### Browser Compatibility

If Web Crypto API is unavailable:

```javascript
if (!window.crypto || !window.crypto.subtle) {
  console.warn('Web Crypto API not available. Using polyfill.');
  // SDK automatically falls back to js-based crypto
}
```

## Next Steps

- [Key Management](/docs/guides/key-management/) — Secure your keys
- [PII Detection](/docs/sdk/pii-detection/) — Strip PII before encryption
- [Core Concepts](/docs/concepts/) — Understand the architecture
