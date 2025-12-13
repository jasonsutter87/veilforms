---
title: "Using Webhooks with Encrypted Form Submissions"
description: "Learn how to receive real-time notifications for encrypted form submissions and decrypt data in your webhook handler for custom workflows."
date: 2025-11-15
category: "Tutorial"
author: "VeilForms Team"
readTime: 10
tags: ["webhooks", "encryption", "integration", "api"]
type: "blog"
css: ["blog.css"]
---

Webhooks let you receive real-time notifications when forms are submitted. But when submissions are encrypted, how do you process them? This guide covers webhook integration with client-side encrypted forms.

## How Webhooks Work with Encrypted Data

When a form is submitted:

1. Data is encrypted in the user's browser
2. Encrypted payload is sent to VeilForms
3. We store the encrypted submission
4. We send a webhook to your endpoint
5. You decrypt the data with your private key

The webhook payload includes encrypted data—we never decrypt it.

## Setting Up Webhooks

### 1. Configure in Dashboard

1. Go to your form settings
2. Navigate to "Webhooks"
3. Add your endpoint URL
4. Select events to trigger webhooks
5. Save and copy your webhook secret

### 2. Webhook Payload Structure

```json
{
  "event": "submission.created",
  "timestamp": "2024-11-15T10:30:00Z",
  "form": {
    "id": "contact_form",
    "name": "Contact Form"
  },
  "submission": {
    "id": "sub_abc123",
    "createdAt": "2024-11-15T10:30:00Z",
    "encrypted": true,
    "data": {
      "ciphertext": "base64-encoded-encrypted-data",
      "encryptedKey": "base64-encoded-aes-key",
      "iv": "base64-encoded-iv",
      "version": "vf-e1"
    }
  }
}
```

### 3. Verify Webhook Signature

Always verify that webhooks come from VeilForms:

```javascript
import crypto from 'crypto';

function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// In your webhook handler
app.post('/webhooks/veilforms', (req, res) => {
  const signature = req.headers['x-veilforms-signature'];
  const isValid = verifyWebhookSignature(
    JSON.stringify(req.body),
    signature,
    process.env.WEBHOOK_SECRET
  );

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Process webhook...
});
```

## Decrypting Webhook Data

### Node.js Example

```javascript
import crypto from 'crypto';

async function decryptSubmission(encryptedData, privateKeyPem) {
  // Import private key
  const privateKey = crypto.createPrivateKey(privateKeyPem);

  // Decrypt the AES key using RSA
  const encryptedKey = Buffer.from(encryptedData.encryptedKey, 'base64');
  const aesKey = crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256'
    },
    encryptedKey
  );

  // Decrypt the data using AES-GCM
  const ciphertext = Buffer.from(encryptedData.ciphertext, 'base64');
  const iv = Buffer.from(encryptedData.iv, 'base64');

  // AES-GCM tag is last 16 bytes of ciphertext
  const tag = ciphertext.slice(-16);
  const encryptedContent = ciphertext.slice(0, -16);

  const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encryptedContent);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return JSON.parse(decrypted.toString('utf8'));
}

// Usage in webhook handler
app.post('/webhooks/veilforms', async (req, res) => {
  // Verify signature first...

  const { submission } = req.body;

  if (submission.encrypted) {
    const decryptedData = await decryptSubmission(
      submission.data,
      process.env.PRIVATE_KEY
    );

    console.log('Decrypted submission:', decryptedData);
    // Process decrypted data...
  }

  res.status(200).json({ received: true });
});
```

### Python Example

```python
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import base64
import json

def decrypt_submission(encrypted_data, private_key_pem):
    # Load private key
    private_key = serialization.load_pem_private_key(
        private_key_pem.encode(),
        password=None
    )

    # Decrypt AES key with RSA
    encrypted_key = base64.b64decode(encrypted_data['encryptedKey'])
    aes_key = private_key.decrypt(
        encrypted_key,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None
        )
    )

    # Decrypt data with AES-GCM
    ciphertext = base64.b64decode(encrypted_data['ciphertext'])
    iv = base64.b64decode(encrypted_data['iv'])

    aesgcm = AESGCM(aes_key)
    decrypted = aesgcm.decrypt(iv, ciphertext, None)

    return json.loads(decrypted.decode('utf-8'))

# Flask webhook handler
@app.route('/webhooks/veilforms', methods=['POST'])
def handle_webhook():
    # Verify signature first...

    data = request.json
    submission = data['submission']

    if submission.get('encrypted'):
        decrypted = decrypt_submission(
            submission['data'],
            os.environ['PRIVATE_KEY']
        )
        print('Decrypted:', decrypted)
        # Process decrypted data...

    return jsonify({'received': True})
```

