import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime('2031-05-14T10:30:00');
  await page.goto('/?tab=pets');
});

test('a pet page shows the profile, the weight trend and the records', async ({ page }) => {
  await expect(page.getByRole('region', { name: "Biscuit's profile" })).toContainText('Allergic to chicken');
  const weight = page.getByRole('region', { name: "Biscuit's weight" });
  await expect(weight).toContainText('26.1 lb');
  await expect(weight).toContainText('Up 1.9 lb in 6 months');
  await expect(weight.getByRole('img', { name: /^Weight from 24\.2 lb/ })).toBeVisible();
  await expect(page.getByRole('region', { name: "Biscuit's records" })).toContainText('Chicken allergy confirmed');
});

test('logging a weight updates the latest and can be undone', async ({ page }) => {
  const weight = page.getByRole('region', { name: "Biscuit's weight" });
  await weight.getByRole('button', { name: 'Log weight' }).click();
  const dialog = page.getByRole('dialog', { name: 'Weigh Biscuit' });
  await dialog.getByLabel('Weight').fill('26.4');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(weight).toContainText('26.4 lb');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(weight.getByText('26.1 lb').first()).toBeVisible();
});

test('adding a pet gives it an AM and PM board; removing it can be undone', async ({ page }) => {
  await page.getByRole('button', { name: 'Add pet' }).click();
  const dialog = page.getByRole('dialog', { name: 'New pet' });
  await dialog.getByLabel('Name').fill('Pip');
  await dialog.getByRole('button', { name: 'Rabbit' }).click();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('region', { name: "Pip's profile" })).toContainText('Rabbit');
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Pip AM: not fed yet/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Pip PM: not yet/ })).toBeVisible();

  await page.getByRole('button', { name: 'Pets', exact: true }).click();
  await page.getByRole('button', { name: 'Miso', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Miso' }).click();
  await page.getByRole('dialog', { name: 'Edit Miso' }).getByRole('button', { name: 'Remove pet' }).click();
  await expect(page.getByText('Removed Miso')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Miso', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.getByRole('button', { name: 'Miso', exact: true }).click();
  await expect(page.getByRole('region', { name: "Miso's records" })).toContainText('Kidney diet started');
});

test('a record can be added and edited', async ({ page }) => {
  const records = page.getByRole('region', { name: "Biscuit's records" });
  await records.getByRole('button', { name: 'Add record' }).click();
  const dialog = page.getByRole('dialog', { name: 'New record for Biscuit' });
  await dialog.getByLabel('Title').fill('Dental check');
  await dialog.getByLabel('Details (optional)').fill('Teeth look fine.');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(records).toContainText('Dental check');
});

test('a target weight shows the gap, the direction and a line on the chart', async ({ page }) => {
  const weight = page.getByRole('region', { name: "Biscuit's weight" });
  await expect(weight).toContainText('2.1 lb to lose · target 24.0 lb (Vet\'s goal) · Moving away from the target');
  await expect(weight.getByTestId('chart-target-line')).toBeAttached();
  await expect(page.getByRole('region', { name: "Biscuit's profile" })).toContainText('Target 24.0 lb: 2.1 lb to lose');

  await page.getByRole('button', { name: 'Edit Biscuit' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit Biscuit' });
  await dialog.getByLabel('Target weight in lb (optional)').fill('26');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(weight).toContainText('On target');
});
