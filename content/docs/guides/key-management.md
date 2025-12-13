---
title: "Key Management"
description: "How to securely manage your VeilForms encryption keys"
type: "pages"
layout: "docs"
css: ["docs.css"]
priority: 0.5
---

# Key Management

Your encryption keys are the foundation of VeilForms security. This guide covers how to generate, backup, recover, and rotate your keys.

<div class="callout warning">
<strong>Critical:</strong> VeilForms cannot recover your private keys. If you lose them, you permanently lose access to decrypt your submissions. There is no "forgot password" for cryptographic keys.
</div>

## Understanding Key Pairs

Each form has a unique RSA-2048 key pair:

| Key | Where It Lives | Purpose |
|-----|----------------|---------|
| **Public Key** | VeilForms servers + SDK | Encrypts submissions |
| **Private Key** | Your browser only | Decrypts submissions |

The public key is safe to expose — it can only encrypt, not decrypt. The private key must be kept secret.

## Key Generation

Keys are generated **in your browser** when you create a form:

```javascript
// This happens automatically when you create a form
const keyPair = await crypto.subtle.generateKey(
  {
    name: 'RSA-OAEP',
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: 'SHA-256'
  },
  true, // extractable
  ['encrypt', 'decrypt']
);
```

The private key is stored in your browser's `localStorage` under `veilforms_private_keys`. It **never** leaves your device — we never see it.

## Backing Up Private Keys

### Immediately After Form Creation

When you create a form, the dashboard shows your private key. **Copy it immediately.**

```json
{
  "kty": "RSA",
  "n": "0vx7agoebG...",
  "e": "AQAB",
  "d": "X4cTteJY_g...",
  "p": "83i-7IvMGX...",
  "q": "3dfOR9cuY...",
  ...
}
```

### Export From Dashboard

1. Go to **Dashboard → Key Management**
2. Click **Export** next to the form
3. Save the JSON file securely

### Export Programmatically

```javascript
// In browser console on dashboard
const keys = JSON.parse(localStorage.getItem('veilforms_private_keys'));
const formKey = keys['vf-abc123'];
console.log(JSON.stringify(formKey, null, 2));
// Copy this output
```

## Secure Storage Recommendations

### For Individuals

1. **Password Manager** — Store key JSON in 1Password, Bitwarden, etc.
2. **Encrypted File** — Save to encrypted USB drive
3. **Paper Backup** — Print the key (yes, really) for cold storage

### For Teams

1. **Secrets Manager** — AWS Secrets Manager, HashiCorp Vault, etc.
2. **Encrypted Storage** — Team password manager with shared vault
3. **HSM** — Hardware Security Module for enterprise

### What NOT To Do

- ❌ Email keys to yourself
- ❌ Store in plain text files
- ❌ Commit to git repositories
- ❌ Store in unencrypted cloud storage
- ❌ Screenshot and save in photos

## Recovering Keys

### From Browser Storage

If you're on the same device/browser:

```javascript
const keys = JSON.parse(localStorage.getItem('veilforms_private_keys'));
console.log(keys);
```

### From Backup

1. Go to **Dashboard → Key Management**
2. Click **Import Key**
3. Enter the Form ID
4. Paste your private key JSON
5. Click **Import**

```javascript
// Or programmatically
const keys = JSON.parse(localStorage.getItem('veilforms_private_keys') || '{}');
keys['vf-abc123'] = yourBackedUpKey;
localStorage.setItem('veilforms_private_keys', JSON.stringify(keys));
```

## Key Rotation

To rotate keys (recommended annually or after team changes):

### 1. Create New Key Pair

```javascript
import { generateKeyPair } from 'veilforms/core/encryption';

const newKeyPair = await generateKeyPair();
```

### 2. Update Form's Public Key

```bash
curl -X PATCH "https://veilforms.com/api/forms/vf-abc123" \
  -H "Authorization: Bearer vf_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{"publicKey": {...new public key...}}'
```

### 3. Store New Private Key

Save the new private key in your secure storage.

### 4. Keep Old Private Key

You still need the old key to decrypt old submissions. Store both:

```javascript
// In localStorage
{
  "vf-abc123": newPrivateKey,
  "vf-abc123-v1": oldPrivateKey  // Keep for old submissions
}
```

## Multi-Device Access

Private keys are in browser localStorage — they don't sync across devices. To access submissions from multiple devices:

### Option 1: Export/Import

Export key from Device A, import on Device B.

### Option 2: Server-Side Decryption

Store your private key on a secure server and build a backend that:
1. Fetches encrypted submissions from VeilForms API
2. Decrypts using your stored private key
3. Returns plaintext to your authenticated users

### Option 3: Sync Service

Use your own sync mechanism (encrypted cloud storage) to share keys across devices.

## Lost Key Recovery

<div class="callout warning">
<strong>There is no recovery.</strong> If you lose your private key and have no backup, submissions encrypted with that key are permanently unreadable. This is by design — it's what makes the system secure.
</div>

Your options:

1. **Check all browsers** — Keys are per-browser. Check other browsers/devices.
2. **Check backups** — Password manager, encrypted files, paper backups.
3. **Export plaintext** — If you previously exported decrypted data, you have that.
4. **Accept loss** — Create a new form with new keys. Old data is gone.

## Security Incident Response

If you suspect key compromise:

### 1. Rotate Immediately

Generate new keys and update the form.

### 2. Export Submissions

Decrypt and export all submissions with the old (compromised) key.

### 3. Purge Old Data

Delete all submissions encrypted with the compromised key.

### 4. Re-import with New Key

If needed, re-encrypt and re-submit the exported data.

### 5. Revoke API Keys

Generate new API keys in case those were also compromised.

## Best Practices Checklist

- [ ] Back up private key immediately after form creation
- [ ] Store backup in password manager or secrets vault
- [ ] Never share private keys via email or chat
- [ ] Rotate keys annually or after team member departures
- [ ] Keep old keys for historical submission access
- [ ] Test key recovery process before you need it
- [ ] Document key locations for your team
