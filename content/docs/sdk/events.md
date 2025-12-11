---
title: "Events"
description: "Handle VeilForms events for success, error, and lifecycle callbacks"
layout: "docs"
---

# Events

VeilForms dispatches events throughout the form lifecycle. Use these to build custom UI feedback, analytics, and error handling.

## Event Types

| Event | When Fired | Detail |
|-------|------------|--------|
| `veilforms:success` | Submission succeeded | `{ submissionId, timestamp }` |
| `veilforms:error` | Submission failed | `{ error }` |
| `veilforms:submit` | Before submission starts | `{ formData }` |
| `veilforms:encrypt` | After encryption completes | `{ encrypted }` |
| `veilforms:pii` | PII detected | `{ detection, stripped }` |

## Basic Usage

### Success Event

```javascript
document.querySelector('form').addEventListener('veilforms:success', (e) => {
  console.log('Submission ID:', e.detail.submissionId);
  console.log('Timestamp:', e.detail.timestamp);

  // Show success message
  alert('Thank you! Your submission was received.');

  // Redirect
  window.location.href = '/thank-you';
});
```

### Error Event

```javascript
document.querySelector('form').addEventListener('veilforms:error', (e) => {
  console.error('Submission failed:', e.detail.error);

  // Show error to user
  const errorDiv = document.querySelector('.error-message');
  errorDiv.textContent = 'Something went wrong. Please try again.';
  errorDiv.style.display = 'block';
});
```

## All Events

### veilforms:submit

Fires before submission begins. Cancel to prevent submission:

```javascript
form.addEventListener('veilforms:submit', (e) => {
  console.log('Submitting:', e.detail.formData);

  // Validate custom fields
  if (!e.detail.formData.terms) {
    e.preventDefault();
    alert('Please accept the terms');
    return;
  }

  // Show loading state
  form.querySelector('button').textContent = 'Sending...';
  form.querySelector('button').disabled = true;
});
```

### veilforms:encrypt

Fires after client-side encryption completes:

```javascript
form.addEventListener('veilforms:encrypt', (e) => {
  console.log('Encrypted payload ready');
  console.log('Encryption version:', e.detail.encrypted.version);

  // Useful for debugging
  if (VeilForms.config.debug) {
    console.log('Payload size:', JSON.stringify(e.detail.encrypted).length);
  }
});
```

### veilforms:pii

Fires when PII is detected (regardless of stripping):

```javascript
form.addEventListener('veilforms:pii', (e) => {
  console.log('PII detection:', e.detail.detection);
  console.log('Fields affected:', e.detail.detection.fields);
  console.log('Patterns found:', e.detail.detection.patterns);
  console.log('Was stripped:', e.detail.stripped);

  // Notify user if PII was removed
  if (e.detail.stripped) {
    showNotification('Some personal info was removed for your privacy.');
  }
});
```

### veilforms:success

Fires after successful submission:

```javascript
form.addEventListener('veilforms:success', (e) => {
  const { submissionId, timestamp } = e.detail;

  // Reset loading state
  form.querySelector('button').textContent = 'Send';
  form.querySelector('button').disabled = false;

  // Track analytics
  analytics.track('form_submitted', {
    formId: VeilForms.config.formId,
    submissionId
  });

  // Show success UI
  form.innerHTML = `
    <div class="success">
      <h3>Thank you!</h3>
      <p>Reference: ${submissionId}</p>
    </div>
  `;
});
```

### veilforms:error

Fires on submission failure:

```javascript
form.addEventListener('veilforms:error', (e) => {
  const { error } = e.detail;

  // Reset loading state
  form.querySelector('button').textContent = 'Send';
  form.querySelector('button').disabled = false;

  // Handle specific errors
  if (error.includes('network')) {
    showError('Network error. Please check your connection.');
  } else if (error.includes('rate')) {
    showError('Too many submissions. Please wait a moment.');
  } else {
    showError('Something went wrong. Please try again.');
  }

  // Log for debugging
  console.error('VeilForms error:', error);
});
```

## Event Flow

```
User clicks submit
        │
        ▼
  veilforms:submit    ◄── Cancel here to prevent submission
        │
        ▼
    PII Detection
        │
        ▼
   veilforms:pii      ◄── Only if PII detected
        │
        ▼
     Encryption
        │
        ▼
  veilforms:encrypt   ◄── Payload ready
        │
        ▼
    Send to API
        │
        ├───► Success ──► veilforms:success
        │
        └───► Failure ──► veilforms:error
```

