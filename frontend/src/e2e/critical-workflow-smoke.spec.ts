import { expect, test } from '@playwright/test';

const primaryRoutes = [
  '/',
  '/login',
  '/frameworks',
  '/frameworks/upgrade',
  '/controls',
  '/evidence',
  '/tasks',
  '/reports',
  '/auditor-access',
  '/auditor-view',
  '/retention',
  '/settings',
];

test.describe('Pass 38/51 critical workflow smoke shell', () => {
  for (const route of primaryRoutes) {
    test(`route ${route} renders without a blank shell`, async ({ page }) => {
      await page.goto(route);
      await expect(page.locator('#main-content')).toBeVisible();
      await expect(page.locator('body')).not.toContainText('storage_key');
    });
  }
});
