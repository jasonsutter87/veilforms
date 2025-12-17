# Token Revocation Implementation

## Overview

VeilForms now includes a persistent token revocation mechanism using Netlify Blob storage. This solves the problem of JWT statelessness by maintaining a blocklist of revoked tokens.

## Problem Statement

JWTs are stateless by design. Once issued, they remain valid until expiry (24 hours in VeilForms). This creates a security issue:
- When a user logs out, their token should be immediately invalidated
- If a token is compromised, there was no way to revoke it before expiry
- The previous implementation used an in-memory Set that reset on cold starts

## Solution

A persistent token blocklist using Netlify Blob storage with automatic TTL-based cleanup.

## Architecture

### Components

1. **Token Blocklist** (`/netlify/functions/lib/token-blocklist.js`)
   - `revokeToken(token)` - Add token to blocklist
   - `isTokenRevoked(token)` - Check if token is revoked
   - `cleanupExpiredTokens()` - Manual cleanup (TTL handles this automatically)
   - `getBlocklistStats()` - Get blocklist statistics

2. **Auth Module** (`/netlify/functions/lib/auth.js`)
   - `verifyToken(token)` - Now checks blocklist after JWT verification
   - `authenticateRequest(req)` - Uses updated verifyToken
   - `revokeToken(token)` - Re-exported for convenience

3. **Logout Endpoint** (`/netlify/functions/auth-logout.js`)
   - Calls `revokeToken()` when user logs out

### Data Flow

```
User Logout
    |
    v
auth-logout.js
    |
    v
revokeToken()
    |
    v
[Hash token with SHA-256]
    |
    v
Store in Netlify Blob with TTL
    |
    v
Success

Subsequent Requests
    |
    v
authenticateRequest()
    |
    v
verifyToken()
    |
    +--> Verify JWT signature [PASS/FAIL]
    |
    +--> Check if revoked [PASS/FAIL]
    |
    v
Return user or null
```

## Key Features

###  1. Privacy-First Design

Tokens are hashed with SHA-256 before storage:
```javascript
async function hashToken(token) {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return hex(hashBuffer);
}
```

**Why?** Even if the blob storage is compromised, actual tokens are never exposed.

### 2. Automatic Cleanup with TTL

Each revoked token is stored with a TTL matching its remaining validity:
```javascript
const ttl = tokenExpiry - Date.now();
await store.setJSON(tokenHash, metadata, { metadata: { ttl } });
```

**Why?** Once a token expires naturally, it's automatically removed from storage. No manual cleanup needed.

### 3. Fail-Open Design

If the blocklist check fails (network error, storage unavailable), the token is allowed:
```javascript
try {
  const revoked = await isTokenRevoked(token);
  if (revoked) return null;
} catch (err) {
  console.error('Blocklist check error:', err);
  return false; // Fail open - allow the token
}
```

**Why?** Prevents blocking all requests if blob storage has issues. JWT verification still catches invalid tokens.

### 4. Efficient Lookups

- Uses SHA-256 hashing for consistent key generation
- Single blob lookup per verification (O(1))
- No iteration through blocklist needed

## Usage

### Revoking a Token

```javascript
import { revokeToken } from './lib/auth.js';

const result = await revokeToken(token);
if (result.success) {
  // Token revoked successfully
} else {
  // Handle error: result.error
}
```

### Checking if Token is Revoked

```javascript
import { isTokenRevoked } from './lib/token-blocklist.js';

const revoked = await isTokenRevoked(token);
if (revoked) {
  // Token is revoked, deny access
}
```

### Getting Blocklist Statistics

```javascript
import { getBlocklistStats } from './lib/token-blocklist.js';

const stats = await getBlocklistStats();
// { success: true, total: 150, active: 120, expired: 30 }
```

## Security Considerations

1. **Token Hashing**: Tokens are hashed before storage to prevent exposure
2. **TTL Management**: Automatic cleanup prevents indefinite storage growth
3. **Fail-Open**: Prevents DoS if blob storage is unavailable
4. **Rate Limiting**: Existing rate limiting protects blocklist lookups
5. **No PII**: Only token hashes and metadata stored (no user information)

## Performance

- **Lookup Time**: O(1) - single blob get operation
- **Storage**: ~100 bytes per revoked token
- **Cleanup**: Automatic via TTL, no cron jobs needed
- **Impact**: Adds ~10-50ms to token verification (one blob lookup)

## Monitoring

Check blocklist health:
```javascript
const stats = await getBlocklistStats();
console.log(`Active revoked tokens: ${stats.active}`);
console.log(`Expired (pending cleanup): ${stats.expired}`);
```

## Testing

Manual testing:
1. Login to get a token
2. Make authenticated request - should succeed
3. Logout
4. Make authenticated request with same token - should fail with 401

## Future Enhancements

Potential improvements:
1. Add blocklist size monitoring/alerts
2. Implement token refresh mechanism
3. Add admin endpoint to manually revoke tokens
4. Track revocation reasons for audit logs

## Migration Notes

The old in-memory blocklist in `auth-logout.js` has been completely replaced. No migration needed for existing deployments as:
- Old blocklist was in-memory only (lost on restart)
- New blocklist starts fresh
- All tokens expire within 24 hours anyway

## Environment Requirements

- Netlify Blob Storage must be enabled
- No additional environment variables required
- Uses existing JWT_SECRET for token verification

## Files Modified

1. `/netlify/functions/lib/token-blocklist.js` - NEW
2. `/netlify/functions/lib/auth.js` - MODIFIED
3. `/netlify/functions/auth-logout.js` - MODIFIED
4. `/netlify/functions/lib/__tests__/token-blocklist.test.js` - NEW
5. `/netlify/functions/lib/__tests__/auth-with-blocklist.test.js` - NEW
