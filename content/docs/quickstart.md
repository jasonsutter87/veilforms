---
title: "Quick Start"
description: "Get your first VeilForms form running in 5 minutes"
layout: "docs"
---

# Quick Start

Get a privacy-first, client-side encrypted form running in 5 minutes.

## 1. Create an Account

Sign up at [veilforms.com/signup](https://veilforms.com/signup). No credit card required for the free tier.

## 2. Create Your First Form

In the dashboard, click **"New Form"**. Enter a name and your form fields.

<div class="callout warning">
<strong>Important:</strong> When you create a form, a unique encryption key pair is generated <em>in your browser</em>. You'll be shown a private key — <strong>save this immediately</strong>. We cannot recover it. Without it, you cannot decrypt submissions.
</div>

## 3. Get Your Embed Code

After creating your form, you'll receive:

- **Form ID** — Unique identifier for your form
- **Public Key** — Used to encrypt submissions (safe to expose)
- **Private Key** — Used to decrypt submissions (keep secret!)
- **Embed Code** — Ready-to-use HTML snippet

## 4. Add to Your Website

### Option A: Simple HTML

```html
<!-- Add the SDK -->
<script src="https://veilforms.com/js/veilforms.min.js"></script>

<!-- Initialize with your form ID and public key -->
<script>
  VeilForms.init('vf-abc123', {
    publicKey: 'eyJrdHkiOiJSU0EiLC...', // Your public key (base64)
    encryption: true,
    piiStrip: true
  });
</script>

<!-- Add data-veilform to any form -->
<form data-veilform>
  <label>
    Name
    <input type="text" name="name" required>
  </label>

  <label>
    Message
    <textarea name="message" required></textarea>
  </label>

  <button type="submit">Send</button>
</form>
```

### Option B: NPM Install

```bash
npm install veilforms
```

```javascript
import VeilForms from 'veilforms';

VeilForms.init('vf-abc123', {
  publicKey: process.env.VEILFORMS_PUBLIC_KEY,
  encryption: true,
  piiStrip: true
});
```

### Option C: Manual Submission

```javascript
// Submit data programmatically
const result = await VeilForms.submit({
  name: 'Anonymous User',
  feedback: 'Great product!',
  rating: 5
});

console.log(result.submissionId); // vf-xyz789...
```

## 5. Handle Success/Error

```javascript
// Listen for form events
document.querySelector('form').addEventListener('veilforms:success', (e) => {
  console.log('Submitted!', e.detail.submissionId);
  // Show success message, redirect, etc.
});

document.querySelector('form').addEventListener('veilforms:error', (e) => {
  console.error('Failed:', e.detail.error);
  // Show error message
});
```

## 6. View Submissions

Go to your [dashboard](https://veilforms.com/dashboard) to view submissions.

<div class="callout info">
<strong>Client-Side Decryption:</strong> When you view submissions, your browser fetches encrypted blobs and decrypts them using your private key (stored in localStorage). We never see the plaintext.
</div>

## What Just Happened?

When a user submitted your form:

1. **PII Detection** — The SDK scanned for emails, phones, SSNs, etc.
2. **PII Stripping** — Detected PII was removed (if `piiStrip: true`)
3. **Encryption** — Data was encrypted with your public key using RSA+AES
4. **Anonymous ID** — A cryptographic submission ID was generated (no user info)
5. **Transmission** — Only the encrypted blob was sent to our servers
6. **Storage** — We stored the blob. We cannot decrypt it.

## Next Steps

- [Configuration Options](/docs/sdk/configuration/) — All SDK settings
- [PII Detection](/docs/sdk/pii-detection/) — Customize PII handling
- [Key Management](/docs/guides/key-management/) — Backup and recover keys
- [API Reference](/docs/api/authentication/) — Access submissions via API
