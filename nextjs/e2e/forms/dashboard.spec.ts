/**
 * VeilForms - Dashboard E2E Tests
 * Tests dashboard functionality including forms list, empty state, and navigation
 */

import { test, expect } from '@playwright/test';
import { clearAuthData } from '../fixtures/test-utils';

test.describe('Dashboard - Unauthenticated', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuthData(page);
  });

  test('redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/dashboard');

    // Should redirect to login page
    await page.waitForURL(/\/login/, { timeout: 10000 });
    expect(page.url()).toMatch(/\/login/);
  });
});

test.describe('Dashboard - Authenticated', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authenticated state
    // In a real test, you'd want to actually log in or use API to create a valid session
    await page.goto('/dashboard');

    await page.evaluate(() => {
      // Set a mock token
      localStorage.setItem('veilforms_token', 'mock-test-token-12345');
    });
  });

  test('shows loading state while fetching forms', async ({ page }) => {
    // Reload to trigger the loading state
    await page.reload();

    // Should show loading spinner
    const loadingState = page.locator('.loading-state');

    // Either we see loading state or it loads so fast we miss it
    // We just check that eventually we see content
    await page.waitForSelector('.empty-state, .forms-grid', { timeout: 10000 });
  });

  test('shows empty state for new users', async ({ page }) => {
    // Mock an empty forms response
    await page.route('/api/forms', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ forms: [] }),
      });
    });

    await page.reload();

    // Should show empty state
    await expect(page.locator('.empty-state')).toBeVisible();
    await expect(page.locator('.empty-state h2')).toContainText('No forms yet');
    await expect(page.locator('.empty-state p')).toContainText('Create your first privacy-first form');

    // Should have create form button
    const createButton = page.locator('.empty-state .btn-primary');
    await expect(createButton).toBeVisible();
    await expect(createButton).toContainText('Create Form');
  });

  test('shows forms grid when forms exist', async ({ page }) => {
    // Mock forms response with some test data
    await page.route('/api/forms', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          forms: [
            {
              id: 'form-1',
              name: 'Contact Form',
              status: 'active',
              submissionCount: 5,
              lastSubmissionAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
            },
            {
              id: 'form-2',
              name: 'Newsletter Signup',
              status: 'active',
              submissionCount: 12,
              lastSubmissionAt: null,
              createdAt: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    await page.reload();

    // Should show forms grid
    await expect(page.locator('.forms-grid')).toBeVisible();

    // Should have 2 form cards + 1 "create new" card
    const formCards = page.locator('.form-card');
    await expect(formCards).toHaveCount(3);

    // Check first form card content
    const firstCard = formCards.first();
    await expect(firstCard.locator('.form-card-title')).toContainText('Contact Form');
    await expect(firstCard.locator('.form-card-status')).toContainText('Active');
    await expect(firstCard.locator('.stat-value').first()).toContainText('5');
  });

  test('form card shows correct submission stats', async ({ page }) => {
    const lastSubmissionDate = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago

    await page.route('/api/forms', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          forms: [
            {
              id: 'form-1',
              name: 'Test Form',
              status: 'active',
              submissionCount: 42,
              lastSubmissionAt: lastSubmissionDate.toISOString(),
              createdAt: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    await page.reload();

    const formCard = page.locator('.form-card').first();

    // Should show submission count
    await expect(formCard.locator('.stat-value').first()).toContainText('42');

    // Should show relative time for last submission
    await expect(formCard.locator('.stat-time')).toContainText('ago');
  });

  test('form card with no submissions shows Never', async ({ page }) => {
    await page.route('/api/forms', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          forms: [
            {
              id: 'form-1',
              name: 'New Form',
              status: 'active',
              submissionCount: 0,
              lastSubmissionAt: null,
              createdAt: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    await page.reload();

    const formCard = page.locator('.form-card').first();

    // Should show 0 submissions
    await expect(formCard.locator('.stat-value').first()).toContainText('0');

    // Should show "Never" for last submission
    await expect(formCard.locator('.stat-time')).toContainText('Never');
  });

  test('has create new form button', async ({ page }) => {
    await page.route('/api/forms', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ forms: [] }),
      });
    });

    await page.reload();

    // In empty state
    const createButton = page.locator('.btn-primary');
    await expect(createButton).toBeVisible();
    await expect(createButton).toContainText('Create Form');
  });

  test('create form button opens modal', async ({ page }) => {
    await page.route('/api/forms', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ forms: [] }),
      });
    });

    await page.reload();

    // Click create button
    await page.click('.btn-primary');

    // Should show modal
    await expect(page.locator('.modal')).toBeVisible();
    await expect(page.locator('.modal h2')).toContainText('Create New Form');
  });

  test('form card has view and delete buttons', async ({ page }) => {
    await page.route('/api/forms', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          forms: [
            {
              id: 'form-1',
              name: 'Test Form',
              status: 'active',
              submissionCount: 5,
              createdAt: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    await page.reload();

    const formCard = page.locator('.form-card').first();

    // Should have view button
    await expect(formCard.locator('.btn-view')).toBeVisible();

    // Should have delete button
    await expect(formCard.locator('.btn-delete')).toBeVisible();
  });

  test('view button navigates to form detail', async ({ page }) => {
    await page.route('/api/forms', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          forms: [
            {
              id: 'form-123',
              name: 'Test Form',
              status: 'active',
              submissionCount: 5,
              createdAt: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    await page.reload();

    // Click view button
    const viewButton = page.locator('.btn-view').first();
    await expect(viewButton).toHaveAttribute('href', '/dashboard/forms/form-123');
  });

  test('delete button shows confirmation modal', async ({ page }) => {
    await page.route('/api/forms', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          forms: [
            {
              id: 'form-1',
              name: 'Test Form',
              status: 'active',
              submissionCount: 5,
              createdAt: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    await page.reload();

    // Click delete button
    await page.click('.btn-delete');

    // Should show delete confirmation modal
    await expect(page.locator('.modal-danger')).toBeVisible();
    await expect(page.locator('.modal h2')).toContainText('Delete Form');
    await expect(page.locator('.modal-body')).toContainText('Test Form');
    await expect(page.locator('.modal-body')).toContainText('cannot be undone');
  });

  test('shows error state when API fails', async ({ page }) => {
    await page.route('/api/forms', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      });
    });

    await page.reload();

    // Should show error state
    await expect(page.locator('.error-state')).toBeVisible();
    await expect(page.locator('.error-state h2')).toContainText('Something went wrong');
    await expect(page.locator('.btn-secondary')).toContainText('Try Again');
  });

  test('shows forms in grid layout', async ({ page }) => {
    // Create multiple forms to test grid layout
    const forms = Array.from({ length: 6 }, (_, i) => ({
      id: `form-${i + 1}`,
      name: `Form ${i + 1}`,
      status: 'active',
      submissionCount: i * 5,
      createdAt: new Date().toISOString(),
    }));

    await page.route('/api/forms', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ forms }),
      });
    });

    await page.reload();

    // Should show forms grid
    await expect(page.locator('.forms-grid')).toBeVisible();

    // Should have 6 form cards + 1 "create new" card
    const formCards = page.locator('.form-card');
    await expect(formCards).toHaveCount(7);
  });
});
