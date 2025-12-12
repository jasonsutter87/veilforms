---
title: 'Documentation'
description: 'Learn how to use VeilForms to build privacy-first forms with client-side encryption.'
type: 'pages'
layout: 'docs'
cta: true
css: ['docs.css']
js: []
---

# Getting Started with VeilForms

VeilForms is a privacy-first form builder that encrypts data in the user's browser before it's transmitted. This means we literally cannot read your users' data—even if we wanted to.

## Why VeilForms?

Traditional form builders receive your data in plaintext, store it on their servers, and can read it at any time. With VeilForms:

- **Client-side encryption**: Data is encrypted using RSA-2048 + AES-256 before leaving the browser
- **Zero knowledge**: We only store ciphertext that we cannot decrypt
- **You own your keys**: Private keys never leave your device
- **Automatic PII detection**: Identify and optionally strip sensitive data

## Quick Installation

Add the VeilForms SDK to your page:

```html
<script src="https://veilforms.com/js/veilforms.min.js"></script>
```

Initialize on your form:

```javascript
VeilForms.init('your-form-id', {
  encryption: true,
  piiStrip: true
});
```

Add the `data-veilform` attribute to your form:

```html
<form data-veilform>
  <input name="email" type="email" placeholder="Email">
  <textarea name="message" placeholder="Message"></textarea>
  <button type="submit">Send</button>
</form>
```

## Next Steps

- [Quick Start Guide](/docs/quickstart/) - Get up and running in 5 minutes
- [Core Concepts](/docs/concepts/) - Understand how VeilForms encryption works
- [API Reference](/docs/api/) - Full API documentation
