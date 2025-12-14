---
title: 'Privacy Policy'
description: 'VeilForms privacy policy - how we handle your data with end-to-end encryption'
priority: 0.5
type: 'pages'
layout: 'single'
---

# Privacy Policy

**Last updated: December 13, 2025**

VeilForms is built on a simple principle: **we cannot read your data, so we cannot misuse it.**

This privacy policy explains what data we collect, how we use it, and why our zero-knowledge architecture means we know less about you than traditional form services.

## The Short Version

- We cannot decrypt your form submissions (you hold the only keys)
- We don't use tracking pixels, cookies, or fingerprinting
- We collect minimal account data (email, payment info)
- We don't sell or share your data with third parties
- You can export or delete your data anytime

## Who We Are

VeilForms is operated by ZTAS.io, a privacy-focused software company.

**Contact:**
- Email: privacy@veilforms.com
- Address: Operated remotely - for legal correspondence, email legal@veilforms.com

## What Data We Collect

### 1. Account Information
When you create an account, we collect:
- Email address (for login and notifications)
- Password (hashed with bcrypt, never stored in plaintext)
- Display name (optional)
- Payment information (processed by Stripe, not stored by us)

### 2. Encrypted Form Submissions
When users submit forms:
- **Encrypted data blob** (we cannot decrypt this)
- Submission timestamp
- Anonymous submission ID (cryptographically random)
- Form ID the submission belongs to
- Metadata: PII flags (but not the actual PII)

**Critical detail:** Form data is encrypted client-side with your public key. We receive only ciphertext. We mathematically cannot decrypt it.

### 3. Usage Data
We collect minimal analytics:
- Form view counts (anonymized, no user tracking)
- Submission success/error rates
- API endpoint performance metrics
- Browser/device type (for compatibility, no fingerprinting)

**What we DON'T collect:**
- Individual user tracking across sessions
- IP addresses for form submissions
- Cookies or local storage for tracking
- Third-party analytics or advertising pixels

### 4. Technical Data
Standard server logs:
- IP addresses (retained for 7 days for abuse prevention)
- User agent strings
- Request timestamps
- Error logs

Logs are used solely for security, debugging, and preventing abuse.

## How We Use Your Data

### Account Management
- Send login emails and password resets
- Deliver form submission notifications
- Provide customer support
- Process billing and subscriptions

### Service Operation
- Store encrypted form submissions
- Detect and prevent abuse/spam
- Monitor system performance
- Improve security and reliability

### Legal Compliance
- Respond to valid legal requests (we can only provide encrypted data)
- Enforce our Terms of Use
- Protect our rights and users' safety

**We do NOT:**
- Sell your data to advertisers
- Share data with data brokers
- Use data for targeted advertising
- Train AI models on your submissions
- Track users across the web

## Zero-Knowledge Architecture

VeilForms is designed so we cannot access your form data:

1. **You generate keypairs** on your device (public + private key)
2. **You keep the private key** (we never see it)
3. **Users encrypt submissions** in their browser with your public key
4. **We store ciphertext** that we cannot decrypt
5. **You decrypt locally** or on your server using your private key

This means:
- We can't read your form submissions, even if we wanted to
- We can't be compelled to hand over readable data (we don't have it)
- We can't have a data breach of plaintext submissions
- You maintain total control over who can decrypt your data

## Data Sharing

We share data only in these limited circumstances:

### Service Providers
- **Stripe:** Payment processing (they see billing info, not form data)
- **Vercel/Netlify:** Hosting infrastructure (they see encrypted blobs)
- **Email service:** Transactional emails only (SendGrid/Postmark)

All providers are GDPR-compliant and operate under strict data processing agreements.

### Legal Requirements
We may disclose data if required by law, but:
- Form submissions are encrypted (we can only provide ciphertext)
- We'll notify you unless legally prohibited
- We'll fight overbroad requests in court

### With Your Consent
We'll share data if you explicitly authorize it (e.g., support requests).

**We will NEVER:**
- Sell your data to third parties
- Share data with advertisers
- Use data for purposes beyond providing the service

## Data Retention

