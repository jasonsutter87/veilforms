---
title: "Audit Logs API"
description: "Track and review account activity for compliance and debugging"
type: "pages"
layout: "docs"
css: ["docs.css"]
priority: 0.5
---

# Audit Logs API

VeilForms automatically logs important actions in your account. Use the Audit Logs API to retrieve these logs for compliance reporting, debugging, or security monitoring.

## List Audit Logs

<div class="endpoint-block">
  <div class="endpoint-header">
    <span class="method get">GET</span>
    <span class="endpoint-path">/api/audit-logs</span>
  </div>
  <div class="endpoint-body">
    <p>Retrieve audit logs for your account with optional filtering and pagination.</p>

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | integer | No | Max entries to return (default: 50, max: 100) |
| `offset` | integer | No | Starting position for pagination (default: 0) |
| `event` | string | No | Filter by event type or category |
| `formId` | string | No | Filter logs for a specific form |

**Example Request:**

```bash
curl "https://veilforms.com/api/audit-logs?limit=20&offset=0" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**

```json
{
  "logs": [
    {
      "id": "audit_1705312200_abc123",
      "userId": "user_xyz789",
      "event": "form.created",
      "details": {
        "formId": "vf_abc123",
        "formName": "Contact Form"
      },
      "meta": {
        "ip": "192.168.1.1",
        "userAgent": "Mozilla/5.0...",
        "region": "US"
      },
      "timestamp": "2024-01-15T10:30:00Z"
    },
    {
      "id": "audit_1705311000_def456",
      "userId": "user_xyz789",
      "event": "submission.received",
      "details": {
        "formId": "vf_abc123",
        "submissionId": "sub_def456",
        "encrypted": true
      },
      "meta": {
        "ip": "10.0.0.1",
        "userAgent": "VeilForms SDK/1.0",
        "region": "GB"
      },
      "timestamp": "2024-01-15T10:10:00Z"
    }
  ],
  "total": 142,
  "limit": 20,
  "offset": 0
}
```

  </div>
</div>

## Filter by Event Type

<div class="endpoint-block">
  <div class="endpoint-header">
    <span class="method get">GET</span>
    <span class="endpoint-path">/api/audit-logs?event={eventType}</span>
  </div>
  <div class="endpoint-body">
    <p>Filter logs by a specific event type or category prefix.</p>

**Example - Filter by exact event:**

```bash
curl "https://veilforms.com/api/audit-logs?event=form.created" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Example - Filter by category:**

```bash
# Get all form-related events
curl "https://veilforms.com/api/audit-logs?event=form" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

  </div>
</div>

## Get Form-Specific Logs

<div class="endpoint-block">
  <div class="endpoint-header">
    <span class="method get">GET</span>
    <span class="endpoint-path">/api/audit-logs?formId={formId}</span>
  </div>
  <div class="endpoint-body">
    <p>Retrieve all audit logs related to a specific form. You must own the form to access its logs.</p>

**Example Request:**

```bash
curl "https://veilforms.com/api/audit-logs?formId=vf_abc123" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**

```json
{
  "logs": [
    {
      "id": "audit_1705312200_abc123",
      "userId": "user_xyz789",
      "event": "form.updated",
      "details": {
        "formId": "vf_abc123",
        "changes": {
          "name": "Updated Contact Form",
          "webhookUrl": "https://example.com/webhook"
        }
      },
      "meta": {
        "ip": "192.168.1.1",
        "userAgent": "Mozilla/5.0..."
      },
      "timestamp": "2024-01-15T14:30:00Z"
    },
    {
      "id": "audit_1705312100_xyz789",
      "userId": "user_xyz789",
      "event": "form.created",
      "details": {
        "formId": "vf_abc123",
        "formName": "Contact Form"
      },
      "meta": {
        "ip": "192.168.1.1"
      },
      "timestamp": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 2
}
```

  </div>
</div>

## Event Types

### Form Events

| Event | Description |
|-------|-------------|
| `form.created` | A new form was created |
| `form.updated` | Form settings were modified |
| `form.deleted` | A form was deleted |
| `form.keys_regenerated` | Encryption keys were rotated |

