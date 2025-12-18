/**
 * VeilForms - Form Creation E2E Tests
 * Tests the form creation flow, validation, and success scenarios
 */

import { test, expect } from '@playwright/test';
import { testFormData } from '../fixtures/test-utils';

test.describe('Form Creation', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authenticated state
    await page.goto('/dashboard');
    await page.evaluate(() => {
      localStorage.setItem('veilforms_token', 'mock-test-token-12345');
    });

    // Mock empty forms list
    await page.route('/api/forms', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ forms: [] }),
        });
      } else {
        // Will be handled by individual tests
        await route.continue();
      }
    });

    await page.reload();

    // Open create form modal
    await page.click('.btn-primary');
    await page.waitForSelector('.modal');
  });

  test('shows create form modal with all fields', async ({ page }) => {
    // Modal should be visible
    await expect(page.locator('.modal')).toBeVisible();
    await expect(page.locator('.modal h2')).toContainText('Create New Form');

    // Form name field
    await expect(page.locator('#form-name')).toBeVisible();
    await expect(page.locator('label[for="form-name"]')).toContainText('Form Name');

    // PII strip checkbox
    const piiCheckbox = page.locator('input[type="checkbox"]').first();
    await expect(piiCheckbox).toBeVisible();

    // Webhook field
    await expect(page.locator('#form-webhook')).toBeVisible();
    await expect(page.locator('label[for="form-webhook"]')).toContainText('Webhook URL');

    // Buttons
    await expect(page.locator('.modal-footer .btn-secondary')).toContainText('Cancel');
    await expect(page.locator('.modal-footer .btn-primary')).toContainText('Create Form');
  });

  test('validates form name is required', async ({ page }) => {
    // Try to submit without form name
    await page.click('.modal-footer .btn-primary');

    // HTML5 validation should prevent submission
    const formNameInput = page.locator('#form-name');
    const validationMessage = await formNameInput.evaluate((el: HTMLInputElement) => el.validationMessage);
    expect(validationMessage).toBeTruthy();
  });

  test('validates webhook URL format', async ({ page }) => {
    await page.fill('#form-name', 'Test Form');
    await page.fill('#form-webhook', 'not-a-valid-url');

    // Try to submit
    await page.click('.modal-footer .btn-primary');

    // HTML5 validation should prevent submission
    const webhookInput = page.locator('#form-webhook');
    const validationMessage = await webhookInput.evaluate((el: HTMLInputElement) => el.validationMessage);
    expect(validationMessage).toBeTruthy();
  });

  test('can create basic form', async ({ page }) => {
    // Mock successful form creation
    await page.route('/api/forms', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            form: {
              id: 'new-form-123',
              name: testFormData.basic.name,
              status: 'active',
              submissionCount: 0,
              createdAt: new Date().toISOString(),
            },
            privateKey: {
              kty: 'RSA',
              n: 'test-key-data',
              e: 'AQAB',
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Fill form
    await page.fill('#form-name', testFormData.basic.name);

    // Submit
    await page.click('.modal-footer .btn-primary');

    // Should show private key modal
    await expect(page.locator('.modal-warning')).toBeVisible();
    await expect(page.locator('.modal h2')).toContainText('Save Your Private Key');
  });

  test('can create form with PII detection enabled', async ({ page }) => {
    await page.route('/api/forms', async (route) => {
      if (route.request().method() === 'POST') {
        const postData = route.request().postDataJSON();
        expect(postData.settings.piiStrip).toBe(true);

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            form: {
              id: 'new-form-456',
              name: postData.name,
              status: 'active',
              submissionCount: 0,
              createdAt: new Date().toISOString(),
            },
            privateKey: { kty: 'RSA', n: 'test', e: 'AQAB' },
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Fill form
    await page.fill('#form-name', testFormData.withPII.name);

    // Enable PII detection
    const piiCheckbox = page.locator('input[type="checkbox"]').first();
    await piiCheckbox.check();

    // Submit
    await page.click('.modal-footer .btn-primary');

    // Should show private key modal
    await expect(page.locator('.modal-warning')).toBeVisible();
  });

  test('can create form with webhook', async ({ page }) => {
    await page.route('/api/forms', async (route) => {
      if (route.request().method() === 'POST') {
        const postData = route.request().postDataJSON();
        expect(postData.settings.webhookUrl).toBe(testFormData.withWebhook.webhook);

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            form: {
              id: 'new-form-789',
              name: postData.name,
              status: 'active',
              submissionCount: 0,
              createdAt: new Date().toISOString(),
            },
            privateKey: { kty: 'RSA', n: 'test', e: 'AQAB' },
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Fill form
    await page.fill('#form-name', testFormData.withWebhook.name);
    await page.fill('#form-webhook', testFormData.withWebhook.webhook);

    // Submit
    await page.click('.modal-footer .btn-primary');

    // Should show private key modal
    await expect(page.locator('.modal-warning')).toBeVisible();
  });

  test('shows loading state during creation', async ({ page }) => {
    // Mock a delayed response
    await page.route('/api/forms', async (route) => {
      if (route.request().method() === 'POST') {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            form: { id: 'test', name: 'Test', status: 'active', submissionCount: 0, createdAt: new Date().toISOString() },
            privateKey: { kty: 'RSA', n: 'test', e: 'AQAB' },
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.fill('#form-name', 'Test Form');
    const submitButton = page.locator('.modal-footer .btn-primary');
    await submitButton.click();

    // Should show loading state
    await expect(submitButton).toContainText('Creating...');
    await expect(submitButton).toBeDisabled();
  });

  test('shows error on creation failure', async ({ page }) => {
    await page.route('/api/forms', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Form name already exists' }),
        });
      } else {
        await route.continue();
      }
    });

    await page.fill('#form-name', 'Test Form');
    await page.click('.modal-footer .btn-primary');

    // Should show error message
    await expect(page.locator('.error-message')).toBeVisible();
    await expect(page.locator('.error-message')).toContainText('Form name already exists');
  });

  test('can cancel form creation', async ({ page }) => {
    await page.fill('#form-name', 'Test Form');
    await page.click('.modal-footer .btn-secondary');

    // Modal should be closed
    await expect(page.locator('.modal')).not.toBeVisible();
  });

  test('can close modal with X button', async ({ page }) => {
    await page.click('.modal-close');

    // Modal should be closed
    await expect(page.locator('.modal')).not.toBeVisible();
  });
});

test.describe('Private Key Modal', () => {
  test.beforeEach(async ({ page }) => {
    // Set up authenticated state and open create form modal
    await page.goto('/dashboard');
    await page.evaluate(() => {
      localStorage.setItem('veilforms_token', 'mock-test-token-12345');
    });

    await page.route('/api/forms', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ forms: [] }),
        });
      } else if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            form: {
              id: 'new-form',
              name: 'Test Form',
              status: 'active',
              submissionCount: 0,
              createdAt: new Date().toISOString(),
            },
            privateKey: {
              kty: 'RSA',
              n: 'test-modulus-data',
              e: 'AQAB',
            },
          }),
        });
      }
    });

    await page.reload();
    await page.click('.btn-primary');
    await page.waitForSelector('.modal');
    await page.fill('#form-name', 'Test Form');
    await page.click('.modal-footer .btn-primary');
    await page.waitForSelector('.modal-warning');
  });

  test('shows private key modal after creation', async ({ page }) => {
    await expect(page.locator('.modal-warning')).toBeVisible();
    await expect(page.locator('.modal h2')).toContainText('Save Your Private Key');
    await expect(page.locator('.warning-box')).toBeVisible();
    await expect(page.locator('.warning-box')).toContainText('only time');
  });

  test('displays private key in textarea', async ({ page }) => {
    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible();

    const keyValue = await textarea.inputValue();
    expect(keyValue).toContain('kty');
    expect(keyValue).toContain('RSA');
  });

  test('has copy and download buttons', async ({ page }) => {
    await expect(page.getByText('Copy to Clipboard')).toBeVisible();
    await expect(page.getByText('Download as File')).toBeVisible();
  });

  test('requires confirmation checkbox before closing', async ({ page }) => {
    const continueButton = page.locator('.modal-footer .btn-primary');

    // Should be disabled initially
    await expect(continueButton).toBeDisabled();

    // Check confirmation checkbox
    const checkbox = page.locator('input[type="checkbox"]');
    await checkbox.check();

    // Should now be enabled
    await expect(continueButton).toBeEnabled();
  });

  test('can close modal after confirmation', async ({ page }) => {
    // Check confirmation
    const checkbox = page.locator('input[type="checkbox"]');
    await checkbox.check();

    // Click continue
    await page.click('.modal-footer .btn-primary');

    // Modal should be closed
    await expect(page.locator('.modal-warning')).not.toBeVisible();
  });
});
