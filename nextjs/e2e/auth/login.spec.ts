/**
 * VeilForms - Login E2E Tests
 * Tests user login flow including validation, error handling, and success cases
 */

import { test, expect } from '@playwright/test';
import { generateTestEmail, clearAuthData } from '../fixtures/test-utils';

test.describe('User Login', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing auth data
    await clearAuthData(page);
    await page.goto('/login');
  });

  test('shows login form', async ({ page }) => {
    // Check page title and subtitle
    await expect(page.locator('h1')).toContainText('Welcome back');
    await expect(page.locator('.subtitle')).toContainText('Sign in to your VeilForms account');

    // Check form fields exist
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // Check OAuth buttons
    await expect(page.locator('.btn-github')).toBeVisible();
    await expect(page.locator('.btn-google')).toBeVisible();

    // Check links
    await expect(page.locator('a[href="/forgot"]')).toBeVisible();
    await expect(page.locator('a[href="/register"]')).toBeVisible();
  });

  test('rejects invalid credentials', async ({ page }) => {
    const email = generateTestEmail();
    const password = 'WrongPassword123!';

    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.click('button[type="submit"]');

    // Should show error message
    await expect(page.locator('.error-message')).toBeVisible();

    // Error message should indicate invalid credentials
    const errorText = await page.locator('.error-message').textContent();
    expect(errorText).toBeTruthy();

    // Should still be on login page
    expect(page.url()).toContain('/login');
  });

  test('shows loading state during login', async ({ page }) => {
    const email = 'test@example.com';
    const password = 'TestPassword123!';

    await page.fill('#email', email);
    await page.fill('#password', password);

    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // Should show loading text immediately
    await expect(submitButton).toContainText('Signing in...');
    await expect(submitButton).toBeDisabled();
  });

  test('validates required fields', async ({ page }) => {
    // Try to submit without filling fields
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // HTML5 validation should prevent submission
    const emailInput = page.locator('#email');
    const validationMessage = await emailInput.evaluate((el: HTMLInputElement) => el.validationMessage);
    expect(validationMessage).toBeTruthy();
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

  test('has forgot password link', async ({ page }) => {
    const forgotLink = page.locator('a[href="/forgot"]');
    await expect(forgotLink).toBeVisible();
    await expect(forgotLink).toContainText('Forgot your password?');
  });

  test('has sign up link', async ({ page }) => {
    const registerLink = page.locator('a[href="/register"]');
    await expect(registerLink).toBeVisible();
    await expect(registerLink).toContainText('Sign up');
  });

  test('has correct OAuth provider buttons', async ({ page }) => {
    // Check GitHub OAuth button
    const githubButton = page.locator('.btn-github');
    await expect(githubButton).toBeVisible();
    await expect(githubButton).toContainText('Continue with GitHub');

    // Check Google OAuth button
    const googleButton = page.locator('.btn-google');
    await expect(googleButton).toBeVisible();
    await expect(googleButton).toContainText('Continue with Google');
  });

  test('redirects to dashboard if already authenticated', async ({ page }) => {
    // Mock an authenticated state by setting localStorage
    await page.evaluate(() => {
      localStorage.setItem('veilforms_token', 'fake-token-for-redirect-test');
    });

    // Try to visit login page
    await page.goto('/login');

    // Should redirect to dashboard
    await page.waitForURL('/dashboard', { timeout: 10000 });
    expect(page.url()).toContain('/dashboard');
  });

  test('handles unverified email', async ({ page }) => {
    // This test assumes you have an unverified user
    // In practice, you might need to register a new user without verifying
    const email = 'unverified@test.com';
    const password = 'TestPassword123!';

    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.click('button[type="submit"]');

    // Should either show error or redirect to verify page
    await page.waitForSelector('.error-message, [class*="verify"]', { timeout: 5000 });

    const currentUrl = page.url();
    const hasError = await page.locator('.error-message').isVisible().catch(() => false);

    // Either we get an error or we're redirected to verify
    expect(hasError || currentUrl.includes('/verify')).toBeTruthy();
  });

  test('shows rate limiting message after failed attempts', async ({ page }) => {
    const email = 'test@example.com';
    const password = 'WrongPassword123!';

    // Attempt login multiple times with wrong password
    for (let i = 0; i < 3; i++) {
      await page.fill('#email', email);
      await page.fill('#password', password);
      await page.click('button[type="submit"]');

      // Wait for error to appear
      await page.waitForSelector('.error-message', { timeout: 5000 });

      // Small delay between attempts
      await page.waitForTimeout(500);
    }

    // After multiple failed attempts, should show attempts remaining or locked message
    const errorText = await page.locator('.error-message').textContent();
    expect(errorText).toBeTruthy();

    // Error should mention attempts or locking
    const hasRateLimitInfo = errorText?.includes('attempt') || errorText?.includes('locked');
    expect(hasRateLimitInfo).toBeTruthy();
  });

  test('password field has correct attributes', async ({ page }) => {
    const passwordInput = page.locator('#password');

    // Should be password type
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Should have autocomplete attribute
    await expect(passwordInput).toHaveAttribute('autocomplete', 'current-password');

    // Should be required
    await expect(passwordInput).toHaveAttribute('required');
  });

  test('email field has correct attributes', async ({ page }) => {
    const emailInput = page.locator('#email');

    // Should be email type
    await expect(emailInput).toHaveAttribute('type', 'email');

    // Should have autocomplete attribute
    await expect(emailInput).toHaveAttribute('autocomplete', 'email');

    // Should be required
    await expect(emailInput).toHaveAttribute('required');
  });
});

test.describe('Successful Login Flow', () => {
  test('successfully logs in with valid credentials', async ({ page }) => {
    // This test requires a pre-existing user account
    // In CI/CD, you might create this user in a setup script
    // For now, we'll skip this test if no valid credentials are available

    const testEmail = process.env.E2E_TEST_USER_EMAIL;
    const testPassword = process.env.E2E_TEST_USER_PASSWORD;

    if (!testEmail || !testPassword) {
      test.skip();
      return;
    }

    await page.goto('/login');
    await page.fill('#email', testEmail);
    await page.fill('#password', testPassword);
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await page.waitForURL('/dashboard', { timeout: 10000 });
    expect(page.url()).toContain('/dashboard');

    // Should have auth token in localStorage
    const token = await page.evaluate(() => localStorage.getItem('veilforms_token'));
    expect(token).toBeTruthy();
  });
});