### Submission Events

| Event | Description |
|-------|-------------|
| `submission.received` | A new submission was received |
| `submission.deleted` | A single submission was deleted |
| `submissions.bulk_deleted` | Multiple submissions were deleted (retention policy) |

### Authentication Events

| Event | Description |
|-------|-------------|
| `user.registered` | New user registration |
| `user.login` | Successful login |
| `user.login_failed` | Failed login attempt |
| `user.password_reset` | Password was reset |
| `user.email_verified` | Email address was verified |

### API Key Events

| Event | Description |
|-------|-------------|
| `api_key.created` | New API key was created |
| `api_key.revoked` | API key was revoked |
| `api_key.used` | API key was used for authentication |

### Settings Events

| Event | Description |
|-------|-------------|
| `settings.updated` | Account settings were updated |
| `branding.updated` | Branding settings were changed |
| `retention.updated` | Data retention settings were modified |

## Audit Log Entry Structure

```json
{
  "id": "audit_1705312200_abc123",
  "userId": "user_xyz789",
  "event": "form.created",
  "details": {
    "formId": "vf_abc123",
    "formName": "Contact Form",
    "...": "event-specific fields"
  },
  "meta": {
    "ip": "192.168.1.1",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)...",
    "region": "US",
    "origin": "https://yourdomain.com"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

| Field | Description |
|-------|-------------|
| `id` | Unique identifier for the log entry |
| `userId` | User who performed the action |
| `event` | Event type (see Event Types above) |
| `details` | Event-specific information |
| `meta.ip` | IP address of the request |
| `meta.userAgent` | Browser/client user agent (truncated to 200 chars) |
| `meta.region` | Geographic region (country code) |
| `meta.origin` | Origin of the request |
| `timestamp` | ISO 8601 timestamp |

## Retention

Audit logs are retained for:

| Plan | Retention Period |
|------|------------------|
| Free | 30 days |
| Starter | 90 days |
| Pro | 1 year |
| Enterprise | Custom |

A maximum of 1,000 entries are stored per user.

## Error Responses

### 401 Unauthorized

```json
{
  "error": "Invalid or missing authentication"
}
```

### 404 Not Found

```json
{
  "error": "Form not found or access denied"
}
```

Returned when requesting logs for a form you don't own.

### 405 Method Not Allowed

```json
{
  "error": "Method not allowed"
}
```

Only GET requests are supported.

### 429 Too Many Requests

```json
{
  "error": "Too many requests. Please try again later.",
  "retryAfter": 60
}
```

Rate limit: 30 requests per minute.

## Example: Export Logs for Compliance

```javascript
async function exportAuditLogs(startDate, endDate) {
  const logs = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const response = await fetch(
      `https://veilforms.com/api/audit-logs?limit=${limit}&offset=${offset}`,
      {
        headers: {
          'Authorization': 'Bearer YOUR_JWT_TOKEN'
        }
      }
    );

    const data = await response.json();

    // Filter by date range
    const filtered = data.logs.filter(log => {
      const ts = new Date(log.timestamp);
      return ts >= startDate && ts <= endDate;
    });

    logs.push(...filtered);

    if (data.logs.length < limit) break;
    offset += limit;
  }

  return logs;
}

// Export last 30 days
const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
const logs = await exportAuditLogs(thirtyDaysAgo, new Date());
console.log(`Exported ${logs.length} audit logs`);
```

## Use Cases

### Security Monitoring

Monitor for suspicious activity:
- Failed login attempts (`user.login_failed`)
- New API key creation (`api_key.created`)
- Unexpected form deletions (`form.deleted`)

### Compliance Reporting

Generate audit reports for:
- GDPR data access requests
- SOC 2 compliance
- Internal security audits

### Debugging

Trace issues by reviewing:
- Recent form configuration changes
- Submission delivery problems
- API key authentication issues

## Next Steps

- [API Keys](/docs/api/api-keys/) - Manage API keys
- [Forms API](/docs/api/forms/) - Manage forms
- [GDPR Guide](/docs/guides/gdpr/) - Compliance guidance
