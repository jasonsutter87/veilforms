---
title: "Troubleshooting"
description: "Common issues and solutions for VeilForms integration"
type: "pages"
layout: "docs"
css: ["docs.css"]
priority: 0.5
---

# Troubleshooting

Common issues and solutions for VeilForms integration.

## SDK Issues

### Form not submitting

**Symptoms:** Click submit but nothing happens, no network request.

**Causes and Solutions:**

1. **SDK not initialized**

```javascript
// Wrong - using before init
document.querySelector('form').addEventListener('submit', () => {
  VeilForms.submit(data); // Error: VeilForms not initialized
});

// Correct - init first
VeilForms.init('vf-abc123', { publicKey: '...' });
```

2. **Missing data-veilform attribute**

```html
<!-- Won't be auto-bound -->
<form id="contact">...</form>

<!-- Will be auto-bound -->
<form data-veilform>...</form>
```

3. **Form added after page load**

```javascript
// Form added dynamically
document.body.innerHTML += '<form data-veilform>...</form>';

// Must re-bind
VeilForms.bindForms();
```

4. **JavaScript error blocking submission**

Check browser console for errors. Common issues:
- Missing closing brackets
- Undefined variables
- Network errors

---

### "VeilForms is not defined"

**Cause:** SDK script not loaded or loaded after your code.

**Solutions:**

1. **Ensure script is included**

```html
<script src="https://veilforms.com/js/veilforms.min.js"></script>
```

2. **Wait for script to load**

```html
<script src="https://veilforms.com/js/veilforms.min.js"></script>
<script>
  // VeilForms is now available
  VeilForms.init('vf-abc123', {...});
</script>
```

3. **Use DOMContentLoaded for safety**

```javascript
document.addEventListener('DOMContentLoaded', () => {
  if (typeof VeilForms !== 'undefined') {
    VeilForms.init('vf-abc123', {...});
  } else {
    console.error('VeilForms SDK not loaded');
  }
});
```

---

### "Invalid public key format"

**Cause:** Public key is not valid JWK format.

**Solutions:**

1. **Use the correct key from dashboard**

The public key should look like:
```
eyJrdHkiOiJSU0EiLCJuIjoiMHZ4N2Fnb2ViRy4uLiIsImUiOiJBUUFCIn0=
```

2. **Don't use the private key**

The private key has additional fields (`d`, `p`, `q`, etc.). Only use the public key on the client.

3. **Check for copy errors**

Ensure no extra whitespace or truncation when copying the key.

---

### Events not firing

**Cause:** Listening on wrong element or before binding.

**Solutions:**

1. **Listen on the form element**

```javascript
// Correct - listen on form
document.querySelector('form').addEventListener('veilforms:success', handler);

// Also works - listen on document (events bubble)
document.addEventListener('veilforms:success', handler);
```

2. **Attach listeners before submission**

```javascript
// Wrong - listener added too late
VeilForms.init('vf-abc123', {...});
form.submit(); // Events fire but nothing listening

// Correct - listener added first
form.addEventListener('veilforms:success', handler);
VeilForms.init('vf-abc123', {...});
```

---

### Encryption not working

**Symptoms:** Data sent unencrypted, `encrypted: false` in payload.

**Causes:**

1. **No public key provided**

```javascript
// Missing publicKey - no encryption
VeilForms.init('vf-abc123', {});

// With publicKey - encryption enabled
VeilForms.init('vf-abc123', {
  publicKey: 'eyJrdHkiOiJSU0EiLC...'
});
```

2. **Encryption explicitly disabled**

```javascript
// Encryption disabled
VeilForms.init('vf-abc123', {
  publicKey: '...',
  encryption: false  // Disables encryption
});
```

3. **Browser doesn't support Web Crypto API**

Check browser compatibility. IE11 and very old browsers are not supported.

```javascript
if (!window.crypto || !window.crypto.subtle) {
  console.error('Web Crypto API not supported');
}
```

---

### PII not being stripped

**Cause:** `piiStrip` option not enabled.

```javascript
// Warning only (default)
VeilForms.init('vf-abc123', {
  publicKey: '...',
  piiWarning: true,  // Logs warnings
  piiStrip: false    // Doesn't strip
});

// Strip PII
VeilForms.init('vf-abc123', {
  publicKey: '...',
  piiStrip: true  // Strips detected PII
});
```

---

## API Issues

### 401 Unauthorized

**Causes:**

1. **Missing Authorization header**

```javascript
// Wrong
fetch('https://veilforms.com/api/forms');

// Correct
fetch('https://veilforms.com/api/forms', {
  headers: {
    'Authorization': 'Bearer vf_live_abc123'
  }
});
```

2. **Invalid API key format**

```javascript
// Wrong - missing Bearer prefix
headers: { 'Authorization': 'vf_live_abc123' }

// Wrong - typo in Bearer
headers: { 'Authorization': 'bearer vf_live_abc123' }

// Correct
headers: { 'Authorization': 'Bearer vf_live_abc123' }
```

3. **Revoked or expired key**

Generate a new key from the dashboard.

---

