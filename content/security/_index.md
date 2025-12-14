---
title: 'Security'
description: 'VeilForms security practices, encryption details, and vulnerability reporting'
priority: 0.7
type: 'pages'
layout: 'single'
---

# Security

VeilForms is built on a simple principle: **we cannot read your data, so we cannot leak it.**

This page details our security practices, encryption implementation, and how to report vulnerabilities.

## Security Model Overview

VeilForms uses **zero-knowledge encryption** where form submissions are encrypted client-side before transmission:

1. You generate an RSA keypair (you keep the private key)
2. Users' browsers encrypt form data with your public key
3. We receive and store only encrypted ciphertext
4. We cannot decrypt submissions (we don't have your private key)
5. You decrypt locally or on your server using your private key

**Result:** Even if our servers are compromised, encrypted submissions remain unreadable.

## Encryption Standards

### Client-Side Encryption

**Algorithms:**
- **RSA-2048** for asymmetric key exchange
- **AES-256-GCM** for symmetric data encryption
- **SHA-256** for hashing and integrity checks

**Implementation:**
- Web Crypto API (browser-native, hardware-accelerated)
- node-forge (Node.js compatibility)
- All crypto libraries are well-audited and industry-standard

**Process:**
```
1. Generate random AES-256 key (per submission)
2. Encrypt form data with AES-256-GCM
3. Encrypt AES key with recipient's RSA-2048 public key
4. Bundle encrypted data + encrypted key + metadata
5. Transmit bundle to VeilForms API
```

### Transport Security

**TLS 1.3** for all connections:
- Perfect Forward Secrecy (PFS)
- Strong cipher suites only (no RC4, MD5, etc.)
- HSTS enabled (strict transport security)
- Certificate pinning for API endpoints

### Storage Security

**Data at rest:**
- Encrypted blobs stored as-is (already client-side encrypted)
- Database encrypted with AES-256
- Separate encryption keys for metadata
- Keys managed via secure key management service (AWS KMS / GCP KMS)

**Backups:**
- Encrypted with separate keys
- Stored in geographically distributed locations
- Automated backup integrity checks
- 30-day retention with point-in-time recovery

## Infrastructure Security

### Hosting and Isolation

- Cloud infrastructure (AWS/GCP/Azure)
- Isolated environments (dev, staging, production)
- Network segmentation and firewalls
- DDoS protection via Cloudflare

### Access Controls

**Employee access:**
- Role-based access control (RBAC)
- Multi-factor authentication (MFA) required
- Principle of least privilege
- Access logs and monitoring
- Annual security training

**API access:**
- API keys with rate limiting
- OAuth 2.0 for user authentication
- JWT tokens with short expiration
- IP whitelisting available (Enterprise plan)

### Monitoring and Logging

**Security monitoring:**
- Real-time intrusion detection
- Anomaly detection for API usage
- Automated alerts for suspicious activity
- 24/7 uptime monitoring

**Logs:**
- Centralized logging infrastructure
- Encrypted log storage
- 90-day retention for security logs
- No PII in logs (form data is encrypted)

## Application Security

### Secure Development Practices

- Security-first design
- Code reviews for all changes
- Automated security scanning (SAST/DAST)
- Dependency vulnerability scanning
- Regular penetration testing

### OWASP Top 10 Mitigations

| Vulnerability | Mitigation |
|---------------|------------|
| **Injection** | Parameterized queries, input validation |
| **Broken Auth** | Secure session management, MFA support |
| **Sensitive Data Exposure** | Client-side encryption, TLS 1.3 |
| **XML External Entities** | JSON-only API, no XML parsing |
| **Broken Access Control** | RBAC, API key scoping |
| **Security Misconfiguration** | Hardened defaults, security headers |
| **XSS** | Content Security Policy, output encoding |
| **Insecure Deserialization** | Safe parsers, schema validation |
| **Using Components with Known Vulnerabilities** | Automated scanning, rapid patching |
| **Insufficient Logging** | Comprehensive audit trails |

### Security Headers

All VeilForms pages include:

```
Content-Security-Policy: default-src 'self'; script-src 'self'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

## Authentication and Authorization

### User Authentication

- bcrypt password hashing (cost factor 12)
- Secure password reset flows
- Session tokens with HttpOnly cookies
- Automatic session expiration (7 days)
- Optional two-factor authentication (2FA)

### API Authentication

- API keys stored hashed (never plaintext)
- Scoped permissions per key
- Automatic key rotation support
- Rate limiting (1000 req/hour on free tier)
- Webhook signature verification (HMAC-SHA256)

## Compliance and Certifications

### Current Compliance

- **GDPR:** Zero-knowledge architecture simplifies compliance
- **CCPA:** Data portability and deletion built-in
- **HIPAA:** Encryption suitable for PHI (BAA available on request)
- **PCI DSS:** We don't handle payment data (Stripe does)

### Security Roadmap

- **Q1 2025:** Third-party penetration test
- **Q2 2025:** Formal cryptographic audit
- **Q3 2025:** SOC 2 Type II certification
- **Q4 2025:** ISO 27001 certification

### Audit Reports

Once completed, audit reports will be available to Enterprise customers under NDA.

## Vulnerability Disclosure

We welcome security researchers to help keep VeilForms secure.

### Responsible Disclosure Process

1. **Email:** security@veilforms.com (PGP key available)
2. **Include:** Detailed description, reproduction steps, impact assessment
3. **Response:** We'll acknowledge within 24 hours
4. **Fix:** Critical issues patched within 7 days
5. **Disclosure:** Coordinated public disclosure after fix

### Security Bug Bounty

We offer rewards for qualifying vulnerabilities:

| Severity | Bounty |
|----------|--------|
| **Critical** (RCE, encryption bypass) | $500-$2,000 |
| **High** (XSS, auth bypass) | $200-$500 |
| **Medium** (CSRF, info disclosure) | $50-$200 |
| **Low** (minor issues) | Hall of Fame |

**In scope:**
- veilforms.com and subdomains
- API endpoints (api.veilforms.com)
- Client-side SDK (GitHub repository)
- Dashboard and form builder

**Out of scope:**
- Social engineering
- Physical attacks
- Third-party services (Stripe, hosting providers)
- Issues requiring user interaction (self-XSS)
- Rate limiting bypass without actual impact

**Rules:**
- No public disclosure before fix
- No automated scanning that impacts service
- No testing on other users' accounts
- Comply with all laws

### Hall of Fame

We'll publicly recognize researchers who help improve VeilForms security (with permission).

## Incident Response

### In Case of a Breach

If we detect a security incident:

1. **Immediate containment** (within 1 hour)
2. **User notification** (within 24 hours if affected)
3. **Regulatory notification** (as required by law)
4. **Public disclosure** (full transparency report)
5. **Remediation** (permanent fix + preventive measures)

**Your encrypted data remains protected** even in a breach (we can't decrypt it).

### Breach History

No security incidents to date. This section will be updated if any occur.

## Key Management Best Practices

Since you control the encryption keys, here are our recommendations:

### For Individuals

- Store private key in a password manager (1Password, Bitwarden)
- Export and save encrypted backup to separate device
- Never share your private key
- Rotate keys annually

### For Teams

- Use hardware security modules (HSMs)
- Implement key escrow for business continuity
- Set up multiple backup keys
- Document key rotation procedures
- Limit access to production keys

### For Enterprises

- Integrate with enterprise key management (Vault, AWS KMS)
- Implement automated key rotation
- Maintain offline key backups
- Set up split-key ceremonies for master keys
- Regular key recovery drills

## Security Contact

**Report vulnerabilities:** security@veilforms.com

**PGP Key:** [Download PGP key](/security/pgp-key.asc) (Fingerprint: [FINGERPRINT])

**General security questions:** support@veilforms.com

**Emergency contact:** [Phone number for critical issues]

## Additional Resources

- [Privacy Policy](/privacy-policy/) - How we handle your data
- [Terms of Use](/terms-of-use/) - Legal responsibilities
- [FAQ](/docs/faq/) - Common security questions
- [Documentation](/docs/) - Technical implementation details

### External Security Resources

- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
- [NIST Encryption Standards](https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines)
- [Web Crypto API Specification](https://www.w3.org/TR/WebCryptoAPI/)

## Security Changelog

**December 2025:**
- Launched with TLS 1.3 and RSA-2048 + AES-256 encryption
- Implemented CSP headers and HSTS
- Published vulnerability disclosure policy

Future updates will be logged here.

---

## Trust but Verify

Don't just take our word for it:

1. **Inspect the SDK:** Our open-source JavaScript SDK is fully auditable
2. **Check network traffic:** Verify only encrypted data is transmitted
3. **Test decryption:** Confirm you can decrypt submissions locally
4. **Review headers:** Use browser dev tools to inspect security headers

**Security is a partnership.** We build the infrastructure; you verify it works.

---

**Last updated: December 13, 2025**

**Next security review scheduled: March 2025**
