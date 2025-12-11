---
title: "Submissions API"
description: "API endpoints for managing form submissions"
layout: "docs"
---

# Submissions API

Retrieve, list, and delete form submissions. All submission data returned by the API is **encrypted** — you must decrypt it client-side using your private key.

<div class="callout info">
<strong>Client-Side Decryption Required:</strong> The API returns encrypted payloads. You need your form's private key to decrypt submission data. We cannot decrypt it for you.
</div>

## Submit a Form

<div class="endpoint-block">
  <div class="endpoint-header">
    <span class="method post">POST</span>
    <span class="endpoint-path">/api/submit</span>
  </div>
  <div class="endpoint-body">
    <p>Submit encrypted form data. This endpoint is called by the VeilForms SDK but can also be used directly.</p>

**Request Body:**

```json
{
  "formId": "vf-abc123",
  "submissionId": "vf-xyz789",
  "payload": {
    "encrypted": true,
    "version": "vf-e1",
    "data": "base64-encrypted-data...",
    "key": "base64-encrypted-aes-key...",
    "iv": "base64-initialization-vector..."
  },
  "timestamp": 1699920000000,
  "meta": {
    "sdk": "veilforms-js",
    "version": "1.0.0"
  }
}
```

**Response:**

```json
{
  "success": true,
  "submissionId": "vf-xyz789",
  "timestamp": 1699920000000
}
```

  </div>
</div>

## List Submissions

<div class="endpoint-block">
  <div class="endpoint-header">
    <span class="method get">GET</span>
    <span class="endpoint-path">/api/submissions</span>
  </div>
  <div class="endpoint-body">
    <p>List submissions for a form. Returns encrypted payloads.</p>

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `formId` | string | Yes | The form ID |
| `limit` | integer | No | Max results (default: 50, max: 100) |
| `offset` | integer | No | Pagination offset (default: 0) |

**Example Request:**

```bash
curl "https://veilforms.com/api/submissions?formId=vf-abc123&limit=10" \
  -H "Authorization: Bearer vf_live_xxx"
```

**Response:**

```json
{
  "formId": "vf-abc123",
  "submissions": [
    {
      "submissionId": "vf-xyz789",
      "payload": {
        "encrypted": true,
        "version": "vf-e1",
        "data": "base64...",
        "key": "base64...",
        "iv": "base64..."
      },
      "timestamp": 1699920000000,
      "receivedAt": 1699920001000,
      "meta": {
        "sdk": "veilforms-js",
        "version": "1.0.0"
      }
    }
  ],
  "total": 142,
  "limit": 10,
  "offset": 0
}
```

  </div>
</div>

## Get Single Submission

<div class="endpoint-block">
  <div class="endpoint-header">
    <span class="method get">GET</span>
    <span class="endpoint-path">/api/submissions/{submissionId}</span>
  </div>
  <div class="endpoint-body">
    <p>Retrieve a single submission by ID.</p>

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `formId` | string | Yes | The form ID |

**Example Request:**

```bash
curl "https://veilforms.com/api/submissions/vf-xyz789?formId=vf-abc123" \
  -H "Authorization: Bearer vf_live_xxx"
```

**Response:**

```json
{
  "submission": {
    "submissionId": "vf-xyz789",
    "payload": {
      "encrypted": true,
      "version": "vf-e1",
      "data": "base64...",
      "key": "base64...",
      "iv": "base64..."
    },
    "timestamp": 1699920000000,
    "receivedAt": 1699920001000
  }
}
```

  </div>
</div>

## Delete Submission

<div class="endpoint-block">
  <div class="endpoint-header">
    <span class="method delete">DELETE</span>
    <span class="endpoint-path">/api/submissions/{submissionId}</span>
  </div>
  <div class="endpoint-body">
    <p>Permanently delete a submission.</p>

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `formId` | string | Yes | The form ID |

**Example Request:**

```bash
curl -X DELETE "https://veilforms.com/api/submissions/vf-xyz789?formId=vf-abc123" \
  -H "Authorization: Bearer vf_live_xxx"
```

**Response:**

```json
{
  "success": true,
  "deleted": "vf-xyz789"
}
```

  </div>
</div>

## Decrypting Submissions

Submissions are encrypted. Here's how to decrypt them:

### JavaScript (Browser)

```javascript
import { decryptSubmission } from 'veilforms/core/encryption';

// Your private key (from localStorage or secure storage)
const privateKey = JSON.parse(localStorage.getItem('veilforms_private_keys'))['vf-abc123'];

// Encrypted submission from API
const encrypted = submission.payload;

// Decrypt in browser
const decrypted = await decryptSubmission(encrypted, privateKey);
console.log(decrypted);
// { name: "John", message: "Hello!" }
```

### Node.js (Server-Side)

```javascript
import { decryptSubmission } from 'veilforms/core/encryption';
import fs from 'fs';

// Load your private key from secure storage
const privateKey = JSON.parse(fs.readFileSync('./private-key.json'));

// Fetch submissions from API
const response = await fetch('https://veilforms.com/api/submissions?formId=vf-abc123', {
  headers: { 'Authorization': 'Bearer vf_live_xxx' }
});
const { submissions } = await response.json();

// Decrypt each submission
for (const sub of submissions) {
  const decrypted = await decryptSubmission(sub.payload, privateKey);
  console.log(sub.submissionId, decrypted);
}
```

## Export All Submissions

<div class="endpoint-block">
  <div class="endpoint-header">
    <span class="method get">GET</span>
    <span class="endpoint-path">/api/submissions/export</span>
  </div>
  <div class="endpoint-body">
    <p>Export all submissions for data portability (GDPR). Returns encrypted data.</p>

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `formId` | string | Yes | The form ID |
| `format` | string | No | `json` (default) or `csv` |

**Example Request:**

```bash
curl "https://veilforms.com/api/submissions/export?formId=vf-abc123&format=json" \
  -H "Authorization: Bearer vf_live_xxx"
```

  </div>
</div>

## Purge All Submissions

<div class="endpoint-block">
  <div class="endpoint-header">
    <span class="method delete">DELETE</span>
    <span class="endpoint-path">/api/submissions</span>
  </div>
  <div class="endpoint-body">
    <p>Delete ALL submissions for a form. This action is irreversible.</p>

<div class="callout warning">
<strong>Danger Zone:</strong> This permanently deletes all submissions. Use with extreme caution.
</div>

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `formId` | string | Yes | The form ID |
| `confirm` | string | Yes | Must be `DELETE_ALL_SUBMISSIONS` |

**Example Request:**

```bash
curl -X DELETE "https://veilforms.com/api/submissions?formId=vf-abc123&confirm=DELETE_ALL_SUBMISSIONS" \
  -H "Authorization: Bearer vf_live_xxx"
```

**Response:**

```json
{
  "success": true,
  "deleted": 142
}
```

  </div>
</div>
