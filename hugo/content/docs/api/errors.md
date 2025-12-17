---
title: "API Error Reference"
description: "Complete reference for VeilForms API error codes and handling"
type: "pages"
layout: "docs"
css: ["docs.css"]
---

# API Error Reference

This document covers all error responses from the VeilForms API and how to handle them.

## Error Response Format

All API errors follow a consistent JSON format:

```json
{
  "error": "error_code",
  "message": "Human-readable description",
  "details": {}
}
```

| Field | Type | Description |
|-------|------|-------------|
| `error` | string | Machine-readable error code |
| `message` | string | Human-readable error description |
| `details` | object | Additional error context (optional) |

## HTTP Status Codes

### 4xx Client Errors

| Status | Description |
|--------|-------------|
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Invalid or missing API key |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Resource already exists |
| 422 | Unprocessable Entity - Validation failed |
| 429 | Too Many Requests - Rate limit exceeded |

### 5xx Server Errors

| Status | Description |
|--------|-------------|
| 500 | Internal Server Error - Unexpected error |
| 502 | Bad Gateway - Upstream service error |
| 503 | Service Unavailable - Temporary outage |
| 504 | Gateway Timeout - Request timed out |

## Error Codes Reference

### Authentication Errors

#### `unauthorized`

**Status:** 401

**Cause:** Missing or invalid API key.

```json
{
  "error": "unauthorized",
  "message": "Invalid or missing API key"
}
```

**Resolution:**
- Verify your API key is correct
- Ensure the `Authorization` header format is `Bearer <api_key>`
- Check if the key has been revoked

```javascript
// Correct format
fetch('https://veilforms.com/api/forms', {
  headers: {
    'Authorization': 'Bearer vf_live_abc123'
  }
});
```

---
priority: 0.5

#### `forbidden`

**Status:** 403

**Cause:** API key lacks required permissions.

```json
{
  "error": "forbidden",
  "message": "API key does not have permission for this action",
  "details": {
    "required_permission": "submissions:delete"
  }
}
```

**Resolution:**
- Use a key with the required permissions
- Generate a new key with appropriate scope

---
priority: 0.5

#### `token_expired`

**Status:** 401

**Cause:** Session token has expired.

```json
{
  "error": "token_expired",
  "message": "Your session has expired. Please log in again."
}
```

**Resolution:**
- Re-authenticate to get a new token
- Implement token refresh logic

---
priority: 0.5

### Validation Errors

#### `validation_error`

**Status:** 422

**Cause:** Request body failed validation.

```json
{
  "error": "validation_error",
  "message": "Validation failed",
  "details": {
    "fields": {
      "name": "Name is required",
      "email": "Invalid email format"
    }
  }
}
```

**Resolution:**
- Check the `details.fields` object for specific issues
- Fix validation errors and retry

---
priority: 0.5

#### `invalid_json`

**Status:** 400

**Cause:** Request body is not valid JSON.

```json
{
  "error": "invalid_json",
  "message": "Request body must be valid JSON"
}
```

**Resolution:**
- Ensure `Content-Type: application/json` header is set
- Validate JSON syntax before sending

---
priority: 0.5

#### `missing_required_field`

**Status:** 400

**Cause:** Required field is missing from request.

```json
{
  "error": "missing_required_field",
  "message": "Required field 'name' is missing",
  "details": {
    "field": "name"
  }
}
```

---
priority: 0.5

#### `invalid_field_type`

**Status:** 400

**Cause:** Field value has wrong type.

```json
{
  "error": "invalid_field_type",
  "message": "Field 'encryption' must be a boolean",
  "details": {
    "field": "encryption",
    "expected": "boolean",
    "received": "string"
  }
}
```

---
priority: 0.5

### Resource Errors

#### `not_found`

**Status:** 404

**Cause:** Requested resource doesn't exist.

```json
{
  "error": "not_found",
  "message": "Form not found",
  "details": {
    "resource": "form",
    "id": "vf-nonexistent"
  }
}
```

**Resolution:**
- Verify the resource ID is correct
- Check if the resource was deleted

---
priority: 0.5

#### `already_exists`

**Status:** 409

**Cause:** Resource with same identifier already exists.

```json
{
  "error": "already_exists",
  "message": "A form with this name already exists",
  "details": {
    "resource": "form",
    "field": "name",
    "value": "Contact Form"
  }
}
```

---
priority: 0.5

#### `resource_deleted`

**Status:** 410

**Cause:** Resource was deleted.

```json
{
  "error": "resource_deleted",
  "message": "This submission has been deleted",
  "details": {
    "deleted_at": "2024-01-15T10:30:00Z"
  }
}
```

---
priority: 0.5

### Rate Limiting Errors

#### `rate_limited`

**Status:** 429

**Cause:** Too many requests in time window.

```json
{
  "error": "rate_limited",
  "message": "Rate limit exceeded. Try again in 60 seconds.",
  "details": {
    "limit": 60,
    "window": "1 minute",
    "retry_after": 60
  }
}
```

