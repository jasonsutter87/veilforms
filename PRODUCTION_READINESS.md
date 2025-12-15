# VeilForms Production Readiness Features

This document describes the webhook retry, abuse protection, and reliability features implemented for production deployment.

## 1. Webhook Retry Logic with Exponential Backoff

**File**: `/netlify/functions/lib/webhook-retry.js`

### Features
- **Automatic retries** with exponential backoff (1s, 2s, 4s)
- **Maximum 3 retry attempts** per webhook delivery
- **Smart retry logic**: Doesn't retry 4xx client errors (only 5xx server errors)
- **Failed webhook storage** for manual retry
- **Delivery status logging** for monitoring
- **10-second timeout** per attempt

### Implementation
```javascript
import { fireWebhookWithRetry } from './lib/webhook-retry.js';

// Webhook is called with automatic retry
await fireWebhookWithRetry(webhookUrl, submission, webhookSecret);
```

### Retry Schedule
- Attempt 1: Immediate
- Attempt 2: After 1 second delay
- Attempt 3: After 2 second delay
- Attempt 4: After 4 second delay
- **Total**: 3 retries over ~7 seconds

### Storage
- Failed webhooks stored in `vf-webhook-retry` blob store
- Each form has an index of failed webhooks
- Delivery logs stored per submission for debugging

### API Endpoints (Future)
- `GET /api/webhooks/failed/:formId` - List failed webhooks
- `POST /api/webhooks/retry/:webhookId` - Manually retry failed webhook
- `GET /api/webhooks/log/:formId/:submissionId` - View delivery log

---

## 2. Form Creation Limits

**File**: `/netlify/functions/forms.js`

### Subscription Limits
| Tier | Max Forms |
|------|-----------|
| Free | 5 |
| Starter | 20 |
| Pro | 50 |
| Business | Unlimited |
| Enterprise | Unlimited |

### Implementation
When creating a new form, the system:
1. Gets user's subscription tier
2. Counts active forms (excludes deleted forms)
3. Blocks creation if limit reached
4. Returns `402 Payment Required` with upgrade message

### Error Response
```json
{
  "error": "Form creation limit reached",
  "code": "FORM_LIMIT_REACHED",
  "details": {
    "limit": 5,
    "current": 5,
    "subscription": "free",
    "message": "Upgrade to Pro for up to 50 forms, or Business for unlimited forms"
  }
}
```

---

## 3. Email Rate Limiting

**File**: `/netlify/functions/lib/email-rate-limit.js`

### Rate Limits
- **Verification emails**: Max 5 per email address per hour
- **Password reset emails**: Max 3 per email address per hour

### Protected Endpoints
1. `/api/auth/register` - New registrations
2. `/api/auth/resend-verification` - Resend verification email
3. `/api/auth/forgot` - Password reset requests

### Implementation
Uses Netlify Blob storage with sliding window algorithm:
- Tracks attempts per email address
- 1-hour sliding window
- Automatic cleanup of expired entries

### Error Response
```json
{
  "error": "Too many verification emails. Please wait before requesting another.",
  "code": "RATE_LIMIT_EXCEEDED",
  "details": {
    "retryAfter": 1800,
    "resetAt": "2025-12-13T15:30:00Z"
  }
}
```

### Headers
```
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 2
X-RateLimit-Reset: 2025-12-13T15:30:00Z
Retry-After: 1800
```

---

## 4. Idempotency Keys

**File**: `/netlify/functions/lib/idempotency.js`

### Purpose
Prevents duplicate form submissions from:
- Network retries (client timeout and retry)
- Accidental double-clicks
- API replay attacks

### How It Works
1. Client sends `X-Idempotency-Key` header with submission
2. Server checks if key was used before
3. If duplicate: Returns cached response immediately
4. If new: Processes submission and caches response
5. **TTL**: 24 hours

### Client Usage
```javascript
// Generate idempotency key (e.g., UUID)
const idempotencyKey = crypto.randomUUID();

// Include in request header
const response = await fetch('/api/submit', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Idempotency-Key': idempotencyKey
  },
  body: JSON.stringify(submission)
});
```

### Idempotency Key Format
- **Length**: 16-128 characters
- **Characters**: Alphanumeric, dashes, underscores only
- **Example**: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`

### Response Headers (Duplicate Detection)
```
X-Idempotent-Replay: true
X-Idempotency-Age: 45
X-Idempotency-Created: 2025-12-13T14:30:00Z
```

### Storage
- Stored in `vf-idempotency` blob store
- Scoped by `formId_idempotencyKey`
- Automatic cleanup after 24 hours
- Index maintained per form for monitoring

---

## Testing Guidelines

### 1. Test Webhook Retries
```bash
# Simulate failing webhook endpoint
# Should see 3 retry attempts in logs

curl -X POST http://localhost:8888/api/submit \
  -H "Content-Type: application/json" \
  -d '{
    "formId": "vf_abc123",
    "submissionId": "sub_xyz789",
    "payload": {...},
    "webhookUrl": "https://httpstat.us/500"
  }'
```

### 2. Test Form Creation Limits
```bash
# Create 5 forms on free tier
# 6th should fail with 402 Payment Required

for i in {1..6}; do
  curl -X POST http://localhost:8888/api/forms \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"name": "Test Form '$i'"}'
done
```

### 3. Test Email Rate Limiting
```bash
# Send 6 verification emails
# 6th should fail with 429 Too Many Requests