## Global Event Handling

Listen to all forms at once:

```javascript
document.addEventListener('veilforms:success', (e) => {
  // Handle any VeilForms submission
  console.log('A form was submitted:', e.target.id);
});
```

## React Integration

```jsx
import { useEffect, useRef } from 'react';
import VeilForms from 'veilforms';

function ContactForm() {
  const formRef = useRef(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);

  useEffect(() => {
    VeilForms.init('vf-abc123', {
      publicKey: process.env.REACT_APP_VEILFORMS_PUBLIC_KEY
    });

    const form = formRef.current;

    const handleSuccess = (e) => {
      setStatus('success');
      console.log('ID:', e.detail.submissionId);
    };

    const handleError = (e) => {
      setStatus('error');
      setError(e.detail.error);
    };

    form.addEventListener('veilforms:success', handleSuccess);
    form.addEventListener('veilforms:error', handleError);

    return () => {
      form.removeEventListener('veilforms:success', handleSuccess);
      form.removeEventListener('veilforms:error', handleError);
    };
  }, []);

  if (status === 'success') {
    return <div>Thank you for your submission!</div>;
  }

  return (
    <form ref={formRef} data-veilform>
      <input name="message" required />
      <button type="submit" disabled={status === 'submitting'}>
        {status === 'submitting' ? 'Sending...' : 'Send'}
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
```

## Vue Integration

```vue
<template>
  <form ref="form" data-veilform @veilforms:success="onSuccess" @veilforms:error="onError">
    <input v-model="message" name="message" required />
    <button type="submit" :disabled="submitting">
      {{ submitting ? 'Sending...' : 'Send' }}
    </button>
    <p v-if="error" class="error">{{ error }}</p>
  </form>
</template>

<script>
import VeilForms from 'veilforms';

export default {
  data() {
    return {
      message: '',
      submitting: false,
      error: null
    };
  },
  mounted() {
    VeilForms.init('vf-abc123', {
      publicKey: process.env.VUE_APP_VEILFORMS_PUBLIC_KEY
    });
  },
  methods: {
    onSuccess(e) {
      this.submitting = false;
      this.message = '';
      alert(`Submitted! ID: ${e.detail.submissionId}`);
    },
    onError(e) {
      this.submitting = false;
      this.error = e.detail.error;
    }
  }
};
</script>
```

## Custom Events

Dispatch your own events for extensibility:

```javascript
// In your code
form.addEventListener('veilforms:success', (e) => {
  // Dispatch custom event for other parts of your app
  const customEvent = new CustomEvent('app:formSubmitted', {
    detail: {
      formId: VeilForms.config.formId,
      submissionId: e.detail.submissionId
    }
  });
  document.dispatchEvent(customEvent);
});

// Listen elsewhere
document.addEventListener('app:formSubmitted', (e) => {
  // Update UI, sync state, etc.
});
```

## Debugging Events

Enable debug mode to log all events:

```javascript
VeilForms.init('vf-abc123', {
  publicKey: '...',
  debug: true
});

// Console shows:
// [VeilForms] Event: veilforms:submit { formData: {...} }
// [VeilForms] Event: veilforms:encrypt { encrypted: {...} }
// [VeilForms] Event: veilforms:success { submissionId: 'vf-xyz789' }
```

## Event Bubbling

All VeilForms events bubble up the DOM:

```html
<div id="form-container">
  <form data-veilform>
    <!-- ... -->
  </form>
</div>

<script>
  // Listen on parent
  document.getElementById('form-container').addEventListener('veilforms:success', (e) => {
    console.log('Caught bubbled event from:', e.target);
  });
</script>
```

## Preventing Default

Cancel submission in the `veilforms:submit` event:

```javascript
form.addEventListener('veilforms:submit', (e) => {
  if (!customValidation(e.detail.formData)) {
    e.preventDefault();
    showValidationErrors();
  }
});
```

<div class="callout warning">
<strong>Note:</strong> Only <code>veilforms:submit</code> is cancelable. Other events are informational.
</div>

## Next Steps

- [Configuration](/docs/sdk/configuration/) — SDK options
- [Quick Start](/docs/quickstart/) — Build your first form
- [API Reference](/docs/api/submissions/) — Server-side integration
