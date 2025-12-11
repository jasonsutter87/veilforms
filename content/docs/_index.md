---
title: "Documentation"
description: "Learn how to integrate VeilForms - the client-first, privacy-focused form builder"
layout: "docs"
---

# VeilForms Documentation

Build privacy-first forms with client-side encryption. Your users' data is encrypted before it ever leaves their browser.

<div class="callout success">
<strong>Client-First Architecture</strong> — Data is encrypted in the browser using your public key. We never see plaintext. You control the private key.
</div>

## What is VeilForms?

VeilForms is a privacy-first form builder designed for developers who care about user data protection. Unlike traditional form builders that encrypt data "at rest" on their servers, VeilForms encrypts data **in the user's browser** before transmission.

### Key Features

- **Client-Side Encryption** — RSA-2048 + AES-256 encryption happens in the browser
- **Automatic PII Detection** — Detect and strip personally identifiable information
- **Anonymous Submission IDs** — Cryptographic IDs with no link to user identity
- **You Own Your Keys** — Private keys never leave your device
- **Developer SDK** — Simple JavaScript SDK for any website
- **REST API** — Full API access for custom integrations

## Quick Example

```html
<script src="https://veilforms.com/js/veilforms.min.js"></script>
<script>
  VeilForms.init('your-form-id', {
    publicKey: 'your-public-key',
    encryption: true,
    piiStrip: true
  });
</script>

<form data-veilform>
  <input name="feedback" placeholder="Your feedback">
  <button type="submit">Send</button>
</form>
```

That's it. Form submissions are now encrypted client-side, stripped of PII, and stored as encrypted blobs that only you can decrypt.

## How It Works

```
User fills form → Browser encrypts → Sends ciphertext → We store blob
                                                              ↓
You view data ← Your browser decrypts ← We send blob ← You request
```

1. **User submits form** — Data exists only in their browser
2. **SDK encrypts** — Using your form's public key
3. **SDK strips PII** — Emails, phones, SSNs detected and removed
4. **Ciphertext transmitted** — We receive encrypted blob only
5. **You decrypt** — Using private key stored in your browser

## Why Client-First?

Traditional form builders:
- Receive your data in plaintext
- Encrypt it on their servers (they have the keys)
- Can read, leak, or be compelled to share your data

VeilForms:
- Never receives plaintext data
- Cannot decrypt your submissions
- Cannot comply with data requests (we have nothing to give)

**This isn't a feature. It's our architecture.**

## Next Steps

<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-top: 24px;">
  <a href="/docs/quickstart/" style="display: block; padding: 20px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; text-decoration: none; color: var(--text);">
    <strong>Quick Start →</strong>
    <p style="margin: 8px 0 0; color: var(--text-muted); font-size: 0.875rem;">Get your first form running in 5 minutes</p>
  </a>
  <a href="/docs/api/authentication/" style="display: block; padding: 20px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; text-decoration: none; color: var(--text);">
    <strong>API Reference →</strong>
    <p style="margin: 8px 0 0; color: var(--text-muted); font-size: 0.875rem;">Full REST API documentation</p>
  </a>
</div>
