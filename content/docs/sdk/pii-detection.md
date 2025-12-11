---
title: "PII Detection"
description: "Automatically detect and strip personally identifiable information"
layout: "docs"
---

# PII Detection

VeilForms can automatically detect and optionally strip Personally Identifiable Information (PII) from form submissions before encryption.

## Why PII Detection?

Even with client-side encryption, you might want to:

- **Comply with regulations** — GDPR, CCPA, HIPAA require limiting PII collection
- **Reduce risk** — Less PII stored = less to breach
- **Build trust** — Show users you minimize data collection
- **Prevent accidents** — Catch PII submitted to the wrong form

## Quick Start

Enable PII stripping in your configuration:

```javascript
VeilForms.init('vf-abc123', {
  publicKey: '...',
  piiWarning: true,  // Log warnings (default)
  piiStrip: true     // Strip PII before encryption
});
```

## Detection vs Stripping

### Detection Only (Default)

```javascript
VeilForms.init('vf-abc123', {
  publicKey: '...',
  piiWarning: true,
  piiStrip: false
});
```

Logs warnings to console but submits data unchanged:

```
[VeilForms] PII detected in submission: {
  hasPII: true,
  fields: [{ field: 'email', reason: 'field_name_suggests_pii' }],
  patterns: [{ field: 'comments', type: 'phone' }]
}
```

### Stripping Enabled

```javascript
VeilForms.init('vf-abc123', {
  publicKey: '...',
  piiStrip: true
});
```

Replaces detected PII with `[REDACTED]` before encryption:

```javascript
// Before
{ name: 'John Doe', email: 'john@example.com', feedback: 'Great!' }

// After stripping
{ name: '[REDACTED]', email: '[REDACTED]', feedback: 'Great!' }
```

## Detected PII Types

### Pattern-Based Detection

The SDK scans field values for these patterns:

| Type | Pattern | Examples |
|------|---------|----------|
| Email | `user@domain.com` | john@example.com, info@company.org |
| Phone | US phone numbers | (555) 123-4567, +1-555-123-4567 |
| SSN | Social Security Numbers | 123-45-6789, 123 45 6789 |
| Credit Card | 16-digit card numbers | 4111-1111-1111-1111 |
| IPv4 | IP addresses | 192.168.1.1, 10.0.0.1 |
| IPv6 | IPv6 addresses | 2001:0db8:85a3:0000:... |
| ZIP Code | US ZIP codes | 90210, 12345-6789 |
| Date of Birth | Date patterns | 01/15/1990, 12-25-1985 |

### Field Name Detection

The SDK flags fields with names suggesting PII:

| Category | Field Names |
|----------|-------------|
| Names | name, firstname, lastname, fullname |
| Contact | email, phone, mobile, telephone |
| Identity | ssn, social, socialsecurity |
| Location | address, street, city, state, zip |
| Dates | dob, birthday, birthdate |
| Financial | creditcard, cardnumber, cvv |
| Security | password, pass, pwd |
| Technical | ip, ipaddress |

## Using the Detection API

### Detect PII

```javascript
import { detectPII } from 'veilforms/core/pii';

const formData = {
  feedback: 'Great product!',
  contact: 'Call me at 555-123-4567',
  email: 'user@example.com'
};

const detection = detectPII(formData);
console.log(detection);
// {
//   hasPII: true,
//   fields: [
//     { field: 'email', reason: 'field_name_suggests_pii' }
//   ],
//   patterns: [
//     { field: 'contact', type: 'phone' },
//     { field: 'email', type: 'email' }
//   ]
// }
```

### Strip PII

```javascript
import { stripPII } from 'veilforms/core/pii';

const formData = {
  name: 'John Doe',
  email: 'john@example.com',
  message: 'My SSN is 123-45-6789'
};

const result = stripPII(formData);
console.log(result);
// {
//   data: {
//     name: '[REDACTED]',
//     email: '[REDACTED]',
//     message: 'My SSN is [REDACTED]'
//   },
//   strippedFields: ['name', 'email', 'message'],
//   wasModified: true
// }
```

### Validate No PII

Throw an error if PII is detected:

