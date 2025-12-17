---
title: "GDPR Compliance"
description: "Using VeilForms for GDPR-compliant data collection"
type: "pages"
layout: "docs"
css: ["docs.css"]
priority: 0.5
---

# GDPR Compliance

VeilForms is designed with privacy-by-design principles that align with GDPR requirements. This guide explains how to use VeilForms for compliant data collection.

<div class="callout info">
<strong>Not Legal Advice:</strong> This guide provides technical information, not legal advice. Consult a qualified attorney for compliance guidance specific to your situation.
</div>

## GDPR Overview

The General Data Protection Regulation (GDPR) requires:

1. **Lawful basis** for processing personal data
2. **Data minimization** — collect only what's necessary
3. **Purpose limitation** — use data only for stated purposes
4. **Storage limitation** — don't keep data longer than needed
5. **Security** — protect data with appropriate measures
6. **Rights** — allow access, correction, deletion, portability

## How VeilForms Helps

### Data Minimization

**PII Stripping** automatically removes unnecessary personal data:

```javascript
VeilForms.init('vf-abc123', {
  publicKey: '...',
  piiStrip: true  // Removes emails, phones, etc.
});
```

Only collect what you need:

```html
<!-- Bad: Collecting unnecessary data -->
<form data-veilform>
  <input name="name" required>
  <input name="email" required>
  <input name="phone" required>
  <input name="address" required>
  <textarea name="feedback" required></textarea>
</form>

<!-- Good: Minimal collection -->
<form data-veilform>
  <textarea name="feedback" required></textarea>
</form>
```

### Encryption as Security Measure

Client-side encryption provides strong technical protection:

```
User Data → Browser Encrypts → Ciphertext → Storage
                    ↑
            GDPR Article 32: "encryption of personal data"
```

Even in a breach, encrypted data remains protected.

### No Cross-Border Transfer Concerns

When using VeilForms:
- We store encrypted blobs
- We cannot read the data
- Standard Contractual Clauses may not be necessary for encrypted data

Consult your legal team, but encryption significantly reduces transfer risks.

## Configuring for GDPR

### Maximum Privacy Configuration

```javascript
VeilForms.init('vf-abc123', {
  publicKey: '...',
  encryption: true,    // Always encrypt
  piiStrip: true,      // Strip detected PII
  piiWarning: true     // Log warnings for audit
});
```

### Consent Collection

Collect explicit consent before form submission:

```html
<form data-veilform>
  <textarea name="feedback" required></textarea>

  <label>
    <input type="checkbox" name="consent" required>
    I consent to the processing of my feedback as described in the
    <a href="/privacy-policy">Privacy Policy</a>.
  </label>

  <button type="submit">Submit</button>
</form>

<script>
  VeilForms.init('vf-abc123', {
    publicKey: '...',
    encryption: true
  });

  document.querySelector('form').addEventListener('veilforms:submit', (e) => {
    if (!e.detail.formData.consent) {
      e.preventDefault();
      alert('Please provide consent to submit.');
    }
  });
</script>
```

### Privacy Policy Requirements

Your privacy policy should explain:

1. **What data you collect** (even if encrypted)
2. **How encryption works** (client-side, you hold keys)
3. **Data retention period**
4. **How to exercise rights** (access, deletion, etc.)

Example clause:

> "Form submissions are encrypted in your browser before transmission using RSA-2048 and AES-256 encryption. Only we can decrypt this data using our private key. VeilForms, our form processor, never has access to your unencrypted data."

## Data Subject Rights

### Right of Access (Article 15)

Export and decrypt submissions for the data subject:

```javascript
// Fetch all submissions
const response = await fetch(
  'https://veilforms.com/api/submissions/export?formId=vf-abc123',
  { headers: { 'Authorization': 'Bearer vf_live_xxx' } }
);
const { submissions } = await response.json();

// Decrypt each submission
const decryptedData = await Promise.all(
  submissions.map(s => decryptSubmission(s.payload, privateKey))
);

// Filter by data subject (you need a way to identify them)
const subjectData = decryptedData.filter(d => d.email === 'user@example.com');
```

### Right to Erasure (Article 17)

Delete specific submissions:

```bash
curl -X DELETE "https://veilforms.com/api/submissions/vf-xyz789?formId=vf-abc123" \
  -H "Authorization: Bearer vf_live_xxx"
```

