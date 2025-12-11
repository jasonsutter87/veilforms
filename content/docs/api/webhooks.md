---
title: "Webhooks"
description: "Receive real-time notifications when forms are submitted"
layout: "docs"
---

# Webhooks

Webhooks notify your server in real-time when submissions are received. Use them to trigger workflows, send notifications, or sync data.

<div class="callout info">
<strong>Encrypted Payloads:</strong> Webhook payloads contain encrypted data. You need your private key to decrypt submissions.
</div>

## Setting Up Webhooks

### Via Dashboard

1. Go to **Dashboard → Forms → [Your Form] → Settings**
2. Enter your **Webhook URL**
3. Click **Save**

### Via API

```bash
curl -X PATCH https://veilforms.com/api/forms/vf-abc123 \
  -H "Authorization: Bearer vf_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "settings": {
      "webhookUrl": "https://yoursite.com/api/veilforms-webhook"
    }
  }'
```

## Webhook Payload

When a submission is received, VeilForms sends a POST request to your webhook URL:

```json
{
  "event": "submission.created",
  "timestamp": 1699920000000,
  "form": {
    "id": "vf-abc123",
    "name": "Contact Form"
  },
  "submission": {
    "id": "vf-xyz789",
    "payload": {
      "encrypted": true,
      "version": "vf-e1",
      "data": "base64-encrypted-data...",
      "key": "base64-encrypted-aes-key...",
      "iv": "base64-initialization-vector..."
    },
    "timestamp": 1699920000000,
    "receivedAt": 1699920001000
  }
}
```

## Event Types

| Event | Description |
|-------|-------------|
| `submission.created` | New submission received |
| `submission.deleted` | Submission was deleted |
| `form.updated` | Form settings changed |
| `form.keys_rotated` | Encryption keys were rotated |

## Webhook Headers

Each webhook request includes these headers:

| Header | Description |
|--------|-------------|
| `Content-Type` | `application/json` |
| `X-VeilForms-Event` | Event type (e.g., `submission.created`) |
| `X-VeilForms-Signature` | HMAC signature for verification |
| `X-VeilForms-Timestamp` | Unix timestamp of the event |
| `X-VeilForms-Delivery-Id` | Unique ID for this delivery |

## Verifying Webhooks

Verify webhook signatures to ensure requests are from VeilForms:

### Node.js

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(`sha256=${expectedSignature}`)
  );
}

// Express middleware
app.post('/api/veilforms-webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-veilforms-signature'];
  const webhookSecret = process.env.VEILFORMS_WEBHOOK_SECRET;

  if (!verifyWebhook(req.body, signature, webhookSecret)) {
    return res.status(401).send('Invalid signature');
  }

  const event = JSON.parse(req.body);
  // Process event...

  res.status(200).send('OK');
});
```

### Python

```python
import hmac
import hashlib

def verify_webhook(payload: bytes, signature: str, secret: str) -> bool:
    expected = hmac.new(
        secret.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature, f'sha256={expected}')

# Flask example
@app.route('/api/veilforms-webhook', methods=['POST'])
def webhook():
    signature = request.headers.get('X-VeilForms-Signature')
    secret = os.environ['VEILFORMS_WEBHOOK_SECRET']

    if not verify_webhook(request.data, signature, secret):
        return 'Invalid signature', 401

    event = request.json
    # Process event...

    return 'OK', 200
```

## Processing Submissions

Decrypt the submission payload to access form data:

```javascript
import { decryptSubmission } from 'veilforms/core/encryption';
import fs from 'fs';

app.post('/api/veilforms-webhook', async (req, res) => {
  // Verify signature first (see above)

  const event = req.body;

  if (event.event === 'submission.created') {
    // Load your private key
    const privateKey = JSON.parse(
      fs.readFileSync('./keys/vf-abc123-private.json')
    );

    // Decrypt the submission
    const decrypted = await decryptSubmission(
      event.submission.payload,
      privateKey
    );

    console.log('New submission:', decrypted);
    // { name: 'John', message: 'Hello!' }

    // Trigger your workflow
    await sendNotificationEmail(decrypted);
    await saveToDatabase(event.submission.id, decrypted);
  }

  res.status(200).send('OK');
});
```

## Retry Policy

VeilForms retries failed webhook deliveries:

| Attempt | Delay |
|---------|-------|
| 1 | Immediate |
| 2 | 1 minute |
| 3 | 5 minutes |
| 4 | 30 minutes |
| 5 | 2 hours |
| 6 | 24 hours |

After 6 failed attempts, the webhook is marked as failed. Check your dashboard for delivery status.

### Success Criteria

A webhook is considered successful if your server returns:
- HTTP status `2xx`
- Within 30 seconds

### Failure Responses

| Status | Behavior |
|--------|----------|
| `2xx` | Success, no retry |
| `3xx` | Follows redirect, counts as attempt |
| `4xx` | Permanent failure (except 429), no retry |
| `429` | Rate limited, retries with backoff |
| `5xx` | Temporary failure, retries |
| Timeout | Temporary failure, retries |

## Webhook Secret

Get your webhook secret from the dashboard or API:

```bash
curl https://veilforms.com/api/forms/vf-abc123/webhook-secret \
  -H "Authorization: Bearer vf_live_xxx"
