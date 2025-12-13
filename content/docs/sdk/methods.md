---
title: "SDK Methods Reference"
description: "Complete reference for all VeilForms SDK methods"
type: "pages"
layout: "docs"
css: ["docs.css"]
---

# SDK Methods Reference

Complete reference for all VeilForms SDK methods and utilities.

## Core Methods

### VeilForms.init(formId, options)

Initialize the SDK with your form ID and configuration.

```javascript
VeilForms.init('vf-abc123', {
  publicKey: 'eyJrdHkiOiJSU0EiLC...',
  encryption: true,
  piiStrip: true,
  debug: false
});
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `formId` | string | Yes | Your form ID from the dashboard |
| `options` | object | No | Configuration options |

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `publicKey` | string | `null` | RSA public key for encryption (JWK format) |
| `endpoint` | string | `https://veilforms.com/api/submit` | Submission endpoint URL |
| `encryption` | boolean | `true` | Enable client-side encryption |
| `piiWarning` | boolean | `true` | Log warnings when PII detected |
| `piiStrip` | boolean | `false` | Strip detected PII before submission |
| `autoBind` | boolean | `true` | Auto-bind forms with `data-veilform` attribute |
| `debug` | boolean | `false` | Enable debug logging |

**Returns:** `void`

**Example:**

```javascript
// Minimal initialization
VeilForms.init('vf-abc123', {
  publicKey: 'eyJrdHkiOiJSU0EiLC...'
});

// Full configuration
VeilForms.init('vf-abc123', {
  publicKey: 'eyJrdHkiOiJSU0EiLC...',
  endpoint: 'https://forms.yourdomain.com/api/submit',
  encryption: true,
  piiWarning: true,
  piiStrip: true,
  autoBind: true,
  debug: process.env.NODE_ENV === 'development'
});
```

---
priority: 0.5

### VeilForms.submit(data, options)

Submit form data programmatically.

```javascript
const result = await VeilForms.submit({
  name: 'John Doe',
  message: 'Hello world'
});
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `data` | object | Yes | Form data to submit |
| `options` | object | No | Submission options |

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `formElement` | HTMLFormElement | `null` | Form element for event dispatching |

**Returns:** `Promise<SubmissionResult>`

```typescript
interface SubmissionResult {
  success: boolean;
  submissionId: string;
  timestamp: number;
}
```

**Example:**

```javascript
// Basic submission
try {
  const result = await VeilForms.submit({
    email: 'user@example.com',
    feedback: 'Great product!'
  });
  console.log('Submitted:', result.submissionId);
} catch (error) {
  console.error('Failed:', error.message);
}

// With form element for events
const form = document.getElementById('contact-form');
const result = await VeilForms.submit(
  { name: 'John', message: 'Hello' },
  { formElement: form }
);
// Events will dispatch on the form element
```

**Errors:**

| Error | Cause |
|-------|-------|
| `VeilForms not initialized` | Call `init()` before `submit()` |
| `Submission failed: 400` | Invalid form data |
| `Submission failed: 401` | Invalid API key |
| `Submission failed: 429` | Rate limit exceeded |

---
priority: 0.5

### VeilForms.track(event, data)

Track a custom event (like form views, interactions).

```javascript
await VeilForms.track('form_viewed', {
  page: '/contact',
  referrer: document.referrer
});
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `event` | string | Yes | Event name |
| `data` | object | No | Event data |

**Returns:** `Promise<SubmissionResult>`

**Example:**

```javascript
// Track form view
VeilForms.track('form_impression', {
  formName: 'Contact Form',
  pageUrl: window.location.href
});

// Track field interaction
document.querySelector('input[name="email"]').addEventListener('focus', () => {
  VeilForms.track('field_focused', { field: 'email' });
});

// Track form abandonment
window.addEventListener('beforeunload', () => {
  if (formHasData && !formSubmitted) {
    VeilForms.track('form_abandoned', {
      fieldsCompleted: getCompletedFields()
    });
  }
});
```

---
priority: 0.5

### VeilForms.bindForms()

Manually bind forms with `data-veilform` attribute. Useful when forms are added dynamically.

```javascript
VeilForms.bindForms();
```

**Parameters:** None

**Returns:** `void`

**Example:**

```javascript
// Initialize without auto-binding
VeilForms.init('vf-abc123', {
  publicKey: '...',
  autoBind: false
});

// Later, after forms are added to DOM
document.body.innerHTML += `
  <form data-veilform>
    <input name="message">
    <button type="submit">Send</button>
  </form>
`;

// Manually bind
VeilForms.bindForms();
```

---
priority: 0.5

## Utility Methods

Utility methods are available under `VeilForms.utils`.

### VeilForms.utils.collectFormData(form)

Extract form data as a plain object.

```javascript
const form = document.getElementById('my-form');
const data = VeilForms.utils.collectFormData(form);
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `form` | HTMLFormElement | Yes | Form element to collect data from |

**Returns:** `object` - Form data as key-value pairs

**Example:**

```javascript
const form = document.querySelector('form');
const data = VeilForms.utils.collectFormData(form);

