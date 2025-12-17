---
title: "API Keys Management"
description: "Create, list, and revoke API keys programmatically"
type: "pages"
layout: "docs"
css: ["docs.css"]
priority: 0.5
---

# API Keys Management

Programmatically manage API keys for your VeilForms account. Create keys with specific permissions, list existing keys, and revoke keys when needed.

## List API Keys

<div class="endpoint-block">
  <div class="endpoint-header">
    <span class="method get">GET</span>
    <span class="endpoint-path">/api/api-keys</span>
  </div>
  <div class="endpoint-body">
    <p>List all API keys for the authenticated user. The actual key values are not returned (they are only shown once at creation).</p>

**Example Request:**

```bash
curl https://veilforms.com/api/api-keys \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**

```json
{
  "keys": [
    {
      "id": "a1b2c3d4e5f6...",
      "name": "Production Server",
      "prefix": "vf_abc1...",
      "permissions": ["forms:read", "submissions:read"],
      "createdAt": "2024-01-15T10:30:00Z",
      "lastUsed": "2024-01-20T14:22:00Z"
    },
    {
      "id": "x9y8z7w6v5u4...",
      "name": "Analytics Integration",
      "prefix": "vf_xyz9...",
      "permissions": ["submissions:read"],
      "createdAt": "2024-01-10T08:00:00Z",
      "lastUsed": null
    }
  ],
  "total": 2
}
```

  </div>
</div>

## Create API Key

<div class="endpoint-block">
  <div class="endpoint-header">
    <span class="method post">POST</span>
    <span class="endpoint-path">/api/api-keys</span>
  </div>
  <div class="endpoint-body">
    <p>Create a new API key with specified permissions.</p>

<div class="callout warning">
<strong>Important:</strong> The full API key is only returned once in the response. Save it immediately and securely. VeilForms does not store the raw key and cannot recover it.
</div>

**Request Body:**

```json
{
  "name": "My API Key",
  "permissions": ["forms:read", "submissions:read"]
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Display name for the key (max 50 chars) |
| `permissions` | array | No | Permissions to grant (default: all permissions) |

**Valid Permissions:**

| Permission | Description |
|------------|-------------|
| `forms:read` | List and view form configurations |
| `forms:write` | Create, update, delete forms |
| `submissions:read` | List and fetch submissions (encrypted) |
| `submissions:delete` | Delete submissions |

**Example Request:**

```bash
curl -X POST https://veilforms.com/api/api-keys \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production Server",
    "permissions": ["forms:read", "submissions:read"]
  }'
```

**Response:**

```json
{
  "key": {
    "id": "a1b2c3d4e5f6...",
    "name": "Production Server",
    "key": "vf_abc123xyz789...",
    "permissions": ["forms:read", "submissions:read"],
    "createdAt": "2024-01-15T10:30:00Z"
  },
  "warning": "Save this API key now! This is the only time it will be shown. We cannot recover it."
}
```

  </div>
</div>

## Revoke API Key

<div class="endpoint-block">
  <div class="endpoint-header">
    <span class="method delete">DELETE</span>
    <span class="endpoint-path">/api/api-keys/{keyId}</span>
  </div>
  <div class="endpoint-body">
    <p>Revoke an API key. The key is immediately invalidated and cannot be recovered.</p>

**Path Parameters:**

| Parameter | Description |
|-----------|-------------|
| `keyId` | The ID of the API key to revoke (returned when the key was created) |

**Example Request:**

```bash
curl -X DELETE https://veilforms.com/api/api-keys/a1b2c3d4e5f6 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**

```json
{
  "success": true,
  "revoked": "a1b2c3d4e5f6..."
}
```

  </div>
</div>

## Limits

| Plan | Max API Keys |
|------|--------------|
| Free | 5 |
| Starter | 10 |
| Pro | 25 |
| Enterprise | Unlimited |

## Error Responses

### 400 Bad Request

```json
{
  "error": "Key name is required"
}
```

```json
{
  "error": "Invalid permission: invalid:permission"
}
```

```json
{
  "error": "Maximum number of API keys reached (5). Delete an existing key first."
}
```

### 401 Unauthorized

```json
{
  "error": "Invalid or missing authentication"
}
```

### 403 Forbidden

```json
{
  "error": "Access denied"
}
```

Returned when attempting to revoke a key that belongs to another user.

### 404 Not Found

```json
{
  "error": "API key not found"
}
```

### 429 Too Many Requests

```json
{
  "error": "Too many requests. Please try again later.",
  "retryAfter": 60
}
```

Rate limit: 20 requests per minute.

## Security Best Practices

1. **Use scoped permissions** - Only grant the permissions your integration needs
2. **Create separate keys** - Use different keys for different integrations
3. **Rotate keys regularly** - Delete and recreate keys periodically
4. **Monitor usage** - Check the `lastUsed` timestamp in the key list
5. **Store securely** - Use environment variables or a secrets manager

## Example: Creating a Read-Only Key

```javascript
const response = await fetch('https://veilforms.com/api/api-keys', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'Read-Only Analytics',
    permissions: ['forms:read', 'submissions:read']
  })
});

const { key, warning } = await response.json();

// Store key.key securely - it won't be shown again!
console.log('New API Key:', key.key);
console.log('Warning:', warning);
```

## Next Steps

- [Audit Logs](/docs/api/audit-logs/) - Track API activity
- [Authentication](/docs/api/authentication/) - Using API keys
- [Forms API](/docs/api/forms/) - Manage forms
