import { expect, test } from '@playwright/test';
import { expectCleanLoad, expectGoogleSignInPopup, expectHuishoudenFrame, expectInstallable } from '@huishouden/pwa-kit/e2e';

test('loads without runtime errors and shows the sample board', async ({ page }) => {
  await expectCleanLoad(page);
  await expect(page.getByText('Sample data')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Feeding' })).toBeVisible();
  await expectHuishoudenFrame(page, { app: 'Pet', portalUrl: 'https://huishouden-piekstra.web.app' });
  await expect(page).toHaveTitle('Huishouden Pet');
});

test('link previews say what Pet is', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', 'Looking after the pets, together');
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', 'https://huishouden-pet.web.app/og.png');
  expect((await request.get('/og.png')).ok()).toBe(true);
});

test('is installable', ({ page, request }) => expectInstallable(page, request));

test('Google sign-in popup reaches Google with an allowed redirect URI', ({ page, context }) =>
  expectGoogleSignInPopup(page, context, async (p) => {
    await p.getByRole('button', { name: 'Sign in with Google' }).first().click();
  }));