## Common Webhook Patterns

### Email Notification

Send yourself an email when forms are submitted:

```javascript
app.post('/webhooks/veilforms', async (req, res) => {
  const { submission, form } = req.body;
  const decrypted = await decryptSubmission(submission.data, privateKey);

  await sendEmail({
    to: 'you@example.com',
    subject: `New ${form.name} submission`,
    body: `
      Name: ${decrypted.name}
      Email: ${decrypted.email}
      Message: ${decrypted.message}

      Submission ID: ${submission.id}
    `
  });

  res.status(200).json({ received: true });
});
```

### CRM Integration

Add contacts to your CRM:

```javascript
app.post('/webhooks/veilforms', async (req, res) => {
  const { submission } = req.body;
  const decrypted = await decryptSubmission(submission.data, privateKey);

  await crm.createContact({
    email: decrypted.email,
    name: decrypted.name,
    source: 'Website Contact Form',
    metadata: {
      submissionId: submission.id,
      message: decrypted.message
    }
  });

  res.status(200).json({ received: true });
});
```

### Slack Notification

```javascript
app.post('/webhooks/veilforms', async (req, res) => {
  const { submission, form } = req.body;
  const decrypted = await decryptSubmission(submission.data, privateKey);

  await fetch(process.env.SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `New submission on ${form.name}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*New ${form.name} Submission*`
          }
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Name:* ${decrypted.name}` },
            { type: 'mrkdwn', text: `*Email:* ${decrypted.email}` }
          ]
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Message:*\n${decrypted.message}`
          }
        }
      ]
    })
  });

  res.status(200).json({ received: true });
});
```

### Database Storage

Store decrypted data in your own database:

```javascript
app.post('/webhooks/veilforms', async (req, res) => {
  const { submission, form } = req.body;
  const decrypted = await decryptSubmission(submission.data, privateKey);

  await db.query(
    `INSERT INTO submissions (id, form_id, name, email, message, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      submission.id,
      form.id,
      decrypted.name,
      decrypted.email,
      decrypted.message,
      submission.createdAt
    ]
  );

  res.status(200).json({ received: true });
});
```

## Error Handling

### Retry Logic

VeilForms retries failed webhooks with exponential backoff:
- 1st retry: 1 minute
- 2nd retry: 5 minutes
- 3rd retry: 30 minutes
- 4th retry: 2 hours
- 5th retry: 24 hours

Return a 2xx status to prevent retries.

### Handle Decryption Errors

```javascript
app.post('/webhooks/veilforms', async (req, res) => {
  try {
    const { submission } = req.body;
    const decrypted = await decryptSubmission(submission.data, privateKey);
    // Process...
    res.status(200).json({ received: true });
  } catch (error) {
    if (error.message.includes('decrypt')) {
      // Decryption failed - log and don't retry
      console.error('Decryption failed:', submission.id);
      res.status(200).json({ received: true, error: 'decryption_failed' });
    } else {
      // Other error - retry
      res.status(500).json({ error: error.message });
    }
  }
});
```

## Security Best Practices

1. **Always verify signatures** before processing
2. **Use HTTPS** for your webhook endpoint
3. **Store private keys securely** (environment variables, secret manager)
4. **Don't log decrypted data** in production
5. **Implement idempotency** (handle duplicate webhooks)
6. **Respond quickly** (decrypt async if needed)

---

Webhooks turn encrypted forms into powerful workflows. The data stays protected in transit and at rest—you only decrypt it when you need it, in your own infrastructure.

Need help setting up webhooks? Check our [API documentation](/docs/api/webhooks/) or [contact support](/contact/).