### 429 Rate Limited

**Cause:** Too many requests in time window.

**Solutions:**

1. **Implement backoff**

```javascript
async function fetchWithBackoff(url, options, attempt = 1) {
  const response = await fetch(url, options);

  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get('Retry-After')) || 60;
    const delay = retryAfter * 1000 * Math.pow(2, attempt - 1);
    await new Promise(r => setTimeout(r, delay));
    return fetchWithBackoff(url, options, attempt + 1);
  }

  return response;
}
```

2. **Check rate limit headers**

```javascript
const response = await fetch(url, options);
console.log('Remaining:', response.headers.get('X-RateLimit-Remaining'));
console.log('Reset:', new Date(response.headers.get('X-RateLimit-Reset') * 1000));
```

3. **Upgrade plan** for higher limits

---

### CORS errors

**Cause:** Making API requests from browser to wrong origin.

**Solutions:**

1. **Use SDK for client-side submissions**

The SDK handles CORS automatically:

```javascript
VeilForms.init('vf-abc123', { publicKey: '...' });
await VeilForms.submit(data); // Works from browser
```

2. **Make API calls from server**

API keys should never be exposed in browser code:

```javascript
// Server-side (Node.js)
const response = await fetch('https://veilforms.com/api/forms', {
  headers: { 'Authorization': `Bearer ${process.env.VEILFORMS_API_KEY}` }
});
```

---

## Dashboard Issues

### Can't decrypt submissions

**Symptoms:** "Decryption failed" error when viewing submissions.

**Causes:**

1. **Wrong private key**

Each form has a unique key pair. Ensure you're using the private key for this specific form.

2. **Private key not in browser**

The private key is stored in your browser's localStorage. If you cleared browser data or switched browsers:

- Export your private key from your original browser
- Import it in the new browser via Settings → Security

3. **Corrupted key**

If the key was truncated or modified, decryption will fail. Regenerate keys if necessary (you'll lose access to existing encrypted submissions).

---

### Forms not appearing in dashboard

**Causes:**

1. **Wrong account**

Verify you're logged into the correct account.

2. **Form not created yet**

Forms are created when you first initialize the SDK and receive a submission.

3. **Test vs live mode**

Check if you're viewing test or live forms (toggle in dashboard header).

---

### Webhook not triggering

**Causes:**

1. **Webhook not enabled**

Enable webhooks in Form Settings → Webhooks.

2. **Invalid webhook URL**

- Must be HTTPS (not HTTP)
- Must be publicly accessible
- Must return 2xx status code

3. **Webhook endpoint errors**

Check delivery logs in Form Settings → Webhooks → Delivery Logs.

4. **Test with webhook testing tool**

Use the "Send Test" button in webhook settings to verify endpoint.

---

## Common Errors

### "Form ID not found"

**Cause:** Using invalid or non-existent form ID.

**Solutions:**

1. Get correct form ID from dashboard
2. Ensure you haven't deleted the form
3. Check test vs live mode

---

### "Submission failed: Network error"

**Causes:**

1. **No internet connection**

Check network connectivity.

2. **Firewall blocking requests**

Ensure `veilforms.com` is not blocked.

3. **Content Security Policy**

Add VeilForms to your CSP:

```
script-src 'self' https://veilforms.com;
connect-src 'self' https://veilforms.com;
```

---

### "Maximum payload size exceeded"

**Cause:** Form data too large (>1MB).

**Solutions:**

1. **Reduce file upload sizes**
2. **Split into multiple submissions**
3. **Contact support** for larger limits

---

## Debug Mode

Enable debug mode to see detailed logs:

```javascript
VeilForms.init('vf-abc123', {
  publicKey: '...',
  debug: true
});
```

Console output:

```
[VeilForms] Initialized with form: vf-abc123
[VeilForms] Bound form: contact-form
[VeilForms] PII detected: { hasPII: true, fields: [...] }
[VeilForms] Data encrypted client-side
[VeilForms] Submission successful: vf-xyz789
```

---

## Browser Console Checks

Run these in your browser console to diagnose issues:

```javascript
// Check if SDK is loaded
console.log('VeilForms loaded:', typeof VeilForms !== 'undefined');

// Check Web Crypto API support
console.log('Web Crypto:', !!window.crypto?.subtle);

// Check if forms are bound
document.querySelectorAll('form[data-veilform]').forEach((f, i) => {
  console.log(`Form ${i}:`, f.id || f.name || 'unnamed');
});

// Test PII detection
if (typeof VeilForms !== 'undefined') {
  const result = VeilForms.utils.detectPII({
    email: 'test@example.com',
    message: 'Call me at 555-1234'
  });
  console.log('PII detection:', result);
}
```

---

## Getting Help

If you're still stuck:

1. **Check documentation** — [docs.veilforms.com](/docs/)
2. **Search issues** — [GitHub Issues](https://github.com/veilforms/veilforms/issues)
3. **Contact support** — support@veilforms.com

Include in your support request:
- Browser and version
- SDK version
- Error messages (full text)
- Console logs with `debug: true`
- Request ID (from error responses)
