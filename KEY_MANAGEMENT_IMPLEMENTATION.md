# Key Management Implementation Summary

This document summarizes the key management improvements implemented for VeilForms.

## Overview

Three major improvements were implemented to enhance VeilForms' key management capabilities:

1. Private key backup/export feature with password protection
2. Comprehensive documentation of key storage risks and best practices
3. Improved error handling with specific key-related error codes

## 1. Private Key Backup/Export Feature

### Files Modified

#### `/src/core/encryption.js`
Added password-protected key export/import functionality:

**New Functions:**
- `deriveKeyFromPassword(password, salt, iterations)` - Derives AES-GCM key from password using PBKDF2
- `exportPrivateKeys(privateKeys, password)` - Encrypts private keys with password protection
- `importPrivateKeys(encryptedBundle, password)` - Decrypts and imports private keys

**Technical Details:**
- Uses PBKDF2 with 100,000 iterations for key derivation
- Uses AES-GCM-256 for authenticated encryption
- Generates unique salt and IV for each export
- Returns encrypted bundle in `.veilkeys` format

**Example Usage:**
```javascript
import { exportPrivateKeys, importPrivateKeys } from '../core/encryption.js';

// Export
const privateKeys = { 'vf-form-123': {...jwk} };
const bundle = await exportPrivateKeys(privateKeys, 'strong-password');
// Returns: { version, algorithm, iterations, salt, iv, ciphertext }

// Import
const decrypted = await importPrivateKeys(bundle, 'strong-password');
// Returns: { 'vf-form-123': {...jwk} }
```

#### `/src/dashboard/app.js`
Added methods to VeilFormsDashboard class:

**New Methods:**
- `exportEncryptedKeys(password)` - Exports all private keys with password
- `importEncryptedKeys(encryptedBundle, password)` - Imports keys and merges with existing
- `downloadKeyBundle(bundle, filename)` - Triggers browser download of encrypted bundle