```

```json
{
  "secret": "whsec_abc123xyz789..."
}
```

### Rotating Secrets

```bash
curl -X POST https://veilforms.com/api/forms/vf-abc123/webhook-secret/rotate \
  -H "Authorization: Bearer vf_live_xxx"
```

The old secret remains valid for 24 hours to allow graceful migration.

## Testing Webhooks

### Send Test Event

```bash
curl -X POST https://veilforms.com/api/forms/vf-abc123/webhook/test \
  -H "Authorization: Bearer vf_live_xxx"
```

This sends a test `submission.created` event with sample data.

### Local Development

Use a tunnel service for local testing:

```bash
# ngrok
ngrok http 3000
# Use https://abc123.ngrok.io/api/veilforms-webhook

# localtunnel
lt --port 3000
# Use https://your-subdomain.loca.lt/api/veilforms-webhook
```

## Webhook Logs

View recent webhook deliveries:

```bash
curl https://veilforms.com/api/forms/vf-abc123/webhook/logs \
  -H "Authorization: Bearer vf_live_xxx"
```

```json
{
  "logs": [
    {
      "id": "del_abc123",
      "event": "submission.created",
      "timestamp": 1699920000000,
      "status": "success",
      "statusCode": 200,
      "duration": 145
    },
    {
      "id": "del_def456",
      "event": "submission.created",
      "timestamp": 1699910000000,
      "status": "failed",
      "statusCode": 500,
      "error": "Internal Server Error",
      "retryCount": 3
    }
  ]
}
```

## Example Integrations

### Slack Notification

```javascript
app.post('/api/veilforms-webhook', async (req, res) => {
  const event = req.body;

  if (event.event === 'submission.created') {
    const decrypted = await decryptSubmission(
      event.submission.payload,
      privateKey
    );

    await fetch(process.env.SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `New form submission!\n*Form:* ${event.form.name}\n*Message:* ${decrypted.message}`
      })
    });
  }

  res.status(200).send('OK');
});
```

### Email Notification

```javascript
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

app.post('/api/veilforms-webhook', async (req, res) => {
  const event = req.body;

  if (event.event === 'submission.created') {
    const decrypted = await decryptSubmission(
      event.submission.payload,
      privateKey
    );

    await resend.emails.send({
      from: 'forms@yoursite.com',
      to: 'team@yoursite.com',
      subject: `New submission: ${event.form.name}`,
      html: `<p><strong>Name:</strong> ${decrypted.name}</p>
             <p><strong>Message:</strong> ${decrypted.message}</p>`
    });
  }

  res.status(200).send('OK');
});
```

### Database Sync

```javascript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

app.post('/api/veilforms-webhook', async (req, res) => {
  const event = req.body;

  if (event.event === 'submission.created') {
    const decrypted = await decryptSubmission(
      event.submission.payload,
      privateKey
    );

    await prisma.submission.create({
      data: {
        id: event.submission.id,
        formId: event.form.id,
        data: decrypted, // Store decrypted in your own DB
        createdAt: new Date(event.submission.timestamp)
      }
    });
  }

  res.status(200).send('OK');
});
```

## Disabling Webhooks

Remove the webhook URL to disable:

```bash
curl -X PATCH https://veilforms.com/api/forms/vf-abc123 \
  -H "Authorization: Bearer vf_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{"settings": {"webhookUrl": null}}'
```

## Next Steps

- [Forms API](/docs/api/forms/) — Manage forms
- [Submissions API](/docs/api/submissions/) — Access submissions
- [Key Management](/docs/guides/key-management/) — Secure your keys
