---
title: "Building HIPAA-Compliant Web Forms: A Complete Guide"
description: "Learn how to build web forms that meet HIPAA requirements for handling Protected Health Information (PHI). Covers encryption, access controls, and audit logging."
date: 2025-12-03
category: "Compliance"
author: "VeilForms Team"
readTime: 12
tags: ["hipaa", "healthcare", "compliance", "phi"]
type: "blog"
css: ["blog.css"]
---

If you're building web forms that collect health information, HIPAA compliance isn't optional—it's the law. Violations can result in fines up to $1.5 million per incident.

This guide covers everything you need to know about building HIPAA-compliant web forms.

## What is HIPAA?

The Health Insurance Portability and Accountability Act (HIPAA) sets national standards for protecting sensitive patient health information. It applies to:

- **Covered Entities**: Healthcare providers, health plans, healthcare clearinghouses
- **Business Associates**: Any company that handles PHI on behalf of covered entities

If your form collects health information for a covered entity, you're likely a business associate and must comply with HIPAA.

## What is Protected Health Information (PHI)?

PHI includes any health information that can identify an individual:

- Names, addresses, phone numbers
- Social Security numbers
- Medical record numbers
- Health conditions and diagnoses
- Treatment information
- Prescription history
- Insurance information
- Appointment dates

When this information is transmitted or stored electronically, it becomes ePHI (electronic PHI).

## HIPAA Requirements for Web Forms

### 1. Encryption in Transit

All ePHI must be encrypted during transmission. At minimum, this means:

- HTTPS/TLS for all form submissions
- TLS 1.2 or higher
- Strong cipher suites

But here's the problem: TLS only protects data between the user's browser and your server. Once data reaches the server, it's decrypted and vulnerable.

**Better approach**: Client-side encryption encrypts data in the browser before transmission. Even if someone intercepts the data or breaches your server, they only get encrypted ciphertext.

### 2. Encryption at Rest

ePHI must be encrypted when stored. Options include:

- Database encryption
- File system encryption
- Application-level encryption

**Best practice**: Client-side encryption means data is encrypted before it ever reaches your storage. You store ciphertext, not plaintext PHI.

### 3. Access Controls

Only authorized individuals should access ePHI. Implement:

- Unique user IDs
- Role-based access control
- Automatic session timeouts
- Emergency access procedures

### 4. Audit Logging

You must log all access to ePHI:

- Who accessed the data
- When they accessed it
- What they did with it
- From where (IP address)

Logs must be retained and protected from tampering.

### 5. Integrity Controls

Ensure ePHI isn't altered or destroyed improperly:

- Checksums and digital signatures
- Version control
- Backup procedures

### 6. Business Associate Agreements (BAAs)

Any vendor that handles ePHI must sign a BAA. This includes:

- Form builders
- Cloud hosting providers
- Email services
- Analytics tools

**Important**: Many form builders won't sign BAAs or charge enterprise rates for HIPAA compliance. VeilForms signs BAAs on all paid plans.

## Building a HIPAA-Compliant Form

Here's a patient intake form that meets HIPAA requirements:

```html
<form data-veilform="patient_intake" id="hipaa-form">
  <h2>Patient Information</h2>

  <div class="form-group">
    <label for="patient-name">Full Name *</label>
    <input type="text" id="patient-name" name="patient_name" required
           autocomplete="off">
  </div>

  <div class="form-group">
    <label for="dob">Date of Birth *</label>
    <input type="date" id="dob" name="date_of_birth" required>
  </div>

  <div class="form-group">
    <label for="ssn">Social Security Number</label>
    <input type="text" id="ssn" name="ssn"
           pattern="[0-9]{3}-[0-9]{2}-[0-9]{4}"
           placeholder="XXX-XX-XXXX"
           autocomplete="off">
  </div>

  <div class="form-group">
    <label for="insurance">Insurance ID</label>
    <input type="text" id="insurance" name="insurance_id" autocomplete="off">
  </div>

  <h3>Medical Information</h3>

  <div class="form-group">
    <label for="conditions">Current Medical Conditions</label>
    <textarea id="conditions" name="medical_conditions" rows="4"></textarea>
  </div>

  <div class="form-group">
    <label for="medications">Current Medications</label>
    <textarea id="medications" name="medications" rows="4"></textarea>
  </div>

  <div class="form-group">
    <label for="allergies">Known Allergies</label>
    <textarea id="allergies" name="allergies" rows="3"></textarea>
  </div>

  <div class="consent-section">
    <label>
      <input type="checkbox" name="hipaa_consent" required>
      I acknowledge that my health information will be encrypted and stored
      securely in accordance with HIPAA requirements. I consent to this
      information being used for my healthcare treatment.
    </label>
  </div>

  <p class="security-notice">
    Your information is encrypted in your browser before transmission.
    Only authorized healthcare providers can decrypt this data.
  </p>

  <button type="submit">Submit Securely</button>
</form>
```

## Security Best Practices

### Disable Autocomplete for PHI Fields

```html
<input type="text" name="ssn" autocomplete="off">
```

This prevents browsers from caching sensitive data.

### Set Appropriate Session Timeouts

HIPAA requires automatic logoff. Implement session timeouts:

```javascript
// Log out after 15 minutes of inactivity
let timeout;
const TIMEOUT_DURATION = 15 * 60 * 1000;

function resetTimeout() {
  clearTimeout(timeout);
  timeout = setTimeout(logout, TIMEOUT_DURATION);
}

document.addEventListener('mousemove', resetTimeout);
document.addEventListener('keypress', resetTimeout);
```

### Implement Audit Logging

Log every form submission and data access:

```javascript
// VeilForms automatically logs:
// - Submission timestamp
// - Anonymous submission ID
// - Form ID
// - Decryption events (if configured)
```

### Use Strong Authentication

For accessing stored PHI:

- Require strong passwords
- Implement multi-factor authentication
- Use secure password reset flows

## Common HIPAA Violations to Avoid

1. **Unencrypted transmission**: Always use HTTPS
2. **Storing PHI in plaintext**: Encrypt at rest
3. **Excessive data collection**: Only collect necessary PHI
4. **Missing BAAs**: Ensure all vendors sign agreements
5. **Insufficient access controls**: Implement role-based access
6. **Inadequate audit logs**: Log all PHI access
7. **Lack of employee training**: Train staff on HIPAA requirements

## VeilForms HIPAA Features

VeilForms is designed for HIPAA compliance:

- **Client-side encryption**: PHI is encrypted before leaving the browser
- **You control the keys**: We cannot access your patients' data
- **Audit logging**: Complete access logs for compliance
- **BAA available**: We sign Business Associate Agreements
- **Data retention controls**: Automatic deletion policies
- **Access controls**: Role-based permissions for your team

## Checklist: Is Your Form HIPAA Compliant?

- [ ] Form uses HTTPS with TLS 1.2+
- [ ] PHI is encrypted in transit
- [ ] PHI is encrypted at rest
- [ ] Access controls implemented
- [ ] Audit logging enabled
- [ ] Session timeouts configured
- [ ] BAA signed with form provider
- [ ] Autocomplete disabled for PHI fields
- [ ] HIPAA consent collected
- [ ] Staff trained on procedures

---

HIPAA compliance requires ongoing attention, not just a one-time setup. Choose tools that make compliance easier, not harder.

Questions about HIPAA-compliant forms? [Contact us](/contact/) for guidance.
