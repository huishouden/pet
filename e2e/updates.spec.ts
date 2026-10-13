import { expect, test, type Page } from '@playwright/test';
import { buildVersions, expectUpdateWithoutReload, pageMarked, serveBuilds, updateButton, type BuildServer } from '@huishouden/pwa-kit/e2e-update';
import { stubOpenStreetMap } from '@huishouden/pwa-kit/e2e';

// A deploy under an open page (kit STANDARD.md "Updates"): build A and build B of this branch,
// served locally; the page on A must not reload when B arrives, and keeps its screen and input.

const currentTab = (page: Page) => page.locator('nav[slot="nav"] button[aria-current="page"]');

test.describe('a new version while the app is open', () => {
  test.describe.configure({ mode: 'serial', timeout: 240_000 });
  let builds: Record<string, string>;
  let server: BuildServer;

  test.beforeAll(async () => {
    test.setTimeout(240_000);
    builds = buildVersions(['1.0.0-a', '1.0.0-b']);
    server = await serveBuilds(builds, '/pet/');
  });
  test.afterAll(async () => server?.close());

  test('no reload under a half-filled form; it applies when the page is hidden with nothing unsaved, back on the same tab', async ({ page }) => {
    await stubOpenStreetMap(page);
    const dialog = page.getByRole('dialog', { name: 'New contact' });
    await expectUpdateWithoutReload(page, {
      server,
      builds,
      from: '1.0.0-a',
      to: '1.0.0-b',
      open: async (p) => {
        await p.goto(`${server.url}?tab=contacts`);
        await p.getByRole('button', { name: 'Add contact' }).click();
        await dialog.getByLabel('Phone').fill('(555) 010-0199');
      },
      check: async (p) => {
        await expect(currentTab(p)).toHaveText('Contacts');
        await expect(dialog.getByLabel('Phone')).toHaveValue('(555) 010-0199');
      },
      clear: async () => {
        await dialog.getByRole('button', { name: 'Close' }).click();
        await expect(dialog).toHaveCount(0);
      },
      checkAfter: async (p) => {
        await expect(p).toHaveURL(/\?tab=contacts$/);
        await expect(currentTab(p)).toHaveText('Contacts');
      },
    });
  });

  test('the Update button applies it at once, on the same tab', async ({ page }) => {
    server.use('1.0.0-a');
    await page.goto(`${server.url}?tab=care`);
    // The browser still holds B from the test before; serve A, then B again, as two deploys.
    await page.evaluate(async () => {
      for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
    });
    await page.reload();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    server.use('1.0.0-b');
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.update());
    await expect(updateButton(page)).toBeVisible({ timeout: 30_000 });
    expect(await pageMarked(page)).toBe(false);
    await page.evaluate(() => ((window as unknown as { __hhMark: number }).__hhMark = 1));
    const reloaded = page.waitForEvent('load');
    await updateButton(page).click();
    await reloaded;
    expect(await pageMarked(page)).toBe(false);
    await expect(currentTab(page)).toHaveText('Care');
    await expect(updateButton(page)).toBeHidden();
  });
});

test('a reload and Back return to the screen in the address', async ({ page }) => {
  await page.goto('./');
  await expect(currentTab(page)).toHaveText('Today');
  await page.getByRole('button', { name: 'Care', exact: true }).first().click();
  await expect(page).toHaveURL(/\?tab=care$/);
  await page.getByRole('button', { name: 'Pets', exact: true }).first().click();
  await expect(page).toHaveURL(/\?tab=pets/);
  await page.reload();
  await expect(currentTab(page)).toHaveText('Pets');
  await page.goBack();
  await expect(currentTab(page)).toHaveText('Care');
  await page.goForward();
  await expect(currentTab(page)).toHaveText('Pets');
});
