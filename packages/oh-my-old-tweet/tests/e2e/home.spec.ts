import { test, expect } from '@playwright/test';

test.describe('home page', () => {
  test('renders the title and Browse button', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Oh my Old Tweet/i);
    await expect(page.getByRole('button', { name: /browse/i })).toBeVisible();
  });

  test('typing a username and submitting navigates to the user page', async ({ page }) => {
    await page.goto('/');
    const input = page.getByPlaceholder('username or profile URL');
    await input.fill('jack');
    await page.getByRole('button', { name: /browse/i }).click();
    await expect(page).toHaveURL(/#\/jack/);
  });

  test('does not overflow horizontally on a narrow phone viewport', async ({ page }) => {
    await page.setViewportSize({ width: 280, height: 740 });
    await page.goto('/');

    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );

    expect(hasOverflow).toBe(false);
  });
});
