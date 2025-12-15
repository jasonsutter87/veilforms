# Idempotency Keys - Client Integration Guide

## What is an Idempotency Key?

An idempotency key is a unique identifier you send with your form submission to ensure it's only processed once, even if you retry the request multiple times.

## Why Use Idempotency Keys?

Idempotency keys prevent duplicate submissions in these scenarios:

1. **Network timeouts**: Your request times out, so you retry it
2. **Double-clicks**: User clicks submit button twice
3. **Browser back/forward**: User navigates away and returns
4. **API retries**: Automatic retry logic in your app

## How It Works

```
First Request (with key "abc123"):
  Client -> [POST /api/submit + X-Idempotency-Key: abc123] -> Server
  Server: "New submission, processing..."
  Server -> [200 OK + stores submission] -> Client

Second Request (same key "abc123"):
  Client -> [POST /api/submit + X-Idempotency-Key: abc123] -> Server
  Server: "Already seen this key, returning cached response"
  Server -> [200 OK + X-Idempotent-Replay: true] -> Client
```

## JavaScript/TypeScript Implementation

### Basic Example

```javascript
import { randomUUID } from 'crypto';

async function submitForm(formData) {
  // Generate unique idempotency key
  const idempotencyKey = randomUUID();

  const response = await fetch('https://api.veilforms.com/submit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey
    },
    body: JSON.stringify({
      formId: 'vf_abc123',
      submissionId: randomUUID(),
      payload: formData,
      timestamp: Date.now()
    })
  });

  return response.json();
}
```

### With Retry Logic

```javascript
async function submitFormWithRetry(formData, maxRetries = 3) {
  const idempotencyKey = randomUUID();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch('https://api.veilforms.com/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify({
          formId: 'vf_abc123',
          submissionId: randomUUID(),
          payload: formData,
          timestamp: Date.now()
        }),
        signal: AbortSignal.timeout(10000) // 10s timeout
      });

      const data = await response.json();

      // Check if this was a cached response
      if (response.headers.get('X-Idempotent-Replay') === 'true') {
        console.log('Duplicate submission detected - using cached response');
      }

      return data;

    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }

      // Wait before retry (exponential backoff)
      await new Promise(resolve =>
        setTimeout(resolve, Math.pow(2, attempt) * 1000)
      );
    }
  }
}
```

### React Hook Example

```typescript
import { useState } from 'react';
import { randomUUID } from 'crypto';

interface FormSubmission {
  formId: string;
  data: Record<string, any>;
}

export function useFormSubmission() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isDuplicate, setIsDuplicate] = useState(false);

  const submitForm = async (submission: FormSubmission) => {
    setSubmitting(true);
    setError(null);
    setIsDuplicate(false);

    // Generate idempotency key
    const idempotencyKey = randomUUID();

    try {
      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify({
          formId: submission.formId,
          submissionId: randomUUID(),
          payload: submission.data,
          timestamp: Date.now()
        })
      });

      if (!response.ok) {
        throw new Error(`Submission failed: ${response.statusText}`);
      }

      const data = await response.json();

      // Check if duplicate
      if (response.headers.get('X-Idempotent-Replay') === 'true') {
        setIsDuplicate(true);
      }

      return data;

    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  return { submitForm, submitting, error, isDuplicate };
}
```

### Vue Composition API Example

```typescript
import { ref } from 'vue';
import { randomUUID } from 'crypto';

export function useFormSubmission() {
  const submitting = ref(false);
  const error = ref<Error | null>(null);
  const isDuplicate = ref(false);

  const submitForm = async (formId: string, data: Record<string, any>) => {
    submitting.value = true;
    error.value = null;
    isDuplicate.value = false;

    const idempotencyKey = randomUUID();

    try {
      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify({
          formId,
          submissionId: randomUUID(),
          payload: data,
          timestamp: Date.now()
        })
      });

      if (!response.ok) {
        throw new Error(`Submission failed: ${response.statusText}`);
      }

      const result = await response.json();

      if (response.headers.get('X-Idempotent-Replay') === 'true') {
        isDuplicate.value = true;
      }

      return result;

    } catch (err) {
      error.value = err as Error;
      throw err;
    } finally {
      submitting.value = false;
    }
  };

  return { submitForm, submitting, error, isDuplicate };
}
```

## Node.js Backend Example