**Response Headers:**

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1699920060
Retry-After: 60
```

**Resolution:**
- Wait for `retry_after` seconds
- Implement exponential backoff
- Consider upgrading your plan

```javascript
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url, options);

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After') || 60;
      await new Promise(r => setTimeout(r, retryAfter * 1000));
      continue;
    }

    return response;
  }
  throw new Error('Max retries exceeded');
}
```

---
priority: 0.5

### Encryption Errors

#### `invalid_public_key`

**Status:** 400

**Cause:** Public key format is invalid.

```json
{
  "error": "invalid_public_key",
  "message": "Invalid public key format. Expected JWK.",
  "details": {
    "expected_format": "JWK (JSON Web Key)"
  }
}
```

---
priority: 0.5

#### `encryption_required`

**Status:** 400

**Cause:** Submission requires encryption but data wasn't encrypted.

```json
{
  "error": "encryption_required",
  "message": "This form requires encrypted submissions",
  "details": {
    "form_id": "vf-abc123"
  }
}
```

---
priority: 0.5

#### `decryption_failed`

**Status:** 400

**Cause:** Unable to decrypt submission (wrong key or corrupted data).

```json
{
  "error": "decryption_failed",
  "message": "Failed to decrypt submission. Check your private key.",
  "details": {
    "submission_id": "vf-xyz789"
  }
}
```

---
priority: 0.5

### Webhook Errors

#### `webhook_delivery_failed`

**Status:** 502

**Cause:** Webhook endpoint unreachable or returned error.

```json
{
  "error": "webhook_delivery_failed",
  "message": "Failed to deliver webhook",
  "details": {
    "url": "https://example.com/webhook",
    "status": 500,
    "attempts": 3
  }
}
```

---
priority: 0.5

#### `invalid_webhook_url`

**Status:** 400

**Cause:** Webhook URL is invalid or unreachable.

```json
{
  "error": "invalid_webhook_url",
  "message": "Webhook URL must be a valid HTTPS URL",
  "details": {
    "url": "http://example.com/webhook"
  }
}
```

---
priority: 0.5

### Server Errors

#### `internal_error`

**Status:** 500

**Cause:** Unexpected server error.

```json
{
  "error": "internal_error",
  "message": "An unexpected error occurred. Please try again.",
  "details": {
    "request_id": "req_abc123"
  }
}
```

**Resolution:**
- Retry the request
- Contact support with the `request_id`

---
priority: 0.5

#### `service_unavailable`

**Status:** 503

**Cause:** Service temporarily unavailable.

```json
{
  "error": "service_unavailable",
  "message": "Service temporarily unavailable. Please try again later.",
  "details": {
    "retry_after": 300
  }
}
```

---
priority: 0.5

## Error Handling Best Practices

### JavaScript

```javascript
async function apiRequest(endpoint, options = {}) {
  const response = await fetch(`https://veilforms.com/api${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    const error = await response.json();

    switch (error.error) {
      case 'unauthorized':
        // Redirect to login or refresh token
        handleAuthError();
        break;

      case 'rate_limited':
        // Wait and retry
        const retryAfter = error.details?.retry_after || 60;
        await sleep(retryAfter * 1000);
        return apiRequest(endpoint, options);

      case 'validation_error':
        // Show validation errors to user
        showValidationErrors(error.details.fields);
        break;

      case 'not_found':
        // Handle missing resource
        showNotFound(error.details.resource);
        break;

      default:
        // Generic error handling
        showError(error.message);
    }

    throw new ApiError(error);
  }

  return response.json();
}

class ApiError extends Error {
  constructor(errorData) {
    super(errorData.message);
    this.code = errorData.error;
    this.details = errorData.details;
  }
}
```

### Python

```python
import requests
from time import sleep

class VeilFormsError(Exception):
    def __init__(self, code, message, details=None):
        self.code = code
        self.message = message
        self.details = details or {}
        super().__init__(message)

def api_request(endpoint, method='GET', data=None, retries=3):
    url = f'https://veilforms.com/api{endpoint}'
    headers = {
        'Authorization': f'Bearer {API_KEY}',
        'Content-Type': 'application/json'
    }

    for attempt in range(retries):
        response = requests.request(
            method, url, headers=headers, json=data
        )

        if response.ok:
            return response.json()

        error = response.json()

        if error['error'] == 'rate_limited':
            retry_after = error.get('details', {}).get('retry_after', 60)
            sleep(retry_after)
            continue

        raise VeilFormsError(
            error['error'],
            error['message'],
            error.get('details')
        )

    raise VeilFormsError('max_retries', 'Max retries exceeded')
```

## Debugging Tips

1. **Check request_id**: Include in support tickets for faster debugging
2. **Enable debug mode**: Set `debug: true` in SDK initialization
3. **Inspect headers**: Rate limit headers show remaining quota
4. **Validate locally**: Test JSON payloads before sending

## Next Steps

- [Authentication](/docs/api/authentication/) — API key setup
- [Rate Limits](/docs/api/authentication/#rate-limits) — Request quotas
- [Troubleshooting](/docs/troubleshooting/) — Common issues