for i in {1..6}; do
  curl -X POST http://localhost:8888/api/auth/resend-verification \
    -H "Content-Type: application/json" \
    -d '{"email": "test@example.com"}'
done
```

### 4. Test Idempotency
```bash
# Send same request twice with idempotency key
# Second should return cached response

IDEMPOTENCY_KEY=$(uuidgen)

curl -X POST http://localhost:8888/api/submit \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: $IDEMPOTENCY_KEY" \
  -d '{...}'

# Send again - should get cached response
curl -X POST http://localhost:8888/api/submit \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: $IDEMPOTENCY_KEY" \
  -d '{...}'
```

---

## Monitoring and Observability

### Webhook Delivery Logs
```javascript
import { getWebhookDeliveryLog } from './lib/webhook-retry.js';

const log = await getWebhookDeliveryLog(formId, submissionId);
// Returns array of delivery attempts with status, timestamps
```

### Failed Webhooks
```javascript
import { getFailedWebhooks } from './lib/webhook-retry.js';

const failed = await getFailedWebhooks(formId, 50);
// Returns up to 50 most recent failed webhooks
```

### Email Rate Limit Status
```javascript
import { getEmailRateLimitStatus } from './lib/email-rate-limit.js';

const status = await getEmailRateLimitStatus(email, 'verification');
// Returns current count, limit, remaining, attempts
```

### Idempotency Statistics
```javascript
import { getIdempotencyStats } from './lib/idempotency.js';

const stats = await getIdempotencyStats(formId);
// Returns total, active, expired counts
```

---

## Security Considerations

### 1. Webhook Signatures
- HMAC-SHA256 signature in `X-VeilForms-Signature` header
- Verifies webhook came from VeilForms
- Prevents webhook spoofing

### 2. Email Enumeration Protection
- Rate limits prevent discovering valid email addresses
- Consistent responses for invalid emails
- Combined with IP-based rate limiting

### 3. Idempotency Key Validation
- Strict format validation (16-128 chars, alphanumeric)
- Scoped by form ID (can't replay across forms)
- 24-hour TTL limits attack window

### 4. Rate Limit Headers
- Transparent rate limit information
- Helps legitimate clients avoid bans
- `Retry-After` header for backoff

---

## Performance Impact

### Storage Usage
- **Webhook retry**: ~1KB per failed webhook
- **Email rate limits**: ~200 bytes per email per hour
- **Idempotency keys**: ~500 bytes per submission (24hr)

### Latency Impact
- **Idempotency check**: +5-15ms per submission
- **Email rate limit check**: +5-10ms per email
- **Webhook retry**: Background process, no user impact

### Blob Store Operations
- Webhook retry: 2-4 operations per submission
- Email rate limits: 2 operations per email
- Idempotency: 2 operations per submission

---

## Future Enhancements

### 1. Admin API
- Dashboard to view failed webhooks
- Bulk retry functionality
- Rate limit override for specific users

### 2. Metrics
- Webhook success/failure rates
- Average retry counts
- Rate limit trigger frequency
- Idempotency replay detection rate

### 3. Alerts
- Email notification on webhook failures
- Slack/Discord integration for monitoring
- Alert when nearing rate limits

### 4. Advanced Features
- Configurable retry strategy per form
- Custom rate limits per user
- Webhook delivery priorities
- Batch webhook retry

---

## Configuration

### Environment Variables
```bash
# Webhook retry configuration (optional)
WEBHOOK_MAX_RETRIES=3
WEBHOOK_TIMEOUT_MS=10000

# Email rate limits (optional)
EMAIL_VERIFICATION_RATE_LIMIT=5
EMAIL_PASSWORD_RESET_RATE_LIMIT=3

# Idempotency (optional)
IDEMPOTENCY_TTL_HOURS=24
```

### Per-Form Settings
```json
{
  "webhookUrl": "https://example.com/webhook",
  "webhookSecret": "your-secret-key",
  "webhookRetries": 3,
  "webhookTimeout": 10000
}
```

---

## Troubleshooting

### Webhooks Not Retrying
1. Check webhook URL is valid HTTPS endpoint
2. Verify endpoint returns 5xx errors (not 4xx)
3. Check webhook secret is correctly configured
4. Review delivery logs for specific error

### Email Rate Limits Too Strict
1. Check rate limit status for specific email
2. Verify time window calculation
3. Consider temporary override for testing
4. Review blob storage for stuck entries

### Idempotency Not Working
1. Verify key format (16-128 chars, alphanumeric)
2. Check header name (`X-Idempotency-Key`)
3. Ensure key is unique per submission
4. Review blob storage for key conflicts

---

## Migration Notes

### Existing Users
- All features are backward compatible
- Optional headers (idempotency key)
- Existing webhooks work without changes
- Rate limits apply from deployment

### Rollout Plan
1. Deploy to staging environment
2. Test all features with sample data
3. Monitor performance impact
4. Deploy to production during low traffic
5. Monitor logs for 24 hours
6. Document any issues

---

## API Changes

### CORS Headers Updated
Added idempotency key headers to CORS:
```
Access-Control-Allow-Headers: Content-Type, X-Idempotency-Key, Idempotency-Key
```

### New Response Headers
- `X-Idempotent-Replay`: Indicates cached response
- `X-Idempotency-Age`: Age of cached response in seconds
- `X-RateLimit-*`: Rate limit information

### Error Codes
- `402`: Form creation limit exceeded
- `429`: Rate limit exceeded (email or API)