Or purge all submissions:

```bash
curl -X DELETE "https://veilforms.com/api/submissions?formId=vf-abc123&confirm=DELETE_ALL_SUBMISSIONS" \
  -H "Authorization: Bearer vf_live_xxx"
```

### Right to Rectification (Article 16)

VeilForms stores immutable encrypted blobs. To rectify:

1. Delete the incorrect submission
2. Have the user submit corrected data
3. Document the correction

### Right to Data Portability (Article 20)

Export submissions in machine-readable format:

```bash
curl "https://veilforms.com/api/submissions/export?formId=vf-abc123&format=json" \
  -H "Authorization: Bearer vf_live_xxx"
```

Then decrypt and provide to the data subject.

## Data Retention

### Automatic Deletion

Set up automatic deletion after a retention period:

```bash
curl -X PATCH https://veilforms.com/api/forms/vf-abc123 \
  -H "Authorization: Bearer vf_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "settings": {
      "retentionDays": 90
    }
  }'
```

Submissions older than 90 days are automatically deleted.

### Manual Cleanup

Regularly review and delete unnecessary data:

```javascript
// Delete submissions older than 6 months
const sixMonthsAgo = Date.now() - (180 * 24 * 60 * 60 * 1000);

const { submissions } = await fetchSubmissions(formId);

for (const sub of submissions) {
  if (sub.timestamp < sixMonthsAgo) {
    await deleteSubmission(formId, sub.submissionId);
  }
}
```

## Records of Processing

Maintain records as required by Article 30:

| Field | Value |
|-------|-------|
| Controller | Your organization |
| Processor | VeilForms (for storage only) |
| Purpose | [Your stated purpose] |
| Data categories | [Form fields collected] |
| Recipients | Only you (data is encrypted) |
| Retention | [Your retention period] |
| Security measures | Client-side encryption (RSA-2048 + AES-256) |

## Data Processing Agreement

VeilForms acts as a processor under GDPR. Key points:

- **We process encrypted data only**
- **We cannot access plaintext**
- **We follow your deletion instructions**
- **We don't share data with third parties**

Request a DPA at [legal@veilforms.com](mailto:legal@veilforms.com).

## Breach Notification

In case of a breach at VeilForms:

1. **We notify you** within 72 hours
2. **Impact is limited** — data is encrypted
3. **You assess** whether notification to authorities/subjects is required

Because data is client-side encrypted, a breach of our systems exposes only ciphertext. Depending on your legal assessment, this may not constitute a "personal data breach" under Article 4(12).

## Audit Trail

Enable logging for compliance audits:

```javascript
VeilForms.init('vf-abc123', {
  publicKey: '...',
  piiWarning: true,  // Logs PII detection
  debug: true        // Full audit trail (disable in production)
});

// Server-side: log webhook events
app.post('/webhook', (req, res) => {
  const event = req.body;

  // Log for audit (without decrypted content)
  auditLog.write({
    event: event.event,
    formId: event.form.id,
    submissionId: event.submission?.id,
    timestamp: new Date().toISOString()
  });

  res.status(200).send('OK');
});
```

## GDPR Checklist

Use this checklist for GDPR compliance:

- [ ] **Lawful basis identified** (consent, legitimate interest, etc.)
- [ ] **Privacy policy updated** with VeilForms information
- [ ] **Consent mechanism** in place for forms
- [ ] **Data minimization** — only necessary fields collected
- [ ] **PII stripping enabled** (`piiStrip: true`)
- [ ] **Encryption enabled** (`encryption: true`)
- [ ] **Retention period set** (automatic deletion)
- [ ] **Access request process** documented
- [ ] **Deletion request process** documented
- [ ] **Records of processing** maintained
- [ ] **DPA in place** with VeilForms

## Beyond GDPR

VeilForms' architecture also helps with:

- **CCPA** (California Consumer Privacy Act)
- **LGPD** (Brazil)
- **PIPEDA** (Canada)
- **HIPAA** (when properly configured)

The principle is the same: minimize data, encrypt everything, give users control.

## Next Steps

- [PII Detection](/docs/sdk/pii-detection/) — Configure automatic PII handling
- [Key Management](/docs/guides/key-management/) — Secure your encryption keys
- [Self Hosting](/docs/guides/self-hosting/) — Maximum data control
