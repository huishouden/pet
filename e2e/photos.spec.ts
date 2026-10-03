import { expect, test } from '@playwright/test';

// Pet photos in the sample (signed out, nothing saved): invented illustrations, and a photo chosen
// from a file (e2e/fixtures/pet-photo.jpg, a drawing) made small in the browser.

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime('2031-05-14T10:30:00');
  await page.goto('./');
});

const photoOf = (scope: ReturnType<import('@playwright/test').Page['locator']>) => scope.locator('img[src^="data:image/webp;base64,"]');

test('the sample pets show their pictures on the board and their cards', async ({ page }) => {
  const board = page.getByRole('region', { name: 'Feeding' });
  await expect(photoOf(board.locator('li').filter({ hasText: 'Biscuit' }))).toHaveCount(1);
  await expect(photoOf(board.locator('li').filter({ hasText: 'Miso' }))).toHaveCount(1);
  await page.getByRole('button', { name: 'Pets', exact: true }).click();
  await expect(photoOf(page.getByRole('region', { name: "Biscuit's profile" }))).toHaveCount(1);
});

test('choosing a photo makes it small and shows it; Remove photo goes back to the icon', async ({ page }) => {
  await page.getByRole('button', { name: 'Pets', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Biscuit' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit Biscuit' });
  const chooser = page.waitForEvent('filechooser');
  await dialog.getByRole('button', { name: "Change Biscuit's photo" }).click();
  await (await chooser).setFiles('e2e/fixtures/pet-photo.jpg');
  await expect(dialog.getByLabel('Position')).toBeVisible();
  await dialog.getByRole('button', { name: 'Use photo' }).click();
  const src = await photoOf(dialog).first().getAttribute('src');
  expect(src!.length).toBeLessThan(60_000);
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText("Saved Biscuit's photo")).toBeVisible();
  const card = page.getByRole('region', { name: "Biscuit's profile" });
  await expect(card.locator('img').first()).toHaveAttribute('src', src!);

  await page.getByRole('button', { name: 'Edit Biscuit' }).click();
  await dialog.getByRole('button', { name: 'Remove photo' }).click();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(card.locator('img')).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(card.locator('img').first()).toHaveAttribute('src', src!);
});
