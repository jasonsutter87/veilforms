---
title: 'Frequently Asked Questions'
description: 'Common questions about VeilForms security, privacy, and data ownership'
priority: 0.7
weight: 6
---

## Security & Privacy

### What if I lose my private key?

**Your data becomes unrecoverable.** This is the trade-off for true end-to-end encryption.

VeilForms uses client-side encryption where only you hold the private key. We intentionally cannot help you recover lost keys because that would mean we could also access your encrypted data.

**Best practices:**
- Store your private key in a secure password manager
- Keep encrypted backups in multiple locations
- Set up key rotation and backup keys for production use
- Consider using hardware security modules (HSMs) for enterprise deployments

We provide key export functionality in the dashboard to make secure backups easy.

### Can VeilForms read my data?

**No. We only see encrypted ciphertext.**

When a user submits a form:
1. Data is encrypted in their browser using your public key
2. We receive and store only the encrypted blob
3. We have no access to your private key
4. We cannot decrypt the data, even if legally compelled to do so

This is mathematically guaranteed by RSA-2048 encryption. The only way to decrypt submissions is with your private key, which never leaves your device.

### How does this compare to Typeform?

| Feature | VeilForms | Typeform |
|---------|-----------|----------|
| **Data encryption** | Client-side (E2EE) | Server-side only |
| **Who can read data** | Only you | Typeform + you |
| **User tracking** | Zero tracking | Extensive analytics |
| **Third-party cookies** | None | Multiple trackers |
| **GDPR compliance** | Built-in PII detection | Manual configuration |
| **Data ownership** | You hold the keys | They hold the keys |

**When to use Typeform:**
- You need advanced logic/branching
- You want to analyze individual user patterns
- You don't handle sensitive data

**When to use VeilForms:**
- You collect PII (emails, addresses, SSNs)
- You need HIPAA/GDPR compliance
- Your users demand real privacy
- You want zero-knowledge architecture

### Is this open source?

**The SDK is open source. The backend is not (yet).**

Our JavaScript SDK is MIT licensed and available on GitHub. You can audit:
- Client-side encryption implementation
- PII detection algorithms
- Data submission flow
- Everything that runs in the browser

The backend infrastructure (storage, key management, dashboard) is currently proprietary, but we're evaluating open-sourcing components as we mature.

**Why this approach:**
- Transparency where it matters most (encryption)
- Users can verify no tracking code exists
- Open to security audits and contributions
- Sustainable business model to keep the service running

### What happens if VeilForms shuts down?

**You can still decrypt all your data.**

Because you control the private keys, you're not locked into our platform:

1. **Export your data:** Download all encrypted submissions as JSON
2. **Decrypt locally:** Use your private key to decrypt everything
3. **Self-host:** Use our open-source SDK to decrypt submissions on your own infrastructure

We also provide:
- **90-day shutdown notice** with full export tools
- **Data portability APIs** available now
- **Offline decryption scripts** in the SDK documentation
- **No vendor lock-in** by design

Your data is yours, encrypted with your keys. We're just the storage layer.

### Has this been security audited?

**Not yet, but it's on the roadmap.**

We're currently:
- Following OWASP cryptography best practices
- Using battle-tested crypto libraries (Web Crypto API, node-forge)
- Implementing standard RSA-2048 + AES-256-GCM encryption
- Open-sourcing the SDK for community review

**Security roadmap:**
- Q1 2025: Third-party penetration testing
- Q2 2025: Formal cryptographic audit
- Q3 2025: SOC 2 Type II certification

In the meantime:
- All crypto code is reviewable in our open-source SDK
- We follow security disclosure best practices
- We maintain a public security policy
- Report vulnerabilities to security@veilforms.com

We take security seriously and welcome audits from the community.

## Technical Questions

### What encryption algorithms do you use?

**RSA-2048 for key exchange, AES-256-GCM for data encryption.**

The encryption flow:
1. You generate an RSA-2048 keypair (public + private)
2. Users' browsers generate a random AES-256 key per submission
3. Form data is encrypted with AES-256-GCM (authenticated encryption)
4. The AES key is encrypted with your RSA public key
5. We receive the encrypted AES key + encrypted data

This hybrid approach combines:
- **RSA security** for key distribution
- **AES performance** for bulk data encryption
- **GCM authentication** to prevent tampering

All implemented using the Web Crypto API and standard libraries.

### Does VeilForms work with React/Vue/other frameworks?

**Yes. It's framework-agnostic.**

The SDK is vanilla JavaScript that works everywhere:

```javascript
// Vanilla JS
<form data-veilform="form-id">

// React
<form data-veilform={formId}>

// Vue
<form :data-veilform="formId">

// Next.js, Nuxt, Svelte, etc.
```

We also provide official React hooks and Vue composables for easier integration:

```javascript
// React
import { useVeilForm } from '@veilforms/react';

// Vue
import { useVeilForm } from '@veilforms/vue';
```

Check the [SDK documentation](/docs/sdk/installation/) for framework-specific guides.

### Can I decrypt submissions on my server?

**Yes, using webhooks and the server-side SDK.**

Setup:
1. Configure a webhook URL in the VeilForms dashboard
2. We POST encrypted submissions to your endpoint in real-time
3. Use your private key to decrypt on your server
4. Process, store, or forward the decrypted data

Example (Node.js):
```javascript
const { VeilForms } = require('@veilforms/node');

app.post('/webhook', async (req, res) => {
  const submission = req.body;
  const decrypted = await VeilForms.decrypt(
    submission,
    yourPrivateKey
  );

  // Process decrypted data
  await saveToDatabase(decrypted);
  res.sendStatus(200);
});
```

This enables custom workflows while maintaining end-to-end encryption in transit.

### How do you handle PII detection without reading the data?

**PII detection happens client-side before encryption.**

The process:
1. User fills out the form in their browser
2. Our SDK scans for PII patterns (emails, phones, SSNs, credit cards)
3. PII is flagged and optionally stripped/masked
4. Then everything is encrypted
5. We receive encrypted data + metadata about PII detected (not the actual PII)

We never see the plaintext PII. The detection runs entirely in the user's browser.

This gives you compliance metadata without compromising encryption:
```json
{
  "encrypted_data": "...",
  "pii_detected": ["email", "phone"],
  "pii_locations": ["field_2", "field_5"]
}
```

## Billing & Support

### Do you offer refunds?

**Yes. 30-day money-back guarantee, no questions asked.**

Not satisfied? Email support@veilforms.com within 30 days for a full refund.

### What's included in the free tier?

- 100 submissions/month
- 1 form
- Client-side encryption
- Basic PII detection
- Email notifications
- Dashboard access

Perfect for testing or low-volume use cases. See [pricing](/pricing/) for full details.

### How do I get support?

- **Email:** support@veilforms.com (24-48 hour response)
- **Documentation:** [docs.veilforms.com](/docs/)
- **GitHub Issues:** For SDK bugs and feature requests
- **Enterprise:** Dedicated Slack channel for Pro/Enterprise plans

---

**Still have questions?** [Contact us](/contact/) or email hello@veilforms.com
