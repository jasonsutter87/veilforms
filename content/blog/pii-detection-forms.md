---
title: "Automatic PII Detection: Stop Collecting Data You Shouldn't"
description: "Learn how automatic PII detection helps identify and protect sensitive data in form submissions. Reduce compliance risk and protect user privacy automatically."
date: 2025-12-01
category: "Privacy"
author: "VeilForms Team"
readTime: 7
tags: ["pii", "privacy", "detection", "compliance"]
type: "blog"
css: ["blog.css"]
---

Users submit sensitive data in forms all the time—sometimes intentionally, sometimes by accident. A "feedback" form might receive Social Security numbers. A "contact" form might get credit card details.

Automatic PII detection helps you identify and protect this data before it becomes a liability.

## What is PII?

Personally Identifiable Information (PII) is any data that could identify a specific individual:

**Direct Identifiers:**
- Full names
- Social Security numbers
- Driver's license numbers
- Passport numbers
- Email addresses
- Phone numbers
- Physical addresses

**Indirect Identifiers:**
- Date of birth
- Place of birth
- Mother's maiden name
- Employment information
- Financial information

**Sensitive PII:**
- Credit card numbers
- Bank account numbers
- Medical information
- Biometric data
- Racial or ethnic origin
- Religious beliefs

## Why Automatic Detection Matters

### 1. Users Submit Unexpected Data

You asked for feedback. They included their SSN "for reference." Now you're storing sensitive data you never wanted.

Real examples:
- Support forms receiving medical histories
- Newsletter signups with full addresses
- Feedback forms with financial complaints including account numbers

### 2. Compliance Requirements

GDPR, CCPA, HIPAA, and other regulations require you to:
- Know what PII you collect
- Minimize data collection
- Protect sensitive data appropriately
- Report breaches involving PII

You can't comply if you don't know what data you have.

### 3. Breach Impact

More PII = bigger breach impact. If you're storing SSNs you don't need, a breach is far more serious than if you only have email addresses.

## How PII Detection Works

Automatic PII detection scans form input for patterns matching sensitive data:

### Email Addresses
```
Pattern: [a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}
Examples: john@example.com, user.name+tag@domain.co.uk
```

### Phone Numbers
```
Patterns:
- (555) 123-4567
- 555-123-4567
- +1 555 123 4567
- 5551234567
```

### Social Security Numbers
```
Pattern: XXX-XX-XXXX or XXXXXXXXX
Examples: 123-45-6789, 123456789
```

### Credit Card Numbers
```
Patterns:
- Visa: 4XXX XXXX XXXX XXXX
- Mastercard: 5XXX XXXX XXXX XXXX
- Amex: 3XXX XXXXXX XXXXX
- Includes Luhn algorithm validation
```

### Addresses
```
Pattern matching for:
- Street addresses (123 Main St)
- ZIP codes (12345, 12345-6789)
- City, State combinations
```

### Dates of Birth
```
Patterns:
- MM/DD/YYYY
- YYYY-MM-DD
- Month DD, YYYY
```

## VeilForms PII Detection

VeilForms includes automatic PII detection in the SDK:

```javascript
// PII detection happens automatically during form submission
// Results are included in the submission metadata

VeilForms.init({
  formId: 'your-form-id',
  publicKey: 'your-public-key',
  piiDetection: {
    enabled: true,
    types: ['email', 'phone', 'ssn', 'creditCard', 'address'],
    action: 'flag' // or 'strip' or 'block'
  }
});
```

### Detection Actions

**Flag**: Mark submissions containing PII for review
```javascript
action: 'flag'
// Submission proceeds, but marked as containing PII
// Dashboard shows PII indicators
```

**Strip**: Remove detected PII before submission
```javascript
action: 'strip'
// PII is replaced with [REDACTED]
// Original data never transmitted
```

**Block**: Prevent submission if PII detected
```javascript
action: 'block'
// Form shows error message
// User must remove sensitive data
```

### Custom Detection Rules

Add custom patterns for industry-specific identifiers:

```javascript
VeilForms.init({
  formId: 'your-form-id',
  publicKey: 'your-public-key',
  piiDetection: {
    enabled: true,
    customPatterns: [
      {
        name: 'patientId',
        pattern: /^MRN-\d{8}$/,
        description: 'Medical Record Number'
      },
      {
        name: 'employeeId',
        pattern: /^EMP\d{6}$/,
        description: 'Employee ID'
      }
    ]
  }
});
```

## Practical Implementation

### Feedback Form with PII Protection

```html
<form data-veilform="feedback" data-pii-action="strip">
  <label for="feedback">Your Feedback</label>
  <textarea id="feedback" name="feedback" rows="6"
            placeholder="Please don't include personal information like SSN or credit card numbers"></textarea>

  <p class="help-text">
    For your protection, sensitive data like SSNs and credit card numbers
    will be automatically removed from submissions.
  </p>

  <button type="submit">Submit Feedback</button>
</form>
```

### Contact Form with PII Flagging

```html
<form data-veilform="contact" data-pii-action="flag">
  <input type="text" name="name" placeholder="Name" required>
  <input type="email" name="email" placeholder="Email" required>
  <textarea name="message" placeholder="Message" required></textarea>
  <button type="submit">Send Message</button>
</form>
```

In your dashboard, submissions with detected PII are highlighted for review.

## Best Practices

### 1. Set Clear Expectations

Tell users what data you need (and don't need):

```html
<p class="form-notice">
  Please don't include sensitive information like Social Security numbers,
  credit card numbers, or passwords in this form.
</p>
```

### 2. Use Appropriate Field Types

Email fields should only accept emails. Phone fields should only accept phone numbers:

```html
<input type="email" name="email" required>
<input type="tel" name="phone" pattern="[0-9]{3}-[0-9]{3}-[0-9]{4}">
```

### 3. Minimize Data Collection

Don't ask for data you don't need. Every field is a potential liability.

### 4. Review Flagged Submissions

Regularly review submissions flagged for PII. Look for patterns:
- Are users consistently submitting SSNs? Maybe they think it's required.
- Are support requests including medical data? Consider a separate HIPAA-compliant form.

### 5. Train Your Team

Ensure everyone handling form data knows:
- What PII looks like
- How to handle unexpected sensitive data
- Incident response procedures

## The Bottom Line

You can't protect data you don't know you have. Automatic PII detection gives you visibility into what sensitive information enters your systems through forms.

Combined with client-side encryption, PII detection provides defense in depth:
1. Detection identifies sensitive data
2. Encryption protects it regardless of sensitivity
3. You maintain compliance even when users submit unexpected data

---

Ready to add PII detection to your forms? [Get started with VeilForms](/register/) or [read the SDK documentation](/docs/sdk/configuration/).