```javascript
import { validateNoPII } from 'veilforms/core/pii';

try {
  validateNoPII(formData, { strict: true });
} catch (error) {
  if (error.code === 'PII_DETECTED') {
    console.error('PII found:', error.violations);
  }
}
```

## Customization Options

### Custom Redaction Marker

```javascript
const result = stripPII(formData, {
  redactionMarker: '***REMOVED***'
});

// { email: '***REMOVED***' }
```

### Preserve Specific Fields

Allow certain fields to contain PII:

```javascript
const result = stripPII(formData, {
  preserveFields: ['email', 'name']
});

// email and name fields are not redacted
```

### Hash Instead of Redact

Replace PII with hashes for de-duplication:

```javascript
const result = stripPII(formData, {
  hashInsteadOfRedact: true
});

// { email: 'hash:a3f2b8c9d4e5f6a7' }
```

This allows detecting duplicate submissions without storing actual PII.

## Schema-Based Validation

Define allowed PII per field:

```javascript
import { createPIISchema } from 'veilforms/core/pii';

const schema = {
  feedback: { noPII: true },     // No PII allowed
  email: { noPII: false },       // PII allowed (it's an email field)
  rating: { noPII: true }        // No PII allowed
};

const validate = createPIISchema(schema);

const result = validate({
  feedback: 'Great! Email me at john@example.com',
  email: 'john@example.com',
  rating: 5
});

console.log(result);
// {
//   valid: false,
//   errors: ['Field "feedback" contains email but is marked as noPII'],
//   warnings: []
// }
```

## Event Handling

Listen for PII detection events:

```javascript
document.querySelector('form').addEventListener('veilforms:pii', (e) => {
  console.log('PII detected:', e.detail.detection);
  console.log('Was stripped:', e.detail.stripped);

  // Show warning to user
  alert('Some personal information was removed for your privacy.');
});
```

## Form-Level Configuration

Configure PII handling per form:

```html
<!-- Strict - strip all PII -->
<form data-veilform data-veilform-pii="strip">
  <textarea name="feedback"></textarea>
</form>

<!-- Warning only -->
<form data-veilform data-veilform-pii="warn">
  <input name="contact">
</form>

<!-- Allow PII (encrypted anyway) -->
<form data-veilform data-veilform-pii="allow">
  <input name="email" type="email">
</form>
```

## Field-Level Configuration

Mark specific fields as PII-safe:

```html
<form data-veilform>
  <!-- PII checking enabled (default) -->
  <input name="feedback">

  <!-- PII allowed for this field -->
  <input name="email" data-veilform-allow-pii>

  <!-- Force strip PII in this field -->
  <textarea name="comments" data-veilform-strip-pii></textarea>
</form>
```

## Adding Custom Patterns

Extend detection with custom patterns:

```javascript
import { addPIIPattern } from 'veilforms/core/pii';

// Add UK National Insurance number pattern
addPIIPattern('ni_number', /[A-Z]{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-Z]/gi);

// Add custom field names
addPIIFieldNames(['nationalinsurance', 'ni_number', 'nino']);
```

## Limitations

### False Positives

Some patterns may match non-PII:

```javascript
// 555-123-4567 could be a phone OR a product code
// ZIP code 12345 could be a real ZIP OR just a number
```

Use `preserveFields` or field-level configuration to handle these.

### False Negatives

Detection is pattern-based and may miss:

- International phone formats
- Non-standard date formats
- Names in unexpected fields
- PII in encoded/obfuscated form

For sensitive applications, consider manual review alongside automated detection.

### Encrypted Anyway

Remember: even if PII detection fails, the data is still client-side encrypted. PII detection is an additional layer, not the primary protection.

## Best Practices

1. **Default to strict** — Use `piiStrip: true` unless you specifically need PII
2. **Log before production** — Use `piiWarning: true` in development to see what's detected
3. **Preserve intentional fields** — If you need an email field, use `preserveFields`
4. **Inform users** — Let them know PII is being stripped for their protection
5. **Test thoroughly** — Submit test data with various PII patterns

## Next Steps

- [Configuration](/docs/sdk/configuration/) — All SDK options
- [GDPR Compliance](/docs/guides/gdpr/) — Using PII detection for compliance
- [Encryption](/docs/sdk/encryption/) — How data is encrypted
