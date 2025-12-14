# VeilForms E2E Smoke Tests

## Overview

This directory contains **End-to-End (E2E) smoke tests** for VeilForms critical paths. These tests verify that core functionality works correctly across the entire application stack.

## Test Coverage

### Test Suite Summary
- **Total Tests**: 77 passing
- **Test Suites**: 4
- **Coverage**: Critical user paths

### Test Suites

#### 1. Encryption Roundtrip (`encryption-roundtrip.test.js`)
**Test Cases**: TC-E2E-001 through TC-E2E-005
**Total Tests**: 13

Tests the complete encryption and decryption lifecycle:
- Generate RSA keypair (2048-bit RSA-OAEP-256)
- Encrypt data with AES-256-GCM + RSA hybrid encryption
- Store encrypted payload
- Retrieve and decrypt data
- Verify data integrity
- Field hashing for PII detection

**Key Validations**:
- Encryption algorithm correctness (RSA-OAEP + AES-GCM)
- Random IV generation for each encryption
- Data type preservation through encryption/decryption
- Complex nested object handling
- Large payload support (10KB+)

#### 2. Form Submission Flow (`form-submission.test.js`)
**Test Cases**: TC-E2E-010 through TC-E2E-015
**Total Tests**: 16

Tests the complete form submission workflow:
- Form creation with encryption keys
- Client-side data encryption
- Submission to API
- Storage verification
- Retrieval and decryption
- Multiple submission handling

**Key Validations**:
- Form ID format (`vf_test_*`)
- Submission ID format (UUID v4 with `vf-` prefix)
- Required metadata fields
- Form status validation (active/paused/deleted)
- Subscription tier limits
- Webhook payload preparation

#### 3. Authentication Flow (`authentication-flow.test.js`)
**Test Cases**: TC-E2E-020 through TC-E2E-027
**Total Tests**: 27

Tests the complete authentication lifecycle:
- User registration with validation
- Email verification
- Login with JWT token generation
- Protected endpoint access
- Session management
- Logout

**Key Validations**:
- Email format validation
- Password strength requirements (12+ chars, uppercase, lowercase, number)
- bcrypt password hashing (10 salt rounds)
- JWT token creation and verification (7-day expiry)
- Bearer token extraction
- Session expiry handling
- Email verification flow

#### 4. Form Builder Integration (`form-builder.test.js`)
**Test Cases**: TC-E2E-030 through TC-E2E-036
**Total Tests**: 21

Tests form builder create, save, load, and update operations:
- Create forms with multiple field types
- Save form configuration
- Load and restore forms
- Update form fields and settings
- Field validation
- Layout field support

**Key Validations**:
- All 10+ field types (text, email, select, checkbox, radio, etc.)
- Field property preservation (placeholder, required, min/max, options)
- Field order maintenance
- Form settings persistence
- Field name uniqueness
- Layout fields (heading, paragraph, divider)
- Form versioning and timestamps

## Running Tests

### Run All E2E Tests
```bash
npm test src/core/__tests__/e2e/
```

### Run Specific Test Suite
```bash
# Encryption tests
npm test src/core/__tests__/e2e/encryption-roundtrip.test.js

# Form submission tests
npm test src/core/__tests__/e2e/form-submission.test.js

# Authentication tests
npm test src/core/__tests__/e2e/authentication-flow.test.js

# Form builder tests
npm test src/core/__tests__/e2e/form-builder.test.js
```

### Run with Verbose Output
```bash
npm test src/core/__tests__/e2e/ -- --verbose
```

### Run with Coverage
```bash
npm test src/core/__tests__/e2e/ -- --coverage
```

## Test Structure

### Test Case Format
Each test follows the standard test case template:

```javascript
/**
 * Test Case: TC-E2E-XXX
 * Priority: Critical
 * Type: E2E
 *
 * Purpose: [Description]
 *
 * Critical Path:
 * 1. [Step 1]
 * 2. [Step 2]
 * 3. [Step 3]
 */
```

### Test Organization
```
e2e/
├── README.md                           # This file
├── test-helpers.js                     # Shared utilities
├── encryption-roundtrip.test.js        # Encryption E2E tests
├── form-submission.test.js             # Form submission E2E tests
├── authentication-flow.test.js         # Auth E2E tests
└── form-builder.test.js                # Form builder E2E tests
```

## Test Helpers

### Utilities (`test-helpers.js`)

**Data Generators**:
- `generateTestEmail()` - Random test email addresses
- `generateTestPassword()` - Strong passwords meeting requirements
- `generateFormId()` - Valid form IDs (`vf_test_*`)
- `generateSubmissionId()` - Valid submission IDs (UUID v4)

**Mock Data Creators**:
- `createMockFormConfig(overrides)` - Form configuration with fields
- `createMockSubmissionData(overrides)` - Sample submission data

**Testing Utilities**:
- `deepEqual(obj1, obj2)` - Deep object comparison
- `wait(ms)` - Async wait utility
- `retry(fn, options)` - Retry with backoff
- `MockStorage` - In-memory storage for testing
- `MockApiResponse` - API response builder
- `assert.*` - Custom assertion helpers

## CI/CD Integration

These tests are designed to run in CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run E2E Smoke Tests
  run: npm test src/core/__tests__/e2e/ -- --ci --coverage
```

## Success Criteria

All E2E smoke tests must pass for:
- ✅ Pull request merges
- ✅ Production deployments
- ✅ Release creation

## Test Data

### Test Email Domain
All test emails use: `*@veilforms-test.com`

### Test Form IDs
Format: `vf_test_[random]`

### Test Submission IDs
Format: `vf-[uuid-v4]`

## Debugging Failed Tests

### View Full Test Output
```bash
npm test src/core/__tests__/e2e/ -- --verbose --no-coverage
```

### Run Single Test
```bash
npm test src/core/__tests__/e2e/encryption-roundtrip.test.js -- -t "should successfully encrypt"
```

### Enable Debug Logging
```bash
DEBUG=* npm test src/core/__tests__/e2e/
```

## Known Issues

None currently. All 77 tests passing.

## Future Enhancements

Potential additions:
- [ ] Rate limiting E2E tests
- [ ] File upload E2E tests
- [ ] Multi-page form E2E tests
- [ ] Webhook delivery E2E tests
- [ ] Email notification E2E tests
- [ ] PII stripping E2E tests
- [ ] Retention policy E2E tests

## Maintenance

### When to Update Tests

Update E2E tests when:
- Adding new critical features
- Modifying authentication flow
- Changing encryption algorithms
- Updating form field types
- Modifying API endpoints

### Test Coverage Goals

Maintain:
- ✅ 100% coverage of critical paths
- ✅ All user-facing workflows
- ✅ Security-critical operations
- ✅ Data integrity validations

## Contact

For questions about E2E tests, contact the QA team or review the main testing documentation.
