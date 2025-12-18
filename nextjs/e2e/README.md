# VeilForms E2E Tests

Production-quality end-to-end tests for VeilForms using Playwright.

## Overview

This test suite covers critical user flows:

- **Authentication**: Registration, login, password validation
- **Dashboard**: Forms list, empty states, loading states
- **Form Management**: Creating forms, configuring settings, managing private keys

## Structure

```
e2e/
├── fixtures/
│   └── test-utils.ts          # Shared test utilities and helpers
├── auth/
│   ├── register.spec.ts       # User registration tests
│   └── login.spec.ts          # User login tests
└── forms/
    ├── dashboard.spec.ts      # Dashboard and forms list tests
    └── create-form.spec.ts    # Form creation tests
```

## Running Tests

### Run all tests
```bash
npm run test:e2e
```

### Run specific test file
```bash
npx playwright test auth/login.spec.ts
```

### Run tests in UI mode (recommended for development)
```bash
npm run test:e2e:ui
```

### Run tests in headed mode (see browser)
```bash
npx playwright test --headed
```

### Run specific browser
```bash
npx playwright test --project chromium
```

## Test Features

### Realistic Test Data
- Unique email addresses per test run (no conflicts)
- Valid password requirements (12+ chars, uppercase, lowercase, number)
- Form names and settings that match production patterns

### API Mocking
Most tests use Playwright's route mocking to:
- Control API responses
- Test error scenarios
- Avoid database dependencies
- Run tests in isolation

### Test Independence
Each test is self-contained and can run independently:
- No shared state between tests
- Proper cleanup in `beforeEach` hooks
- Unique test data per run

### Best Practices
- Uses semantic selectors (IDs, roles, text)
- Proper waits for navigation and async operations
- Tests both success and error paths
- Validates loading states
- Screenshots and videos on failure

## Test Coverage

### Authentication (24 tests)

**Registration** (`auth/register.spec.ts`)
- Form rendering and layout
- Password strength validation with visual indicators
- Email format validation
- Error handling for existing emails
- Successful registration flow
- OAuth provider buttons
- Redirect behavior

**Login** (`auth/login.spec.ts`)
- Form rendering and layout
- Invalid credentials handling
- Email/password validation
- Rate limiting after failed attempts
- Unverified email handling
- OAuth provider buttons
- Redirect behavior

### Forms Management (27 tests)

**Dashboard** (`forms/dashboard.spec.ts`)
- Authentication guards
- Loading states
- Empty state for new users
- Forms grid layout
- Form card statistics
- Create form button
- View and delete actions
- Error states

**Form Creation** (`forms/create-form.spec.ts`)
- Create form modal
- Form name validation
- Webhook URL validation
- Basic form creation
- PII detection toggle
- Webhook configuration
- Loading states
- Private key modal
- Error handling

## Configuration

The test configuration is in `playwright.config.ts`:

- **Base URL**: `http://localhost:3000` (configurable via `PLAYWRIGHT_BASE_URL`)
- **Timeout**: 60 seconds per test
- **Retries**: 2 retries in CI, 0 locally
- **Workers**: 1 in CI (sequential), parallel locally
- **Reports**: HTML report + console list
- **Debugging**: Screenshots on failure, videos on failure, traces on retry

## CI/CD Integration

The configuration is CI-ready:

```yaml
# Example GitHub Actions workflow
- name: Install dependencies
  run: npm ci

- name: Install Playwright browsers
  run: npx playwright install chromium

- name: Run E2E tests
  run: npm run test:e2e
  env:
    CI: true

- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

## Environment Variables

### Optional Test Credentials
For tests that require actual authentication:

```bash
export E2E_TEST_USER_EMAIL="test@example.com"
export E2E_TEST_USER_PASSWORD="YourPassword123!"
```

### Custom Base URL
```bash
export PLAYWRIGHT_BASE_URL="https://staging.veilforms.com"
```

## Debugging Tests

### Debug mode
```bash
npx playwright test --debug
```

### Show browser
```bash
npx playwright test --headed
```

### Run single test
```bash
npx playwright test -g "shows registration form"
```

### View test report
```bash
npx playwright show-report
```

## Common Issues

### Tests timing out
- Increase timeout in `playwright.config.ts`
- Check that dev server is running (`npm run dev`)
- Verify network requests aren't being blocked

### Tests failing on CI
- Ensure `CI` environment variable is set
- Use `forbidOnly: !!process.env.CI` to catch `.only()` in commits
- Check retry configuration

### Flaky tests
- Use proper waits (`waitForSelector`, `waitForURL`)
- Avoid hardcoded timeouts
- Use route mocking to control API responses

## Writing New Tests

### Template for new test file

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup: navigate, authenticate, mock APIs
    await page.goto('/your-page');
  });

  test('should do something specific', async ({ page }) => {
    // Arrange
    await page.fill('#input', 'value');

    // Act
    await page.click('button[type="submit"]');

    // Assert
    await expect(page.locator('.success')).toBeVisible();
  });
});
```

### Best Practices

1. **Use descriptive test names**: Test should read like a spec
2. **Test user behavior, not implementation**: Focus on what users see/do
3. **One assertion per test when possible**: Makes failures clear
4. **Use data-testid for complex selectors**: More stable than CSS classes
5. **Mock external dependencies**: Tests should be fast and reliable
6. **Clean up after tests**: Reset state, clear localStorage, etc.

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging Guide](https://playwright.dev/docs/debug)
- [CI/CD Guide](https://playwright.dev/docs/ci)
