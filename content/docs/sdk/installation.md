---
title: "SDK Installation"
description: "Install the VeilForms SDK in your project"
layout: "docs"
---

# SDK Installation

Install the VeilForms SDK to add client-side encrypted forms to your website or application.

## Installation Methods

### CDN (Recommended for Quick Start)

Add the script tag to your HTML:

```html
<script src="https://veilforms.com/js/veilforms.min.js"></script>
```

The SDK is ~8KB gzipped and has no dependencies.

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
import VeilForms from 'https://veilforms.com/js/veilforms.esm.js';
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
console.log('VeilForms version:', VeilForms.version);
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
<strong>Get your credentials:</strong> Find your Form ID and Public Key in the <a href="https://veilforms.com/dashboard">VeilForms Dashboard</a> after creating a form.
</div>

## Bundle Sizes

| Build | Size | Gzipped |
|-------|------|---------|
| UMD (veilforms.min.js) | 24KB | 8KB |
| ESM (veilforms.esm.js) | 22KB | 7KB |
| CommonJS | 23KB | 8KB |

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

For browsers without Web Crypto API support, include the polyfill:

```html
<script src="https://veilforms.com/js/veilforms-legacy.min.js"></script>
```

This adds ~15KB but provides identical functionality and security.

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

## Subresource Integrity

For extra security, use SRI:

```html
<script
  src="https://veilforms.com/js/veilforms.min.js"
  integrity="sha384-..."
  crossorigin="anonymous">
</script>
```

Get the current SRI hash from [veilforms.com/integrity](https://veilforms.com/integrity).

## Next Steps

- [Configuration](/docs/sdk/configuration/) — All SDK options
- [Quick Start](/docs/quickstart/) — Build your first form
- [Events](/docs/sdk/events/) — Handle form events
