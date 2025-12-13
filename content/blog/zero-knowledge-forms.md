---
title: "Zero-Knowledge Forms: What They Are and Why They Matter"
description: "Explore zero-knowledge architecture for web forms. Learn how form providers can offer services without ever accessing your users' data."
priority: 0.6
date: 2025-11-25
category: "Privacy"
author: "VeilForms Team"
readTime: 6
tags: ["zero-knowledge", "privacy", "architecture", "encryption"]
type: "blog"
css: ["blog.css"]
---

What if your form provider couldn't read your data even if they wanted to? That's the promise of zero-knowledge architecture.

## What is Zero-Knowledge?

In cryptography, "zero-knowledge" means one party can prove something to another without revealing the underlying information. Applied to form services, it means:

**The provider processes your data without being able to read it.**

This isn't about trust or policy—it's about mathematical impossibility. The provider literally cannot access your plaintext data because they never have the decryption keys.

## How Traditional Forms Work

```
User → [Plaintext Data] → Provider Server → [Stored in Database]
                              ↓
                    Provider can read everything
```

With traditional form builders:
1. User enters data
2. Data is sent in plaintext (protected only by HTTPS)
3. Provider receives plaintext data
4. Provider encrypts it for storage (server-side encryption)
5. Provider holds the encryption keys

**The provider has full access to your data.**

## How Zero-Knowledge Forms Work

```
User → [Encrypted in Browser] → Provider Server → [Stored Encrypted]
              ↓
    Only you have the key                Provider cannot decrypt
```

With zero-knowledge forms:
1. User enters data
2. Data is encrypted in the browser using your public key
3. Only ciphertext is transmitted
4. Provider stores ciphertext
5. Only you have the private key to decrypt

**The provider never sees plaintext data.**

## The Technical Implementation

### Key Generation

When you create a form, you generate an RSA key pair:

```javascript
// This happens in your browser
const keyPair = await window.crypto.subtle.generateKey(
  {
    name: "RSA-OAEP",
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: "SHA-256",
  },
  true,
  ["encrypt", "decrypt"]
);

// Public key goes to server (for encryption)
// Private key stays with you (for decryption)
```

### Encryption Flow

1. Generate random AES key for this submission
2. Encrypt form data with AES-256-GCM
3. Encrypt AES key with your RSA public key
4. Send encrypted data + encrypted key to server

```javascript
// Simplified encryption flow
async function encryptSubmission(data, publicKey) {
  // Generate random AES key
  const aesKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt"]
  );

  // Encrypt data with AES
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedData = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    new TextEncoder().encode(JSON.stringify(data))
  );

  // Encrypt AES key with RSA public key
  const rawAesKey = await crypto.subtle.exportKey("raw", aesKey);
  const encryptedKey = await crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    publicKey,
    rawAesKey
  );

  return { encryptedData, encryptedKey, iv };
}
```

### What the Server Receives

```json
{
  "encrypted": true,
  "version": "vf-e1",
  "data": "aGVsbG8gd29ybGQ...", // Base64 encrypted data
  "key": "YWJjZGVm...",          // Base64 encrypted AES key
  "iv": "MTIzNDU2..."            // Base64 initialization vector
}
```

The server stores this blob. It cannot decrypt it because it doesn't have your private key.

### Decryption

Only you can decrypt, using your private key:

```javascript
async function decryptSubmission(encrypted, privateKey) {
  // Decrypt AES key with RSA private key
  const aesKeyRaw = await crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    encrypted.encryptedKey
  );

  // Import AES key
  const aesKey = await crypto.subtle.importKey(
    "raw",
    aesKeyRaw,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  // Decrypt data with AES
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: encrypted.iv },
    aesKey,
    encrypted.encryptedData
  );

  return JSON.parse(new TextDecoder().decode(decrypted));
}
```

## Why This Matters

### 1. Breach Protection

If the provider is breached, attackers get:
- **Traditional forms**: All your users' data in plaintext
- **Zero-knowledge forms**: Encrypted blobs they cannot decrypt

### 2. Insider Threat Mitigation

- **Traditional forms**: Employees can access data
- **Zero-knowledge forms**: No employee can read data

### 3. Legal Compulsion

If the provider receives a subpoena:
- **Traditional forms**: They must hand over readable data
- **Zero-knowledge forms**: They can only provide encrypted data

### 4. Third-Party Risk

- **Traditional forms**: Provider may share data with analytics tools
- **Zero-knowledge forms**: Nothing readable to share

### 5. Trust Model

- **Traditional forms**: You must trust the provider
- **Zero-knowledge forms**: Trust is mathematically enforced

## Trade-offs

Zero-knowledge isn't free. Consider these trade-offs:

### Server-Side Processing Limitations

The server can't:
- Search within submissions (it's all ciphertext)
- Run analytics on form data
- Apply server-side validation rules
- Auto-respond based on content

**Mitigation**: Process decrypted data on your end, or use client-side validation.

### Key Management Responsibility

You're responsible for:
- Keeping your private key secure
- Not losing your private key
- Rotating keys when needed

**Mitigation**: Use secure key storage, implement key backup procedures.

### Performance

Client-side encryption adds:
- ~50-100ms for encryption
- Slightly larger payload (base64 encoding)

**Mitigation**: For most forms, this is imperceptible.

## When to Use Zero-Knowledge Forms

**Great for:**
- Healthcare data (PHI)
- Financial information
- Legal documents
- Employee feedback
- Whistleblower reports
- Any sensitive personal data

**May be overkill for:**
- Newsletter signups (email only)
- Public polls
- Non-sensitive surveys

But honestly? Even "non-sensitive" data can become sensitive in aggregate. Default to encryption.

## Getting Started

VeilForms implements zero-knowledge architecture:

```html
<form data-veilform="your-form-id">
  <!-- Your form fields -->
</form>

<script src="https://cdn.veilforms.com/v1/veilforms.esm.js"></script>
```

That's it. All submissions are encrypted in the browser. We never see your users' data.

---

Zero-knowledge isn't just a feature—it's a fundamentally different trust model. Instead of "trust us," it's "verify with math."

Your users deserve that level of protection.
