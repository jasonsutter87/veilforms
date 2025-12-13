---
title: "API Authentication"
description: "Authenticate with the VeilForms API"
type: "pages"
layout: "docs"
css: ["docs.css"]
priority: 0.5
---

# API Authentication

The VeilForms API uses Bearer token authentication. All API requests must include your API key in the `Authorization` header.

## Getting Your API Key

1. Log in to your [VeilForms Dashboard](https://veilforms.com/dashboard)
2. Navigate to **Settings → API Keys**
3. Click **Generate New Key**
4. Copy and securely store your key

<div class="callout warning">
<strong>Keep your API key secret.</strong> It provides access to your encrypted submissions. While submissions remain encrypted (you still need your private key to decrypt), the API key allows listing and deleting data.
</div>

## Making Authenticated Requests

Include your API key in the `Authorization` header:

```bash
curl https://veilforms.com/api/forms \
  -H "Authorization: Bearer vf_live_abc123xyz789"
```

### JavaScript Example

```javascript
const response = await fetch('https://veilforms.com/api/forms', {
  headers: {
    'Authorization': 'Bearer vf_live_abc123xyz789',
    'Content-Type': 'application/json'
  }
});

const data = await response.json();
```

### Python Example

```python
import requests

headers = {
    'Authorization': 'Bearer vf_live_abc123xyz789',
    'Content-Type': 'application/json'
}

response = requests.get('https://veilforms.com/api/forms', headers=headers)
data = response.json()
```

## API Key Types

| Key Prefix | Environment | Use Case |
|------------|-------------|----------|
| `vf_live_` | Production | Live forms, real submissions |
| `vf_test_` | Sandbox | Testing, development |

Test keys only access test-mode forms and don't affect production data.

## Key Permissions

API keys can be scoped to specific permissions:

| Permission | Description |
|------------|-------------|
| `forms:read` | List and view form configurations |
| `forms:write` | Create, update, delete forms |
| `submissions:read` | List and fetch submissions (encrypted) |
| `submissions:delete` | Delete submissions |

Default keys have all permissions. Create restricted keys for specific integrations.

## Rate Limits

| Plan | Requests/minute | Requests/day |
|------|-----------------|--------------|
| Free | 60 | 1,000 |
| Pro | 300 | 10,000 |
| Team | 600 | 50,000 |
| Enterprise | Custom | Custom |

Rate limit headers are included in all responses:

```
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 299
X-RateLimit-Reset: 1699920000
```

## Error Responses

### 401 Unauthorized

```json
{
  "error": "unauthorized",
  "message": "Invalid or missing API key"
}
```

### 403 Forbidden

```json
{
  "error": "forbidden",
  "message": "API key does not have permission for this action"
}
```

### 429 Too Many Requests

```json
{
  "error": "rate_limited",
  "message": "Rate limit exceeded",
  "retry_after": 60
}
```

## Security Best Practices

1. **Never expose API keys in client-side code** — Use server-side requests only
2. **Use environment variables** — Don't hardcode keys in source code
3. **Rotate keys regularly** — Generate new keys periodically
4. **Use minimum permissions** — Create scoped keys for specific integrations
5. **Monitor usage** — Check API logs for unexpected activity

## Revoking Keys

To revoke an API key:

1. Go to **Settings → API Keys** in your dashboard
2. Find the key to revoke
3. Click **Revoke**

Revoked keys are immediately invalidated. All requests using that key will return `401 Unauthorized`.
