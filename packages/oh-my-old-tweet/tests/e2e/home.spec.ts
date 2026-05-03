import { test, expect } from '@playwright/test';

test.describe('home page', () => {
  test('renders the title and Start button', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Oh my Old Tweet/i);
    await expect(page.getByRole('button', { name: /start/i })).toBeVisible();
  });

  test('typing a username and submitting navigates to the user page', async ({ page }) => {
    await page.goto('/');
    const input = page.locator('input#website-admin');
    await input.fill('jack');
    await page.getByRole('button', { name: /start/i }).click();
    await expect(page).toHaveURL(/\/jack/);
  });
});
