---
title: "Forms API"
description: "API endpoints for managing forms"
type: "pages"
layout: "docs"
css: ["docs.css"]
priority: 0.5
---

# Forms API

Create, update, list, and delete forms programmatically.

## List Forms

<div class="endpoint-block">
  <div class="endpoint-header">
    <span class="method get">GET</span>
    <span class="endpoint-path">/api/forms</span>
  </div>
  <div class="endpoint-body">
    <p>List all forms in your account.</p>

**Example Request:**

```bash
curl https://veilforms.com/api/forms \
  -H "Authorization: Bearer vf_live_xxx"
```

**Response:**

```json
{
  "forms": [
    {
      "id": "vf-abc123",
      "name": "Contact Form",
      "createdAt": 1699920000000,
      "submissionCount": 142,
      "publicKey": {
        "kty": "RSA",
        "n": "0vx7agoebG...",
        "e": "AQAB"
      },
      "settings": {
        "encryption": true,
        "piiStrip": true
      }
    },
    {
      "id": "vf-def456",
      "name": "Feedback Form",
      "createdAt": 1699920100000,
      "submissionCount": 58,
      "publicKey": {...},
      "settings": {...}
    }
  ],
  "total": 2
}
```

  </div>
</div>

## Get Form

<div class="endpoint-block">
  <div class="endpoint-header">
    <span class="method get">GET</span>
    <span class="endpoint-path">/api/forms/{formId}</span>
  </div>
  <div class="endpoint-body">
    <p>Retrieve a single form by ID.</p>

**Example Request:**

```bash
curl https://veilforms.com/api/forms/vf-abc123 \
  -H "Authorization: Bearer vf_live_xxx"
```

**Response:**

```json
{
  "form": {
    "id": "vf-abc123",
    "name": "Contact Form",
    "createdAt": 1699920000000,
    "updatedAt": 1699930000000,
    "submissionCount": 142,
    "publicKey": {
      "kty": "RSA",
      "n": "0vx7agoebG...",
      "e": "AQAB"
    },
    "settings": {
      "encryption": true,
      "piiStrip": true,
      "webhookUrl": "https://yoursite.com/webhook",
      "allowedOrigins": ["https://yoursite.com"]
    },
    "embedCode": "<script src=\"https://veilforms.com/js/veilforms.min.js\"></script>\n<script>VeilForms.init('vf-abc123', {...});</script>"
  }
}
```

  </div>
</div>

## Create Form

<div class="endpoint-block">
  <div class="endpoint-header">
    <span class="method post">POST</span>
    <span class="endpoint-path">/api/forms</span>
  </div>
  <div class="endpoint-body">
    <p>Create a new form. You generate the form's RSA key pair yourself and send only the public key. VeilForms never creates, receives or stores private keys.</p>

<div class="callout warning">
<strong>Important:</strong> Keep the private key safe before you create the form. Nobody, including VeilForms, can recover it, and without it the form's submissions can't be decrypted.
</div>

**Generate the key pair** (browser or Node 18+; the same parameters the SDK encrypts with):

```javascript
const pair = await crypto.subtle.generateKey(
  { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
  true,
  ['encrypt', 'decrypt']
);
const publicKey = await crypto.subtle.exportKey('jwk', pair.publicKey);   // send this
const privateKey = await crypto.subtle.exportKey('jwk', pair.privateKey); // keep this
```

**Request Body:**

```json
{
  "name": "Contact Form",
  "publicKey": {
    "kty": "RSA",
    "n": "0vx7agoebG...",
    "e": "AQAB"
  },
  "settings": {
    "encryption": true,
    "piiStrip": true,
    "webhookUrl": "https://yoursite.com/webhook",
    "allowedOrigins": ["https://yoursite.com"]
  }
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Display name for the form |
| `publicKey` | object | Yes | RSA public key as a JWK (2048–4096 bits, `e` = `AQAB`). Requests containing private key fields are rejected |
| `settings.encryption` | boolean | No | Enable encryption (default: true) |
| `settings.piiStrip` | boolean | No | Strip PII (default: false) |
| `settings.webhookUrl` | string | No | URL to receive webhook notifications |
| `settings.allowedOrigins` | array | No | CORS origins (default: ["*"]) |

**Example Request:**

```bash
curl -X POST https://veilforms.com/api/forms \
  -H "Authorization: Bearer vf_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Contact Form",
    "publicKey": {"kty": "RSA", "n": "0vx7agoebG...", "e": "AQAB"},
    "settings": {
      "encryption": true,
      "piiStrip": true
    }
  }'
```

**Response:**

```json
{
  "form": {
    "id": "vf-abc123",
    "name": "Contact Form",
    "createdAt": 1699920000000,
    "publicKey": {
      "kty": "RSA",
      "n": "0vx7agoebG...",
      "e": "AQAB",
      "alg": "RSA-OAEP-256"
    },
    "settings": {
      "encryption": true,
      "piiStrip": true
    }
  }
}
```

  </div>
</div>

## Update Form

<div class="endpoint-block">
  <div class="endpoint-header">
    <span class="method post">PATCH</span>
    <span class="endpoint-path">/api/forms/{formId}</span>
  </div>
  <div class="endpoint-body">
    <p>Update form settings. Cannot update the form ID or keys (use key rotation for that).</p>

**Request Body:**

```json
{
  "name": "Updated Contact Form",
  "settings": {
    "piiStrip": true,
    "webhookUrl": "https://newsite.com/webhook"
  }
}
```

**Example Request:**

```bash
curl -X PATCH https://veilforms.com/api/forms/vf-abc123 \
  -H "Authorization: Bearer vf_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Contact Form",
    "settings": {
      "webhookUrl": "https://newsite.com/webhook"
    }
  }'
