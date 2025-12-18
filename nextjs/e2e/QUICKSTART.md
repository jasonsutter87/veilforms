# E2E Tests Quick Start

Get started with VeilForms E2E tests in 3 minutes.

## Prerequisites

- Node.js installed
- VeilForms project set up
- Playwright already in devDependencies (check package.json)

## Installation

Playwright browsers are already installed if you ran the setup. If not:

```bash
npx playwright install chromium
```

## Running Tests

### Option 1: Run All Tests (Headless)
```bash
npm run test:e2e
```
This runs all 51 tests in the background and shows results in the terminal.

### Option 2: UI Mode (Recommended for Development)
```bash
npm run test:e2e:ui
```
This opens Playwright's UI where you can:
- Click on tests to run them
- See step-by-step execution
- Time travel through test steps
- Debug failures visually

### Option 3: Watch Mode
```bash
npx playwright test --ui
```
Similar to UI mode but auto-runs tests on file changes.

## First Test Run

1. Start your dev server in one terminal:
   ```bash
   npm run dev
   ```

2. In another terminal, run one test to verify setup:
   ```bash
   npx playwright test auth/register.spec.ts --headed
   ```

This will open a browser and you'll see the test execute.

## Test Organization

```
e2e/
├── auth/              # Authentication tests (24 tests)
│   ├── register.spec.ts
│   └── login.spec.ts
└── forms/             # Form management tests (27 tests)
    ├── dashboard.spec.ts
    └── create-form.spec.ts
```

## Common Commands

```bash
# Run a specific file
npx playwright test auth/login.spec.ts

# Run a specific test by name
npx playwright test -g "shows login form"

# Run in headed mode (see the browser)
npx playwright test --headed

# Run in debug mode
npx playwright test --debug

# View last test report
npx playwright show-report
```

## What Gets Tested

### Authentication (24 tests)
- Registration with password validation
- Login with error handling
- OAuth buttons
- Rate limiting
- Email verification

### Forms (27 tests)
- Dashboard empty/loaded states
- Form cards with statistics
- Creating new forms
- PII detection toggle
- Webhook configuration
- Private key management
- Delete confirmations

## Test Results

After running tests, you'll see:

```
Running 51 tests using 4 workers

  ✓ auth/login.spec.ts:16:7 › User Login › shows login form (1.2s)
  ✓ auth/login.spec.ts:35:7 › User Login › rejects invalid credentials (850ms)
  ...

  51 passed (1.5m)
```

## When Tests Fail

1. Check the terminal output for the error
2. Look in `playwright-report/` folder for screenshots
3. Run the specific failing test with `--debug`:
   ```bash
   npx playwright test -g "failing test name" --debug
   ```

## Tips

- **Use UI mode for development**: It's the easiest way to write and debug tests
- **Run tests before committing**: `npm run test:e2e` in CI will catch issues
- **Mock API calls**: Most tests use route mocking to avoid real API calls
- **Tests are independent**: Each test runs in isolation and can be run alone

## Next Steps

1. Read [e2e/README.md](./README.md) for comprehensive documentation
2. Look at [DATA_TESTIDS.md](./DATA_TESTIDS.md) for adding test IDs to components
3. Check [test-utils.ts](./fixtures/test-utils.ts) for helper functions
4. Try running tests in UI mode: `npm run test:e2e:ui`

## Troubleshooting

### "Cannot find browser" error
```bash
npx playwright install chromium
```

### "Port 3000 already in use"
Make sure your dev server is running on port 3000, or set `PLAYWRIGHT_BASE_URL`:
```bash
PLAYWRIGHT_BASE_URL=http://localhost:3001 npm run test:e2e
```

### Tests timing out
Increase timeout in `playwright.config.ts`:
```typescript
timeout: 120000, // 2 minutes
```

### Tests failing in CI
Make sure to install browsers in CI:
```bash
npx playwright install chromium
```

## Questions?

- Playwright Docs: https://playwright.dev
- Test Examples: Look at existing test files in `e2e/`
- Debug: Use `npx playwright test --debug`
