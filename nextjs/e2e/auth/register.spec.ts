/**
 * VeilForms - Registration E2E Tests
 * Tests user registration flow including validation and success cases
 */

import { test, expect } from '@playwright/test';
import { generateTestCredentials, generateTestEmail } from '../fixtures/test-utils';

test.describe('User Registration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
  });

  test('shows registration form', async ({ page }) => {
    // Check page title and subtitle
    await expect(page.locator('h1')).toContainText('Create account');
    await expect(page.locator('.subtitle')).toContainText('Start building privacy-first forms');

    // Check feature list is displayed
    await expect(page.locator('.feature-list')).toBeVisible();
    await expect(page.locator('.feature-list li')).toHaveCount(3);
    await expect(page.locator('.feature-list li').first()).toContainText('Client-side encryption');

    // Check form fields exist
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // Check OAuth buttons
    await expect(page.locator('.btn-github')).toBeVisible();
    await expect(page.locator('.btn-google')).toBeVisible();

    // Check link to login page
    await expect(page.locator('a[href="/login"]')).toBeVisible();
  });

  test('validates password requirements', async ({ page }) => {
    const email = generateTestEmail();

    await page.fill('#email', email);

    // Type a weak password
    await page.fill('#password', 'weak');

    // Check password requirements indicators
    const requirements = page.locator('.password-requirements li');
    await expect(requirements).toHaveCount(4);

    // All should be invalid initially
    await expect(requirements.nth(0)).not.toHaveClass(/valid/);
    await expect(requirements.nth(1)).not.toHaveClass(/valid/);
    await expect(requirements.nth(2)).not.toHaveClass(/valid/);
    await expect(requirements.nth(3)).not.toHaveClass(/valid/);

    // Type a password that meets all requirements
    await page.fill('#password', 'TestPassword123!');

    // All requirements should now be valid
    await expect(requirements.nth(0)).toHaveClass(/valid/);
    await expect(requirements.nth(1)).toHaveClass(/valid/);
    await expect(requirements.nth(2)).toHaveClass(/valid/);
    await expect(requirements.nth(3)).toHaveClass(/valid/);
  });

  test('shows error for weak password on submit', async ({ page }) => {
    const email = generateTestEmail();

    await page.fill('#email', email);
    await page.fill('#password', 'weak');
    await page.click('button[type="submit"]');

    // Should show password requirements error
    await expect(page.locator('.error-message')).toBeVisible();
    await expect(page.locator('.error-message')).toContainText('Password requirements');
  });

  test('shows error for existing email', async ({ page }) => {
    // This test assumes a user with this email exists
    // In a real test environment, you might want to create a user first
    const existingEmail = 'existing@test.com';
    const password = 'TestPassword123!';

    await page.fill('#email', existingEmail);
    await page.fill('#password', password);
    await page.click('button[type="submit"]');

    // Wait for the error message (this might take a moment)
    await page.waitForSelector('.error-message', { timeout: 5000 });

    // The error should indicate the email is already in use
    const errorText = await page.locator('.error-message').textContent();
    expect(errorText).toBeTruthy();
  });

  test('successfully registers new user', async ({ page }) => {
    const credentials = generateTestCredentials();

    await page.fill('#email', credentials.email);
    await page.fill('#password', credentials.password);

    // Click submit button
    await page.click('button[type="submit"]');

    // Should redirect to verify page
    await page.waitForURL('/verify', { timeout: 10000 });

    // Verify we're on the verification page
    expect(page.url()).toContain('/verify');
  });

  test('shows loading state during registration', async ({ page }) => {
    const credentials = generateTestCredentials();

    await page.fill('#email', credentials.email);
    await page.fill('#password', credentials.password);

    // Click submit button
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // Should show loading text
    await expect(submitButton).toContainText('Creating account...');
    await expect(submitButton).toBeDisabled();
  });

  test('redirects to dashboard if already authenticated', async ({ page }) => {
    // Mock an authenticated state by setting localStorage
    await page.evaluate(() => {
      localStorage.setItem('veilforms_token', 'fake-token-for-redirect-test');
    });

    // Try to visit register page
    await page.goto('/register');

    // Should redirect to dashboard
    // Note: This might fail if the auth check is async
    await page.waitForURL('/dashboard', { timeout: 10000 });
    expect(page.url()).toContain('/dashboard');
  });

  test('validates email format', async ({ page }) => {
    await page.fill('#email', 'invalid-email');
    await page.fill('#password', 'TestPassword123!');

    // Try to submit
    await page.click('button[type="submit"]');

    // HTML5 validation should prevent submission
    const emailInput = page.locator('#email');
    const validationMessage = await emailInput.evaluate((el: HTMLInputElement) => el.validationMessage);
    expect(validationMessage).toBeTruthy();
  });

  test('has correct OAuth provider links', async ({ page }) => {
    // Check GitHub OAuth button
    const githubButton = page.locator('.btn-github');
    await expect(githubButton).toBeVisible();
    await expect(githubButton).toContainText('Sign up with GitHub');

    // Check Google OAuth button
    const googleButton = page.locator('.btn-google');
    await expect(googleButton).toBeVisible();
    await expect(googleButton).toContainText('Sign up with Google');

    // Clicking these would redirect to OAuth provider
    // We don't test that in E2E as it requires external auth
  });
});
