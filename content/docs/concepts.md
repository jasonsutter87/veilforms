---
title: "Core Concepts"
description: "Understand the fundamental principles behind VeilForms' privacy-first architecture"
type: "pages"
layout: "docs"
css: ["docs.css"]
priority: 0.5
---

# Core Concepts

VeilForms is built on a simple principle: **you shouldn't have to trust us with your users' data**. This guide explains the architecture that makes that possible.

## Client-First Architecture

Traditional form services follow this model:

```
User → Your Form → Form Service (plaintext) → Database
                        ↑
                   They can read it
```

VeilForms inverts this:

```
User → Your Form → Browser Encrypts → VeilForms (ciphertext) → Database
                                           ↑
                                    We cannot read it
```

The encryption happens **before** data leaves the user's browser. We only ever receive and store encrypted blobs.

## Hybrid Encryption

VeilForms uses hybrid encryption combining RSA and AES:

### Why Hybrid?

- **RSA-2048** is asymmetric (public/private key pair) but slow and limited to small data
- **AES-256** is symmetric (single key) but fast and handles any data size

We use both:

1. Generate a random AES-256 key for each submission
2. Encrypt the form data with AES (fast, any size)
3. Encrypt the AES key with your RSA public key
4. Send both encrypted pieces to our servers

### Decryption Flow

1. You fetch the encrypted submission
2. Your private RSA key decrypts the AES key
3. The AES key decrypts the form data

This gives you the security of asymmetric encryption with the performance of symmetric encryption.

## Key Pairs

Every form has a unique RSA-2048 key pair:

| Key | Location | Purpose | Security |
|-----|----------|---------|----------|
| **Public Key** | VeilForms servers, embedded in SDK | Encrypts submissions | Safe to expose |
| **Private Key** | Your browser/server only | Decrypts submissions | Must keep secret |

### Key Generation

Keys are generated in your browser using the Web Crypto API:

```javascript
const keyPair = await crypto.subtle.generateKey(
  {
    name: 'RSA-OAEP',
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: 'SHA-256'
  },
  true,
  ['encrypt', 'decrypt']
);
```

The private key is stored in your browser's `localStorage` and **never transmitted to our servers**.

## Anonymous Submission IDs

Each submission gets a cryptographic ID that:

- Is unique and unpredictable
- Contains no user information
- Cannot be traced back to the submitter
- Allows you to reference specific submissions

```javascript
// Generated client-side
const submissionId = 'vf-' + crypto.randomUUID();
// Example: vf-7f3d2a1b-9c8e-4d5f-a6b7-c8d9e0f1a2b3
```

We don't store IP addresses, user agents, or any identifying metadata.

## PII Detection

VeilForms can automatically detect and optionally strip Personally Identifiable Information:

### Detected Patterns

| Type | Pattern | Example |
|------|---------|---------|
| Email | `user@domain.com` | john@example.com |
| Phone | `(123) 456-7890` | +1-555-123-4567 |
| SSN | `123-45-6789` | 987-65-4321 |
| Credit Card | `1234 5678 9012 3456` | 4111-1111-1111-1111 |
| IP Address | `192.168.1.1` | 10.0.0.1 |
| ZIP Code | `12345` or `12345-6789` | 90210 |

### Detection vs Stripping

- **Detection** (`piiWarning: true`) — Logs warnings but submits data
- **Stripping** (`piiStrip: true`) — Replaces PII with `[REDACTED]` before encryption

Even with stripping disabled, the data is still encrypted. PII stripping adds an extra layer for compliance use cases.

## Zero-Knowledge Storage

Our storage model is "zero-knowledge" — we store your data but cannot read it:

```
┌─────────────────────────────────────────┐
│ VeilForms Server                        │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ Encrypted Blob Storage          │   │
│  │                                 │   │
│  │  formId: vf-abc123              │   │
│  │  submissionId: vf-xyz789        │   │
│  │  payload: {                     │   │
│  │    data: "aGVsbG8gd29ybGQ...",  │   │  ← We see this
│  │    key: "ZW5jcnlwdGVkLi4u...",  │   │
│  │    iv: "MTIzNDU2Nzg5..."        │   │
│  │  }                              │   │
│  │  timestamp: 1699920000000       │   │
│  │                                 │   │
│  │  // No IP, no user agent,      │   │
│  │  // no cookies, no fingerprint │   │
│  └─────────────────────────────────┘   │
│                                         │
│  We have NO private key.                │
│  We CANNOT decrypt payload.             │
│  We CANNOT comply with data requests.   │
└─────────────────────────────────────────┘
```

## Multi-Tenant Isolation

Each form operates in complete isolation:

- Separate encryption keys
- Separate storage namespace
- Separate API key scope
- No cross-form data access

Even if one form's keys were compromised, other forms remain secure.

## Browser Compatibility

VeilForms uses the Web Crypto API, supported in:

| Browser | Version |
|---------|---------|
| Chrome | 37+ |
| Firefox | 34+ |
| Safari | 11+ |
| Edge | 12+ |

For older browsers, encryption falls back to a JavaScript polyfill with identical security.

## Trust Model

### What You Trust Us For

- Storing encrypted blobs reliably
- Delivering the SDK code you embed
- API availability and performance

### What You Don't Trust Us For

- Keeping your data confidential (encryption handles that)
- Not reading your submissions (we can't)
- Protecting against rogue employees (they can't decrypt either)
- Complying with government data requests (we have nothing to give)

## Comparison with Traditional Services

| Aspect | Traditional Forms | VeilForms |
|--------|-------------------|-----------|
| Data visibility | Service can read all data | Service sees only ciphertext |
| Encryption location | Server-side (after receipt) | Client-side (before transmission) |
| Key management | Service holds keys | You hold keys |
| Compliance burden | On the service | Mostly on you |
| Data breach impact | Plaintext exposure | Encrypted blobs only |
| Government requests | Service must comply | Nothing to provide |

## Next Steps

- [Quick Start](/docs/quickstart/) — Get your first form running
- [SDK Installation](/docs/sdk/installation/) — Install the SDK
- [Key Management](/docs/guides/key-management/) — Secure your keys