- **Encrypted submissions:** Retained until you delete them
- **Account data:** Retained while account is active
- **Server logs:** 7 days (IP addresses, requests)
- **Billing records:** 7 years (tax compliance)

### Data Deletion
You can delete data anytime:
- Delete individual submissions via dashboard
- Export all data, then delete account
- Email privacy@veilforms.com for manual deletion

When you delete:
- Encrypted submissions are immediately removed from production
- Backups are purged within 30 days
- Account data is anonymized (email changed to deleted@veilforms.com)

## Your Privacy Rights

Depending on your location, you may have these rights:

### GDPR (EU/UK)
- **Access:** Request a copy of your data
- **Rectification:** Correct inaccurate data
- **Erasure:** Delete your data ("right to be forgotten")
- **Portability:** Export data in machine-readable format
- **Objection:** Object to certain processing
- **Restriction:** Limit how we process your data

### CCPA (California)
- **Know:** What data we collect and how we use it
- **Delete:** Request deletion of your data
- **Opt-out:** No data sales (we don't sell data anyway)
- **Non-discrimination:** Equal service regardless of privacy choices

### Other Jurisdictions
We respect privacy rights globally and will honor requests to the extent legally possible.

**To exercise rights:** Email privacy@veilforms.com with your request. We'll respond within 30 days.

## Cookies and Tracking

VeilForms uses minimal cookies:

### Essential Cookies
- Session authentication (required to log in)
- CSRF protection (security)

These are necessary for the service to function. No consent required.

### No Tracking Cookies
We do NOT use:
- Analytics cookies (Google Analytics, etc.)
- Advertising cookies
- Third-party tracking pixels
- Cross-site tracking
- Fingerprinting techniques

We respect Do Not Track (DNT) signals as standard practice.

## Children's Privacy

VeilForms is not intended for users under 16. We don't knowingly collect data from children.

If you believe a child has created an account, contact privacy@veilforms.com and we'll delete it immediately.

## International Data Transfers

VeilForms is hosted on Netlify's global edge network (primary: US-East). If you're outside this region:

- Data may be transferred internationally for processing
- We use Standard Contractual Clauses (SCCs) for GDPR compliance
- Encrypted data provides additional protection during transfer
- You can request data residency (Enterprise plan only)

## Security Measures

We protect your data with:

- **Encryption in transit:** TLS 1.3 for all connections
- **Encryption at rest:** AES-256 for database storage
- **End-to-end encryption:** For form submissions (your keys)
- **Access controls:** Role-based permissions, MFA for staff
- **Penetration testing:** Regular security audits
- **Incident response:** 24-hour breach notification plan

Even with a server breach, encrypted submissions remain unreadable without your private key.

## Changes to This Policy

We may update this policy as we add features or comply with new regulations.

**We'll notify you of material changes:**
- Email to account holders
- Dashboard notification
- 30-day notice before changes take effect

Continued use after changes constitutes acceptance.

**Version history:**
- December 13, 2025: Initial version

## Third-Party Links

VeilForms may link to external sites. We're not responsible for their privacy practices. Read their policies before sharing data.

## Contact Us

Questions about this policy or your data?

- **Email:** privacy@veilforms.com
- **Support:** support@veilforms.com
- **Security issues:** security@veilforms.com
- **Postal mail:** For legal correspondence, email legal@veilforms.com

We are a small team operating remotely. For EU/UK data protection inquiries, contact privacy@veilforms.com.

---

## Summary Table

| Data Type | What We Collect | How We Use It | Can We Read It? |
|-----------|----------------|---------------|-----------------|
| Form submissions | Encrypted blob | Store and deliver to you | **NO** - Encrypted |
| Email address | Your account email | Login, notifications | Yes |
| Payment info | Stripe token | Billing | No (Stripe handles) |
| Usage analytics | View counts, error rates | Improve service | Yes (anonymized) |
| IP addresses | Server logs | Abuse prevention | Yes (7-day retention) |
| Private keys | **Never collected** | N/A | **Never have access** |

**The key difference:** Traditional form services see all your submissions in plaintext. We see only encrypted ciphertext.

---

**This policy is effective as of December 13, 2025.**