```javascript
const crypto = require('crypto');

async function submitToVeilForms(formId, data) {
  const idempotencyKey = crypto.randomUUID();

  const response = await fetch('https://api.veilforms.com/submit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey
    },
    body: JSON.stringify({
      formId,
      submissionId: crypto.randomUUID(),
      payload: data,
      timestamp: Date.now()
    })
  });

  const result = await response.json();

  // Log if duplicate
  if (response.headers.get('x-idempotent-replay') === 'true') {
    console.log('Duplicate submission detected');
  }

  return result;
}
```

## Best Practices

### 1. Generate Keys Properly

✅ **Good** - Use cryptographically secure random UUIDs:
```javascript
const key = crypto.randomUUID();
```

❌ **Bad** - Using timestamps or predictable values:
```javascript
const key = Date.now().toString(); // DON'T DO THIS
```

### 2. Store Keys Temporarily

If you need to retry, store the key:

```javascript
// Store key in localStorage for retry after page reload
const idempotencyKey = crypto.randomUUID();
sessionStorage.setItem('last-idempotency-key', idempotencyKey);

// On retry
const key = sessionStorage.getItem('last-idempotency-key');
```

### 3. Clear Keys After Success

```javascript
const key = crypto.randomUUID();

try {
  const result = await submitForm(key, data);

  // Clear stored key after success
  sessionStorage.removeItem('last-idempotency-key');

  return result;
} catch (error) {
  // Keep key for retry
  sessionStorage.setItem('last-idempotency-key', key);
  throw error;
}
```

### 4. Handle Cached Responses

```javascript
const response = await fetch('/api/submit', {
  headers: {
    'X-Idempotency-Key': idempotencyKey
  },
  // ...
});

if (response.headers.get('X-Idempotent-Replay') === 'true') {
  // This is a cached response
  const age = response.headers.get('X-Idempotency-Age'); // seconds
  console.log(`Cached response from ${age} seconds ago`);

  // Show user a different message
  showMessage('Your submission was already processed');
} else {
  // New submission
  showMessage('Thank you for your submission!');
}
```

## Response Headers

When a duplicate is detected, the server returns these headers:

```
X-Idempotent-Replay: true
X-Idempotency-Age: 45
X-Idempotency-Created: 2025-12-13T14:30:00Z
```

- `X-Idempotent-Replay`: Always "true" for duplicates
- `X-Idempotency-Age`: How long ago (in seconds) the original request was made
- `X-Idempotency-Created`: ISO timestamp of original request

## Key Format Requirements

- **Length**: 16-128 characters
- **Characters**: Alphanumeric, dashes (`-`), underscores (`_`)
- **Valid**: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`
- **Invalid**: `abc!@#$%^&*()`

## Error Handling

### Invalid Key Format

```json
{
  "error": "Invalid idempotency key format. Must be 16-128 alphanumeric characters, dashes, or underscores.",
  "code": "INVALID_IDEMPOTENCY_KEY"
}
```

**Solution**: Ensure your key meets the format requirements.

### Key Expired

Keys expire after 24 hours. If you retry with an expired key, it will be processed as a new submission.

## FAQ

### Do I have to use idempotency keys?

No, they're optional. If you don't include the `X-Idempotency-Key` header, submissions are processed normally.

### What happens after 24 hours?

Keys expire after 24 hours. After expiration, using the same key will create a new submission.

### Can I use the same key for different forms?

Yes, keys are scoped by form ID. The same key can be used for submissions to different forms.

### What if my key is too short?

Keys must be at least 16 characters. Use `crypto.randomUUID()` which generates 36-character UUIDs.

### Can I use sequential numbers?

Technically yes, but it's **not recommended**. Use UUIDs for better security and uniqueness.

### How do I test idempotency?

```javascript
const key = 'test-key-' + crypto.randomUUID();

// First request
await submitForm(key, data);

// Second request with same key - should get cached response
await submitForm(key, data);
```

## Browser Support

The `crypto.randomUUID()` API is supported in:
- Chrome 92+
- Firefox 95+
- Safari 15.4+
- Edge 92+

For older browsers, use a polyfill:

```javascript
// Polyfill for older browsers
if (!crypto.randomUUID) {
  crypto.randomUUID = function() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };
}
```

## Integration with VeilForms SDK

If using the official VeilForms SDK, idempotency is handled automatically:

```javascript
import VeilForms from '@veilforms/sdk';

const vf = new VeilForms({
  formId: 'vf_abc123',
  publicKey: '...',
  // Enable automatic idempotency
  idempotency: true
});

// SDK automatically generates and manages idempotency keys
await vf.submit(formData);
```
