import { expect, test } from '@playwright/test';
import {
  expectCleanLoad,
  expectBottomNav,
  expectCompactSampleBanner,
  expectGoogleSignInPopup,
  expectHuishoudenFrame,
  expectInstallable,
  expectSecurityHeaders,
  expectThemeConsistent,
} from '@huishouden/pwa-kit/e2e';
import { SUITE_ORIGIN } from '@huishouden/pwa-kit/site';

test('loads without runtime errors and shows the sample board', async ({ page }) => {
  await expectCleanLoad(page);
  await expect(page.getByText('Sample data')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Needs doing' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Feeding' })).toBeVisible();
  await expectHuishoudenFrame(page, { app: 'Pet', portalUrl: '/' });
  await expect(page).toHaveTitle('Huishouden Pet');
});

test('link previews say what Pet is', async ({ page, request }) => {
  await page.goto('./');
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', 'Looking after the pets, together');
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', `${SUITE_ORIGIN}/pet/og.png`);
  expect((await request.get('./og.png')).ok()).toBe(true);
});

test('is installable', ({ page, request }) => expectInstallable(page, request));

test('Google sign-in popup reaches Google with an allowed redirect URI', ({ page, context }) =>
  expectGoogleSignInPopup(page, context, async (p) => {
    await p.getByRole('button', { name: 'Sign in with Google' }).first().click();
  }));

test('sends the security headers and leaves sign-in un-framed', ({ request }) => expectSecurityHeaders(request, './', { camera: true }));

test('the Sample data banner is one line on a phone', ({ page }) => expectCompactSampleBanner(page, './'));

test('on a phone the sections are a bottom bar, with Contacts under More', ({ page }) => expectBottomNav(page, { path: './', labels: ['Today', 'Care', 'Visits', 'Pets', 'More'], more: ['Contacts'] }));

test('follows the suite theme: dark on a dark device, readable', ({ page }) => expectThemeConsistent(page, { path: './' }));
