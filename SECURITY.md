# Security Policy

## Our Commitment

VeilForms takes security seriously. As a privacy-first form management platform built on zero-trust principles, we welcome responsible disclosure of security vulnerabilities.

## Supported Versions

We currently support security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |
| < Latest| :x:                |

As VeilForms is actively developed, we recommend always using the latest version deployed at https://veilforms.com.

## Reporting a Vulnerability

If you discover a security vulnerability, please follow these steps:

### 1. DO NOT disclose publicly

Please do not create public GitHub issues for security vulnerabilities. This helps protect our users while we work on a fix.

### 2. Email us directly

Send details to: **security@veilforms.com**

Include in your report:
- Description of the vulnerability
- Steps to reproduce
- Potential impact assessment
- Your suggested remediation (if any)
- Your contact information for follow-up

### 3. Response Timeline

You can expect:
- **Initial response:** Within 48 hours
- **Status update:** Within 5 business days
- **Resolution timeline:** Depends on severity
  - Critical: 1-7 days
  - High: 7-14 days
  - Medium: 14-30 days
  - Low: 30-90 days

### 4. Coordinated Disclosure

We believe in coordinated disclosure:
- We'll work with you to understand and validate the issue
- We'll develop and test a fix
- We'll deploy the fix to production
- We'll publicly acknowledge your contribution (if desired)

Typical disclosure timeline: 90 days from initial report.

## Security Scope

### In Scope

Security issues in the following areas are in scope:

- Client-side encryption implementation
- Authentication and authorization
- Session management
- API endpoint security
- XSS, CSRF, and injection vulnerabilities
- Cryptographic vulnerabilities
- Privacy leaks or data exposure
- Authorization bypass
- Infrastructure security (Netlify deployment)

### Out of Scope

The following are generally out of scope:

- Social engineering attacks
- Denial of Service (DoS/DDoS) attacks
- Issues requiring physical access to a user's device
- Recently disclosed 0-day vulnerabilities (give us time to patch)
- Theoretical vulnerabilities without proof of concept
- Vulnerabilities in third-party services (report to them directly)
- Issues that require unlikely user interaction
- Rate limiting on non-critical endpoints
- Missing security headers that don't lead to a vulnerability
- SSL/TLS configuration issues (handled by Netlify)

## Encryption Standards

VeilForms uses industry-standard encryption:

- **RSA-2048** with OAEP padding for asymmetric encryption
- **AES-256-GCM** for symmetric encryption
- **SHA-256** for hashing
- **Web Crypto API** for all cryptographic operations

See our [Security Architecture](/security/) page for detailed technical specifications.

## Security Features

- **Client-side encryption:** Data is encrypted before leaving the browser
- **Zero-knowledge architecture:** VeilForms servers never see unencrypted form data
- **Key isolation:** Each form has unique RSA key pairs
- **Secure key storage:** Private keys stored encrypted in browser localStorage
- **HTTPS everywhere:** All traffic encrypted in transit
- **Security headers:** CSP, HSTS, X-Frame-Options, etc.

## Bug Bounty Program

We currently do not have a formal bug bounty program. However, we deeply appreciate security research and will publicly acknowledge security researchers who help make VeilForms more secure.

## PGP Key

For sensitive communications, you can use our PGP key:

```
Currently not available - email security@veilforms.com for encrypted communication setup
```

## Security Updates

Security updates will be announced via:
- GitHub releases
- Security advisories on GitHub
- Email to registered users (for critical issues)
- Our blog at https://veilforms.com/blog/

## Questions?

For general security questions that don't involve vulnerability disclosure, you can:
- Email: security@veilforms.com
- Review our [Security Architecture](/security/) documentation
- Open a discussion on GitHub (for non-sensitive topics)

## Attribution

We appreciate the security community's efforts. Reporters who responsibly disclose vulnerabilities will be acknowledged in:
- Our security hall of fame (coming soon)
- Release notes
- Public thank you (unless you prefer to remain anonymous)

Thank you for helping keep VeilForms and its users safe!