**Integration:**
- Works with existing dashboard UI modals (already present in baseof.html)
- Stores keys in localStorage under `veilforms_private_keys`
- Supports key merging on import (doesn't overwrite existing keys)

#### `/static/src/js/dashboard.js`
The dashboard JavaScript already had export/import implementations. The new encryption utilities provide enhanced security through:
- Better password validation (minimum 8 characters)
- Consistent error handling
- Improved user feedback with toast notifications
- Automatic form reload after import

### UI Components (Already Present)

The following modals were already implemented in `/layouts/dashboard/baseof.html`:
- Export Keys Modal (lines 660-688)
- Import Keys Modal (lines 690-718)
- Settings page with "Export Keys" and "Import Keys" buttons (lines 386-403)

### File Format

**`.veilkeys` File Structure:**
```json
{
  "version": "1.0",
  "algorithm": "PBKDF2-AES-GCM-256",
  "iterations": 100000,
  "salt": "base64-encoded-32-bytes",
  "iv": "base64-encoded-12-bytes",
  "ciphertext": "base64-encoded-encrypted-data",
  "exportedAt": "2025-12-13T..."
}
```

**Encrypted Payload (decrypts to):**
```json
{
  "vf-form-id-1": { ...JWK private key... },
  "vf-form-id-2": { ...JWK private key... },
  ...
}
```

## 2. Enhanced Documentation

### `/content/docs/guides/key-management.md`

Significantly enhanced the key management documentation with:

#### A. localStorage Risk Documentation

**Added Sections:**
- **Real-World Attack Scenarios** - Concrete examples of XSS attacks, malicious extensions, and shared computer risks
- **Why localStorage?** - Honest comparison table of storage options
- **Attack Scenario Examples** - Code showing how keys can be stolen
- **Browser Extension Risks** - How extensions can access localStorage
- **Shared Computer Risks** - Persistence issues

**Comparison Table:**
| Storage Method | Security | Compatibility | Ease of Use |
|----------------|----------|---------------|-------------|
| localStorage | Low | Excellent | Excellent |
| sessionStorage | Medium | Excellent | Good |
| IndexedDB | Low-Medium | Good | Medium |
| Hardware Token | Excellent | Poor | Poor |
| Password Manager | Excellent | Good | Medium |

#### B. Enhanced Mitigation Strategies

**Expanded from 5 to 7 strategies:**
1. Always Export Keys Immediately (with detailed steps)
2. Implement CSP headers (with example configuration)
3. Regular Security Audits (with tool recommendations)
4. Clear Keys After Use (with code examples)
5. Use Dedicated Browsers (new - profile isolation)
6. Monitor for Unauthorized Access (new - audit logs)
7. Enterprise Security Recommendations (new - HSM, key escrow, etc.)

#### C. Step-by-Step Backup Procedures

Added 6 detailed procedures with time estimates and success criteria:

**Procedure 1: Initial Form Creation Backup** (5 minutes)
- 12 detailed steps from form creation through tested backup
- Success criteria: Can decrypt from different browser

**Procedure 2: Regular Key Backup** (2 minutes, monthly)
- Monthly backup routine
- Password rotation
- Backup retention policy (keep last 3)

**Procedure 3: Pre-Vacation/Leave Backup** (15 minutes)
- Sharing keys with colleagues
- Separate password sharing channel
- Recovery testing

**Procedure 4: Emergency Recovery Drill** (10 minutes, quarterly)
- Simulated key loss
- Recovery from backup
- Process documentation

**Procedure 5: Key Rotation** (30 minutes, annually)
- Complete rotation procedure
- Archiving old keys
- Team notification

**Procedure 6: Team Member Offboarding** (1 hour)
- Immediate key rotation
- Access revocation
- Audit log review

Each procedure includes:
- When to execute
- Detailed step-by-step instructions
- Time requirement
- Success criteria

## 3. Improved Error Handling

### `/netlify/functions/lib/errors.js`

Added 6 new key-specific error codes to the ErrorCodes enum:

```javascript
KEY_FORMAT_ERROR: 'KEY_FORMAT_ERROR'
KEY_NOT_FOUND: 'KEY_NOT_FOUND'
KEY_EXPORT_FAILED: 'KEY_EXPORT_FAILED'
KEY_IMPORT_FAILED: 'KEY_IMPORT_FAILED'
KEY_PASSWORD_WEAK: 'KEY_PASSWORD_WEAK'
KEY_PASSWORD_INCORRECT: 'KEY_PASSWORD_INCORRECT'
```

Each error includes:
- **message** - User-friendly error description
- **hint** - Actionable guidance for resolution
- **statusCode** - Appropriate HTTP status code

**Example Error Definition:**
```javascript
[ErrorCodes.KEY_FORMAT_ERROR]: {
  message: 'Invalid key format',
  hint: 'The provided encryption key is not in valid JWK (JSON Web Key) format. Ensure your key is properly formatted.',
  statusCode: 400,
}
```

### `/netlify/functions/lib/key-utils.js` (NEW FILE)

Created helper utilities for key validation and error handling:

**Functions:**
- `validateJWK(key)` - Validates JWK format and required fields
- `validateKeyPassword(password)` - Validates password strength (min 8 chars)
- `keyErrorResponse(errorCode, headers, options)` - Creates standardized error responses
- `validateKeyBundle(bundle)` - Validates encrypted bundle format

**Example Usage:**
```javascript
import { validateJWK, keyErrorResponse } from './lib/key-utils.js';
import { ErrorCodes } from './lib/errors.js';

const validation = validateJWK(publicKey);
if (!validation.valid) {
  return keyErrorResponse(ErrorCodes.KEY_FORMAT_ERROR, headers, {
    details: validation.error
  });
}
```

## Security Considerations

### Encryption Strength
- **PBKDF2**: 100,000 iterations (OWASP recommended minimum)
- **AES-GCM**: 256-bit key length
- **Salt**: 32 bytes (256 bits) of cryptographically secure random data
- **IV**: 12 bytes (96 bits) recommended for GCM mode
- **Password**: Minimum 8 characters enforced

### localStorage Risks (Documented)
- **XSS vulnerabilities** - Any JavaScript can read localStorage
- **Browser extensions** - Can access all localStorage data
- **Persistence** - Survives browser restarts
- **No encryption** - Keys stored as plain JSON

### Recommended Mitigations
1. **Always export keys** to password manager immediately
2. **Use strong passwords** (12+ characters) for exports
3. **Implement CSP** to prevent script injection
4. **Clear localStorage** after use on shared devices
5. **Use dedicated browser** profile for sensitive operations

## Testing Recommendations

### Unit Tests
```javascript
// Test key export
const keys = { 'vf-test': mockJWK };
const bundle = await exportPrivateKeys(keys, 'test-password');
assert(bundle.version === '1.0');
assert(bundle.algorithm === 'PBKDF2-AES-GCM-256');

// Test key import
const imported = await importPrivateKeys(bundle, 'test-password');
assert.deepEqual(imported, keys);

// Test wrong password
await assert.rejects(
  importPrivateKeys(bundle, 'wrong-password'),
  /Invalid password/
);
```

### Integration Tests
1. Create form → Export keys → Import on new browser → Decrypt submission
2. Test password strength validation (< 8 chars should fail)
3. Test bundle format validation (corrupted file should fail)
4. Test key merging (import should not overwrite existing keys)

### UI Tests
1. Settings → Export Keys → Enter password → Download file
2. Settings → Import Keys → Select file → Enter password → Success toast
3. Forms list → Should show "can decrypt" status for forms with keys

## Migration Guide

### For Existing Users

No migration needed. The new features are additive:
- Existing keys in localStorage continue to work
- Export feature works with existing keys
- Import merges with existing keys (doesn't replace)

### For Developers

If you have custom key management code:

**Before:**
```javascript
const keys = localStorage.getItem('veilforms_private_keys');
// Keys are plain JSON, no encryption
```

**After (using new utilities):**
```javascript
import { exportPrivateKeys, importPrivateKeys } from '@veilforms/core/encryption';

// Export with password
const bundle = await exportPrivateKeys(privateKeys, password);
downloadFile(bundle, 'keys.veilkeys');

// Import from password-protected bundle
const keys = await importPrivateKeys(bundle, password);
localStorage.setItem('veilforms_private_keys', JSON.stringify(keys));
```

## User-Facing Changes

### Dashboard UI (No Changes Needed)
The modals and buttons were already implemented in baseof.html:
- "Export Keys" button in Settings → Encryption Key Management
- "Import Keys" button in Settings → Encryption Key Management
- Export modal with password fields
- Import modal with file input and password field

### New User Flow

**Export:**
1. User clicks "Export Keys" in Settings
2. Modal appears requesting password (with confirmation)
3. User enters strong password
4. File downloads as `veilforms-keys-YYYY-MM-DD.veilkeys`
5. Success toast confirms export

**Import:**
1. User clicks "Import Keys" in Settings
2. Modal appears requesting file and password
3. User selects `.veilkeys` file
4. User enters password used during export
5. Keys imported and merged with existing
6. Success toast shows number of imported keys
7. Forms list refreshes to show newly decryptable forms

## Future Enhancements

### Potential Improvements
1. **Key rotation UI** - Dashboard button for automatic key rotation
2. **Key versioning** - Track key version history
3. **Multi-password support** - Different passwords for different forms
4. **Hardware token integration** - WebAuthn for key storage
5. **Key escrow option** - Enterprise feature for key recovery
6. **Audit logging** - Track all export/import operations
7. **Auto-export** - Automatic periodic backups to cloud storage
8. **Key sharing** - Secure key sharing between team members

### Security Enhancements
1. **Argon2** - Replace PBKDF2 with Argon2id (when available in browsers)
2. **Key stretching** - Increase iterations to 600,000+
3. **Pepper** - Server-side secret for additional protection
4. **Breach detection** - Alert on suspicious export patterns
5. **Rate limiting** - Limit import attempts to prevent brute force

## Conclusion

All three key management improvements have been successfully implemented:

✅ **Private key backup/export feature** - Password-protected export/import with PBKDF2 + AES-GCM
✅ **Documentation** - Comprehensive risk documentation and step-by-step procedures
✅ **Error handling** - Specific error codes with helpful hints

The implementation prioritizes:
- **Security** - Strong encryption with industry-standard algorithms
- **Usability** - Clear UI, helpful error messages, toast notifications
- **Transparency** - Honest documentation of risks and limitations
- **Best practices** - Detailed procedures for various scenarios

Users now have a robust, secure way to backup and restore their encryption keys while understanding the associated risks and best practices.
