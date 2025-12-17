---
title: "SDK Installation"
description: "Install the VeilForms SDK in your project"
type: "pages"
layout: "docs"
css: ["docs.css"]
priority: 0.5
---

# SDK Installation

Install the VeilForms SDK to add client-side encrypted forms to your website or application.

## Installation Methods

### CDN (Recommended for Quick Start)

Add the script tag to your HTML with SRI (Subresource Integrity) for security:

```html
<script
  src="https://veilforms.com/js/veilforms-1.0.0.min.js"
  integrity="sha384-dxvu/QuhQhLna10DbAj9KnYMewa6zqats5B79Pv+Ae3ef2pfwjRLrRSJ76SEtWMp"
  crossorigin="anonymous">
</script>
```

The SDK is ~8KB gzipped and has no dependencies.

<div class="callout info">
<strong>What is SRI?</strong> Subresource Integrity ensures the SDK hasn't been tampered with during transit. The browser verifies the file hash matches before executing it.
</div>

### NPM

```bash
npm install veilforms
```

Then import in your JavaScript:

```javascript
import VeilForms from 'veilforms';
```

### Yarn

```bash
yarn add veilforms
```

### ES Modules

```javascript
// With SRI verification
const script = document.createElement('script');
script.type = 'module';
script.textContent = `
  import VeilForms from 'https://veilforms.com/js/veilforms-1.0.0.esm.js';
`;
script.integrity = 'sha384-hQ0Lff/lzvzuHG86JRh4P+NgzhDt9ZJE8BmjD44eX0zizRX3YIGoGXrlAieSyj99';
script.crossOrigin = 'anonymous';
document.head.appendChild(script);
```

Or in modern browsers with import maps:

```html
<script type="importmap">
{
  "imports": {
    "veilforms": "https://veilforms.com/js/veilforms-1.0.0.esm.js"
  }
}
</script>
<script type="module">
  import VeilForms from 'veilforms';
</script>
```

## Verify Installation

After installing, verify the SDK is loaded:

```html
<script>
  if (typeof VeilForms !== 'undefined') {
    console.log('VeilForms loaded successfully');
  }
</script>
```

Or in Node.js/bundler environments:

```javascript
import VeilForms from 'veilforms';

if (VeilForms) {
  console.log('VeilForms loaded successfully');
}
```

## Initialize the SDK

After installation, initialize with your form ID and public key:

```javascript
VeilForms.init('vf-abc123', {
  publicKey: 'eyJrdHkiOiJSU0EiLC...', // From your dashboard
  encryption: true,
  piiStrip: true
});
```

<div class="callout info">
<strong>Get your credentials:</strong> Find your Form ID and Public Key in the <a href="/dashboard/">VeilForms Dashboard</a> after creating a form.
</div>

## Bundle Sizes

| Build | Size | Gzipped |
|-------|------|---------|
| IIFE (veilforms.min.js) | 5.4KB | ~2KB |
| ESM (veilforms.esm.js) | 4.9KB | ~2KB |

## Browser Support

The SDK uses the Web Crypto API for encryption:

| Browser | Minimum Version |
|---------|-----------------|
| Chrome | 37+ |
| Firefox | 34+ |
| Safari | 11+ |
| Edge | 12+ |
| iOS Safari | 11+ |
| Chrome Android | 37+ |

### Legacy Browser Support

Browsers without Web Crypto API (IE11, older mobile browsers) are not supported. The SDK requires modern browser features for secure client-side encryption. All major browsers released after 2017 are fully supported.

## Framework Integration

### React

```jsx
import { useEffect } from 'react';
import VeilForms from 'veilforms';

function ContactForm() {
  useEffect(() => {
    VeilForms.init('vf-abc123', {
      publicKey: process.env.REACT_APP_VEILFORMS_PUBLIC_KEY,
      encryption: true,
      autoBind: false // We'll handle submission manually
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);

    try {
      const result = await VeilForms.submit(data);
      console.log('Submitted:', result.submissionId);
    } catch (error) {
      console.error('Failed:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input name="message" required />
      <button type="submit">Send</button>
    </form>
  );
}
```

### Vue