```

**Response:**

```json
{
  "form": {
    "id": "vf-abc123",
    "name": "Updated Contact Form",
    "updatedAt": 1699930000000,
    "settings": {
      "encryption": true,
      "piiStrip": true,
      "webhookUrl": "https://newsite.com/webhook"
    }
  }
}
```

  </div>
</div>

## Delete Form

<div class="endpoint-block">
  <div class="endpoint-header">
    <span class="method delete">DELETE</span>
    <span class="endpoint-path">/api/forms/{formId}</span>
  </div>
  <div class="endpoint-body">
    <p>Delete a form and all its submissions. This action is irreversible.</p>

<div class="callout warning">
<strong>Danger Zone:</strong> Deleting a form also deletes all submissions. Export your data first if needed.
</div>

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `confirm` | string | Yes | Must be `DELETE_FORM` |

**Example Request:**

```bash
curl -X DELETE "https://veilforms.com/api/forms/vf-abc123?confirm=DELETE_FORM" \
  -H "Authorization: Bearer vf_live_xxx"
```

**Response:**

```json
{
  "success": true,
  "deleted": {
    "formId": "vf-abc123",
    "submissionsDeleted": 142
  }
}
```

  </div>
</div>

## Rotate Keys

<div class="endpoint-block">
  <div class="endpoint-header">
    <span class="method post">POST</span>
    <span class="endpoint-path">/api/forms/{formId}/regenerate-keys</span>
  </div>
  <div class="endpoint-body">
    <p>Replace a form's public key with a new one you generated (same as for Create Form). New submissions use the new key; old submissions stay encrypted with the old one.</p>

<div class="callout info">
<strong>Keep your old private key.</strong> You'll need it to decrypt submissions made before the rotation.
</div>

**Example Request:**

```bash
curl -X POST https://veilforms.com/api/forms/vf-abc123/regenerate-keys \
  -H "Authorization: Bearer vf_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{"publicKey": {"kty": "RSA", "n": "NEW_KEY...", "e": "AQAB"}}'
```

**Response:**

```json
{
  "form": {
    "id": "vf-abc123",
    "publicKey": {
      "kty": "RSA",
      "n": "NEW_KEY...",
      "e": "AQAB",
      "alg": "RSA-OAEP-256"
    },
    "keyRotatedAt": "2026-11-01T12:00:00.000Z"
  },
  "warning": "New submissions use the new key. Keep your old private key: earlier submissions still need it."
}
```

  </div>
</div>

## Form Statistics

<div class="endpoint-block">
  <div class="endpoint-header">
    <span class="method get">GET</span>
    <span class="endpoint-path">/api/forms/{formId}/stats</span>
  </div>
  <div class="endpoint-body">
    <p>Get submission statistics for a form.</p>

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `period` | string | No | `day`, `week`, `month`, `year` (default: `month`) |

**Example Request:**

```bash
curl "https://veilforms.com/api/forms/vf-abc123/stats?period=week" \
  -H "Authorization: Bearer vf_live_xxx"
```

**Response:**

```json
{
  "formId": "vf-abc123",
  "period": "week",
  "stats": {
    "totalSubmissions": 142,
    "periodSubmissions": 23,
    "avgPerDay": 3.3,
    "timeline": [
      { "date": "2024-01-01", "count": 5 },
      { "date": "2024-01-02", "count": 3 },
      { "date": "2024-01-03", "count": 4 },
      { "date": "2024-01-04", "count": 2 },
      { "date": "2024-01-05", "count": 6 },
      { "date": "2024-01-06", "count": 1 },
      { "date": "2024-01-07", "count": 2 }
    ]
  }
}
```

  </div>
</div>

## Error Responses

### 404 Not Found

```json
{
  "error": "not_found",
  "message": "Form not found"
}
```

### 400 Bad Request

```json
{
  "error": "bad_request",
  "message": "Invalid form settings",
  "details": {
    "webhookUrl": "Must be a valid HTTPS URL"
  }
}
```

### 409 Conflict

```json
{
  "error": "conflict",
  "message": "A form with this name already exists"
}
```

## SDK Integration

After creating a form via API, integrate with the SDK:

```javascript
// privateKey from the key pair you generated before POST /api/forms
const { form } = response;

// Store the private key securely (your server/secrets manager)
saveToSecretsManager(form.id, privateKey);

// Generate embed code for client
const embedCode = `
<script src="https://veilforms.com/js/veilforms.min.js"></script>
<script>
  VeilForms.init('${form.id}', {
    publicKey: ${JSON.stringify(form.publicKey)},
    encryption: true
  });
</script>
`;
```

## Next Steps

- [Submissions API](/docs/api/submissions/) — Manage submissions
- [Webhooks](/docs/api/webhooks/) — Real-time notifications
- [Authentication](/docs/api/authentication/) — API keys
