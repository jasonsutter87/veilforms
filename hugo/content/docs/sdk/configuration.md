---
title: "SDK Configuration"
description: "Configure the VeilForms SDK for your needs"
type: "pages"
layout: "docs"
css: ["docs.css"]
priority: 0.5
---

# SDK Configuration

Configure VeilForms to match your privacy requirements and use case.

## Basic Configuration

```javascript
VeilForms.init('vf-abc123', {
  publicKey: 'eyJrdHkiOiJSU0EiLC...',
  encryption: true,
  piiStrip: true
});
```

## All Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `publicKey` | string | `null` | Your form's public key (JWK format, base64 encoded) |
| `endpoint` | string | `https://veilforms.com/api/submit` | API endpoint for submissions |
| `encryption` | boolean | `true` | Enable client-side encryption |
| `piiWarning` | boolean | `true` | Log warnings when PII is detected |
| `piiStrip` | boolean | `false` | Strip detected PII before submission |
| `autoBind` | boolean | `true` | Auto-bind forms with `data-veilform` |
| `debug` | boolean | `false` | Enable debug logging |

## Configuration Reference

### publicKey

**Required.** Your form's RSA public key in JWK format, base64 encoded.

```javascript
VeilForms.init('vf-abc123', {
  publicKey: 'eyJrdHkiOiJSU0EiLCJuIjoiMHZ4N2Fnb2ViRy4uLiIsImUiOiJBUUFCIn0='
});
```

Get your public key from the [Dashboard](/dashboard/) after creating a form.

<div class="callout warning">
<strong>Never expose your private key.</strong> The public key is safe to embed in client-side code. The private key must remain secret.
</div>

### endpoint

Override the submission endpoint for self-hosted deployments:

```javascript
VeilForms.init('vf-abc123', {
  publicKey: '...',
  endpoint: 'https://forms.yourdomain.com/api/submit'
});
```

### encryption

Enable or disable client-side encryption:

```javascript
// Encryption enabled (default)
VeilForms.init('vf-abc123', {
  publicKey: '...',
  encryption: true
});

// Encryption disabled (data sent as plaintext)
VeilForms.init('vf-abc123', {
  encryption: false
});
```

<div class="callout warning">
<strong>Warning:</strong> Disabling encryption means data is transmitted and stored in plaintext. Only disable for testing or when using your own encryption layer.
</div>

### piiWarning

When enabled, the SDK logs console warnings when PII is detected:

```javascript
VeilForms.init('vf-abc123', {
  publicKey: '...',
  piiWarning: true // Default
});
```

Console output:

```
[VeilForms] PII detected in submission: {
  hasPII: true,
  fields: [{ field: 'email', reason: 'field_name_suggests_pii' }],
  patterns: [{ field: 'message', type: 'email' }]
}
```

### piiStrip

Automatically strip detected PII before encryption:

```javascript
VeilForms.init('vf-abc123', {
  publicKey: '...',
  piiStrip: true
});
```

Before stripping:

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "message": "Call me at 555-123-4567"
}
```

After stripping:

```json
{
  "name": "[REDACTED]",
  "email": "[REDACTED]",
  "message": "Call me at [REDACTED]"
}
```

See [PII Detection](/docs/sdk/pii-detection/) for customization options.

### autoBind

Automatically bind to forms with the `data-veilform` attribute:

```javascript
// Auto-bind enabled (default)
VeilForms.init('vf-abc123', {
  publicKey: '...',
  autoBind: true
});
```

```html
<!-- This form is automatically handled -->
<form data-veilform>
  <input name="message">
  <button type="submit">Send</button>
</form>
```

Disable for manual control:

```javascript
VeilForms.init('vf-abc123', {
  publicKey: '...',
  autoBind: false
});

// Manually submit
document.querySelector('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = { message: e.target.message.value };
  await VeilForms.submit(data);
});
```

### debug

Enable verbose logging for development:

```javascript
VeilForms.init('vf-abc123', {
  publicKey: '...',
  debug: true
});
```

Debug output:

```
[VeilForms] Initialized with form: vf-abc123
[VeilForms] Bound form: contact-form
[VeilForms] PII stripped from fields: ['email', 'phone']
[VeilForms] Data encrypted client-side
[VeilForms] Submission successful: vf-xyz789
```

## Environment-Based Configuration

```javascript
const isDev = window.location.hostname === 'localhost';

VeilForms.init('vf-abc123', {
  publicKey: process.env.VEILFORMS_PUBLIC_KEY,
  debug: isDev,
  piiWarning: true,
  piiStrip: !isDev, // Strip in production, warn in dev
});
```

## Multiple Forms

Configure multiple forms with different settings:

```javascript
// Contact form - strict PII handling
VeilForms.init('vf-contact', {
  publicKey: 'contact-public-key...',
  piiStrip: true
});

// Feedback form - allow some PII
VeilForms.init('vf-feedback', {
  publicKey: 'feedback-public-key...',
  piiWarning: true,
  piiStrip: false
});
```

```html
<form data-veilform data-veilform-id="vf-contact">
  <!-- Uses contact config -->
</form>

<form data-veilform data-veilform-id="vf-feedback">
  <!-- Uses feedback config -->
</form>
```

## Form-Level Attributes

Override configuration per form using data attributes:

```html
<form
  data-veilform
  data-veilform-reset="false"
  data-veilform-redirect="/thank-you"
>
  <!-- Form fields -->
</form>
```

| Attribute | Description |
|-----------|-------------|
| `data-veilform` | Marks form for VeilForms handling |
| `data-veilform-id` | Override form ID |
| `data-veilform-reset` | Reset form after submission (`true`/`false`) |
| `data-veilform-redirect` | Redirect URL after success |

## Verifying Configuration

Enable debug mode to verify your configuration:

```javascript
VeilForms.init('vf-abc123', {
  publicKey: '...',
  debug: true
});

// Console output shows initialization details:
// [VeilForms] Initialized with form: vf-abc123
// [VeilForms] Encryption: enabled
// [VeilForms] PII stripping: disabled
```

## Configuration Errors

### Missing Public Key

```javascript
VeilForms.init('vf-abc123', {});
// Warning: No publicKey provided. Submissions will not be encrypted.
```

### Invalid Public Key

```javascript
VeilForms.init('vf-abc123', { publicKey: 'invalid' });
// Error: Invalid public key format. Expected JWK.
```

### Initialization Before DOM Ready

```javascript
// Wrong - SDK may not find forms
VeilForms.init('vf-abc123', { publicKey: '...' });

// Correct - wait for DOM
document.addEventListener('DOMContentLoaded', () => {
  VeilForms.init('vf-abc123', { publicKey: '...' });
});
```

## Next Steps

- [Encryption](/docs/sdk/encryption/) — How encryption works
- [PII Detection](/docs/sdk/pii-detection/) — Customize PII handling
- [Events](/docs/sdk/events/) — Handle form events
