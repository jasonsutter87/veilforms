---
title: "What Happens to Your Form Data in a Breach? A Deep Dive"
description: "Explore the real-world impact of data breaches on form submissions. Learn how different security approaches affect breach outcomes and what you can do to protect your users."
priority: 0.6
date: 2025-11-10
category: "Security"
author: "VeilForms Team"
readTime: 9
tags: ["data-breach", "security", "encryption", "protection"]
type: "blog"
css: ["blog.css"]
---

Every year, billions of records are exposed in data breaches. Many of those records came through web forms—contact forms, signup forms, application forms. When your form provider gets breached, what happens to your users' data?

The answer depends entirely on how that data was protected.

## The Anatomy of a Form Data Breach

Let's trace what happens when a typical form service is breached:

### Stage 1: Initial Access

Attackers gain entry through:
- Phishing an employee
- Exploiting a software vulnerability
- Compromised credentials
- Supply chain attack

### Stage 2: Lateral Movement

Once inside, attackers:
- Escalate privileges
- Move through the network
- Identify valuable data stores
- Locate database credentials

### Stage 3: Data Exfiltration

Attackers extract:
- Database dumps
- Backup files
- Log files
- Configuration data

### Stage 4: Impact

What happens next depends on what they got.

## Scenario A: Traditional Form Builder Breach

**Setup**: Server-side encryption, provider holds keys

**What attackers get**:
- Encrypted database files
- Encryption keys (same system or accessible)
- Ability to decrypt everything

**Result**:
```
Exposed: 2.3 million form submissions
- Full names: 2.3M
- Email addresses: 2.3M
- Phone numbers: 1.8M
- Physical addresses: 890K
- SSNs: 45K
- Medical information: 23K
- Credit card data: 12K
```

**Aftermath**:
- Mandatory breach notification
- Identity theft risk for users
- Regulatory fines (GDPR, HIPAA, etc.)
- Class action lawsuits
- Reputation damage
- Years of remediation

## Scenario B: Client-Side Encrypted Form Breach

**Setup**: Client-side encryption, users control keys

**What attackers get**:
- Encrypted database files
- No decryption keys (never on server)
- Ciphertext they cannot read

**Result**:
```
Exposed: 2.3 million encrypted blobs
- Readable data: 0
- Usable for identity theft: 0
- Regulatory violation: Minimal
```

**Aftermath**:
- Security incident (not data breach)
- No identity theft risk
- Minimal regulatory impact
- No class action exposure
- Quick recovery

## Real-World Breach Examples

### Typeform (2018)

**What happened**: Attackers accessed customer data through a compromised server.

**Impact**: Data from multiple organizations exposed, including names, emails, and form responses.

**Root cause**: Server-side data storage without adequate segmentation.

### JotForm (2019)

**What happened**: Unauthorized access to form data storage.

**Impact**: Unknown number of form submissions potentially exposed.

**Lesson**: Even "secure" providers can be breached.

### The Pattern

Every major form builder breach follows the same pattern:
1. Server is compromised
2. Data is accessible because provider can read it
3. Massive exposure results

## The Mathematics of Encryption

Why can't attackers decrypt client-side encrypted data?

### RSA-2048

Breaking RSA-2048 would require:
- ~10^17 years with current technology
- More energy than the sun produces in its lifetime
- Computational power that doesn't exist

### AES-256

Breaking AES-256 would require:
- Testing 2^256 possible keys
- More operations than atoms in the observable universe
- Physically impossible with known physics

When data is properly encrypted client-side, attackers get mathematically useless ciphertext.

## What Breach Notifications Look Like

### Without Client-Side Encryption

```
Dear User,

We regret to inform you that a security incident has resulted
in unauthorized access to your personal information, including:
- Full name
- Email address
- Phone number
- Home address
- Message content

We recommend you:
- Monitor your credit reports
- Be alert for phishing attempts
- Consider identity theft protection

We apologize for this incident...
```

### With Client-Side Encryption

```
Dear User,

We experienced a security incident involving unauthorized
access to our systems. However, because your form submissions
were encrypted with keys only you control, your personal
information was NOT exposed.

No action is required on your part.

We have taken steps to prevent future incidents...
```

Which email would you rather send?

## Breach Cost Comparison

According to IBM's Cost of a Data Breach Report:

| Factor | Without Encryption | With Encryption |
|--------|-------------------|-----------------|
| Average cost | $4.45M | $1.49M |
| Detection time | 207 days | 249 days* |
| Containment time | 70 days | 30 days |
| Regulatory fines | High | Minimal |
| Legal exposure | Significant | Limited |
| Reputation impact | Severe | Moderate |

*Detection takes longer because there's no usable data to trigger alerts

## Building Breach Resilience

### 1. Encrypt Before Transmission

Data should be encrypted before it leaves the user's browser. Not on your server. Not in transit. In the browser.

```javascript
// Data is encrypted here, in the user's browser
const encrypted = await VeilForms.encrypt(formData, publicKey);

// Only ciphertext ever leaves their device
await fetch('/api/submit', {
  body: JSON.stringify(encrypted)
});
```

### 2. Never Store Keys Together with Data

If you encrypt server-side, keys and data are often compromised together. Client-side encryption means keys never touch your servers.

### 3. Implement Defense in Depth

Even with encryption:
- Use strong access controls
- Monitor for anomalies
- Segment your network
- Keep systems patched
- Train employees on security

### 4. Plan for Breach

Assume you'll be breached. Ask:
- What data would attackers get?
- Can they read it?
- What's the notification requirement?
- What's the recovery plan?

## Questions for Your Form Provider

Before trusting a form service with user data:

1. "Where does encryption happen?"
   - Good: "In the user's browser"
   - Bad: "On our servers"

2. "Who has access to decryption keys?"
   - Good: "Only you"
   - Bad: "Our authorized personnel"

3. "In a breach, what would attackers get?"
   - Good: "Encrypted data they can't read"
   - Bad: "We have security measures to prevent breaches"

4. "Have you been breached before?"
   - Honest answer + lessons learned is better than denial

5. "What's your breach notification policy?"
   - Should be clear, with defined timelines

## The Bottom Line

Data breaches are not "if" but "when." The question is: when it happens, what will attackers get?

With traditional form builders: everything.
With client-side encryption: nothing useful.

Your users trust you with their data. Protect it like a breach is inevitable—because it might be.

---

Ready to protect your form data from breaches? [Get started with VeilForms](/register/) and encrypt submissions in the browser.