console.log(data);
// { name: 'John', email: 'john@example.com', colors: ['red', 'blue'] }

// Multi-value fields (checkboxes, multi-select) become arrays
```

---
priority: 0.5

### VeilForms.utils.hashField(value, salt)

Hash a field value for de-duplication without storing PII.

```javascript
const hash = await VeilForms.utils.hashField('user@example.com', 'my-salt');
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `value` | string | Yes | Value to hash |
| `salt` | string | No | Optional salt for uniqueness (default: `''`) |

**Returns:** `Promise<string>` - Base64-encoded SHA-256 hash

**Example:**

```javascript
// Hash an email for duplicate detection
const emailHash = await VeilForms.utils.hashField(
  'john@example.com',
  'contact-form-2024'
);

// Same input + salt = same output
const hash1 = await VeilForms.utils.hashField('test@test.com', 'salt');
const hash2 = await VeilForms.utils.hashField('test@test.com', 'salt');
console.log(hash1 === hash2); // true

// Different salt = different output
const hash3 = await VeilForms.utils.hashField('test@test.com', 'other');
console.log(hash1 === hash3); // false

// Use case: check for duplicate submissions
const submissions = await fetchSubmissions();
const newEmailHash = await VeilForms.utils.hashField(email, formId);
const isDuplicate = submissions.some(s => s.emailHash === newEmailHash);
```

---
priority: 0.5

### VeilForms.utils.detectPII(data)

Detect personally identifiable information in form data.

```javascript
const detection = VeilForms.utils.detectPII({
  name: 'John Doe',
  message: 'Email me at john@example.com'
});
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `data` | object | Yes | Form data to analyze |

**Returns:** `PIIDetectionResult`

```typescript
interface PIIDetectionResult {
  hasPII: boolean;
  fields: Array<{
    field: string;
    reason: string;
  }>;
  patterns: Array<{
    field: string;
    type: string;
  }>;
}
```

**Detected PII Types:**

| Type | Pattern Examples |
|------|-----------------|
| `email` | user@example.com |
| `phone` | 555-123-4567, (555) 123-4567 |
| `ssn` | 123-45-6789 |
| `creditCard` | 4111-1111-1111-1111 |
| `ipv4` | 192.168.1.1 |
| `ipv6` | 2001:0db8:85a3::8a2e:0370:7334 |
| `zipCode` | 12345, 12345-6789 |
| `dob` | 01/15/1990, 1-15-1990 |

**Detected Field Names:**

Fields with names like `email`, `name`, `phone`, `ssn`, `address`, `password`, etc. are flagged.

**Example:**

```javascript
const data = {
  name: 'John Doe',
  feedback: 'Contact me at john@example.com or 555-123-4567',
  rating: 5
};

const result = VeilForms.utils.detectPII(data);

console.log(result);
// {
//   hasPII: true,
//   fields: [
//     { field: 'name', reason: 'field_name_suggests_pii' }
//   ],
//   patterns: [
//     { field: 'feedback', type: 'email' },
//     { field: 'feedback', type: 'phone' }
//   ]
// }

// Use for validation
if (result.hasPII && !userConsented) {
  showPIIWarning(result.patterns);
}
```

---
priority: 0.5

## TypeScript Definitions

```typescript
declare namespace VeilForms {
  interface Config {
    publicKey?: string;
    endpoint?: string;
    encryption?: boolean;
    piiWarning?: boolean;
    piiStrip?: boolean;
    autoBind?: boolean;
    debug?: boolean;
  }

  interface SubmissionResult {
    success: boolean;
    submissionId: string;
    timestamp: number;
  }

  interface SubmitOptions {
    formElement?: HTMLFormElement;
  }

  interface PIIDetectionResult {
    hasPII: boolean;
    fields: Array<{ field: string; reason: string }>;
    patterns: Array<{ field: string; type: string }>;
  }

  function init(formId: string, config?: Config): void;
  function submit(data: Record<string, unknown>, options?: SubmitOptions): Promise<SubmissionResult>;
  function track(event: string, data?: Record<string, unknown>): Promise<SubmissionResult>;
  function bindForms(): void;

  namespace utils {
    function collectFormData(form: HTMLFormElement): Record<string, unknown>;
    function hashField(value: string, salt?: string): Promise<string>;
    function detectPII(data: Record<string, unknown>): PIIDetectionResult;
  }
}

export default VeilForms;
```

---
priority: 0.5

## Method Comparison

| Method | Purpose | Async | Requires Init |
|--------|---------|-------|---------------|
| `init` | Configure SDK | No | No |
| `submit` | Send form data | Yes | Yes |
| `track` | Send event data | Yes | Yes |
| `bindForms` | Bind form elements | No | Yes |
| `utils.collectFormData` | Extract form values | No | No |
| `utils.hashField` | Hash a value | Yes | No |
| `utils.detectPII` | Detect PII | No | No |

## Next Steps

- [Configuration](/docs/sdk/configuration/) — All configuration options
- [Events](/docs/sdk/events/) — Handle form events
- [Encryption](/docs/sdk/encryption/) — How encryption works