```vue
<template>
  <form @submit.prevent="handleSubmit">
    <input v-model="message" name="message" required />
    <button type="submit">Send</button>
  </form>
</template>

<script>
import VeilForms from 'veilforms';

export default {
  data() {
    return { message: '' };
  },
  mounted() {
    VeilForms.init('vf-abc123', {
      publicKey: process.env.VUE_APP_VEILFORMS_PUBLIC_KEY,
      encryption: true,
      autoBind: false
    });
  },
  methods: {
    async handleSubmit() {
      try {
        const result = await VeilForms.submit({ message: this.message });
        console.log('Submitted:', result.submissionId);
        this.message = '';
      } catch (error) {
        console.error('Failed:', error);
      }
    }
  }
};
</script>
```

### Next.js

```jsx
'use client';

import { useEffect, useState } from 'react';
import VeilForms from 'veilforms';

export default function ContactForm() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    VeilForms.init('vf-abc123', {
      publicKey: process.env.NEXT_PUBLIC_VEILFORMS_PUBLIC_KEY,
      encryption: true,
      autoBind: false
    });
    setReady(true);
  }, []);

  if (!ready) return <div>Loading...</div>;

  return (
    <form data-veilform>
      <input name="feedback" required />
      <button type="submit">Send</button>
    </form>
  );
}
```

### Vanilla JavaScript

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://veilforms.com/js/veilforms.min.js"></script>
</head>
<body>
  <form data-veilform id="contact-form">
    <input name="name" placeholder="Name" required>
    <textarea name="message" placeholder="Message" required></textarea>
    <button type="submit">Send</button>
  </form>

  <script>
    VeilForms.init('vf-abc123', {
      publicKey: 'eyJrdHkiOiJSU0EiLC...',
      encryption: true,
      piiStrip: true
    });

    document.getElementById('contact-form').addEventListener('veilforms:success', (e) => {
      alert('Message sent! ID: ' + e.detail.submissionId);
    });

    document.getElementById('contact-form').addEventListener('veilforms:error', (e) => {
      alert('Error: ' + e.detail.error);
    });
  </script>
</body>
</html>
```

## TypeScript Support

The SDK includes TypeScript definitions:

```typescript
import VeilForms, { VeilFormsConfig, SubmissionResult } from 'veilforms';

const config: VeilFormsConfig = {
  publicKey: process.env.VEILFORMS_PUBLIC_KEY!,
  encryption: true,
  piiStrip: true,
  debug: process.env.NODE_ENV === 'development'
};

VeilForms.init('vf-abc123', config);

async function submitForm(data: Record<string, unknown>): Promise<SubmissionResult> {
  return VeilForms.submit(data);
}
```

## Content Security Policy

If your site uses CSP, add these directives:

```
script-src 'self' https://veilforms.com;
connect-src 'self' https://veilforms.com;
```

## Subresource Integrity (SRI)

### Why Use SRI?

SRI protects your users from:
- **CDN compromises** - Even if our CDN is hacked, tampered scripts won't execute
- **Man-in-the-middle attacks** - Network attackers can't inject malicious code
- **Supply chain attacks** - Browser verifies the exact file you intended to load

### Current SRI Hashes

Always use these integrity hashes when loading from our CDN:

**IIFE Build** (veilforms.min.js):
```html
<script
  src="https://veilforms.com/js/veilforms-1.0.0.min.js"
  integrity="sha384-dxvu/QuhQhLna10DbAj9KnYMewa6zqats5B79Pv+Ae3ef2pfwjRLrRSJ76SEtWMp"
  crossorigin="anonymous">
</script>
```

**ESM Build** (veilforms.esm.js):
```
sha384-hQ0Lff/lzvzuHG86JRh4P+NgzhDt9ZJE8BmjD44eX0zizRX3YIGoGXrlAieSyj99
```

### Self-Hosting: Generate Your Own Hash

If you're self-hosting, generate the SRI hash:

```bash
# For your own domain
curl -s https://forms.yourdomain.com/js/veilforms.min.js | \
  openssl dgst -sha384 -binary | \
  openssl base64 -A

# Local file
openssl dgst -sha384 -binary veilforms.min.js | openssl base64 -A
```

Then use it:

```html
<script
  src="https://forms.yourdomain.com/js/veilforms.min.js"
  integrity="sha384-YOUR_GENERATED_HASH"
  crossorigin="anonymous">
</script>
```

### Hash Updates

SRI hashes change with every SDK release. Check this page or our [GitHub releases](https://github.com/veilforms/veilforms/releases) for the latest hashes.

## Next Steps

- [Configuration](/docs/sdk/configuration/) — All SDK options
- [Quick Start](/docs/quickstart/) — Build your first form
- [Events](/docs/sdk/events/) — Handle form events
