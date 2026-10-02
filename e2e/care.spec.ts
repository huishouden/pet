import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime('2031-05-14T10:30:00');
});

test('Today leads with what is overdue, and Given moves it on with an undo', async ({ page }) => {
  await page.goto('/');
  const needs = page.getByRole('region', { name: 'Needs doing' });
  await expect(needs.getByRole('listitem').first()).toContainText('Flea and tick for Biscuit');
  await expect(needs.getByRole('listitem').first()).toContainText('Overdue by 2 days');
  await expect(page.getByRole('region', { name: 'Coming up' }).getByText('Heartworm prevention due in 3 days')).toBeVisible();
  await needs.getByRole('button', { name: 'Given: Flea and tick for Biscuit' }).click();
  await expect(page.getByText(/Flea and tick given to Biscuit\. Next due .*Jun 14/)).toBeVisible();
  await expect(needs.getByText('Flea and tick for Biscuit')).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(needs.getByText('Flea and tick for Biscuit')).toBeVisible();
});

test('Care groups reminders by when they are due, filtered by pet', async ({ page }) => {
  await page.goto('/?tab=care');
  await expect(page.getByRole('region', { name: 'Overdue' })).toContainText('2 days overdue');
  await expect(page.getByRole('region', { name: 'Due this week' })).toContainText('Kidney supplement');
  await page.getByRole('button', { name: 'Miso', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Overdue' })).toHaveCount(0);
  await expect(page.getByText('FVRCP vaccine')).toBeVisible();
  await expect(page.getByText('Heartworm prevention')).toHaveCount(0);
});

test('a new reminder from a preset repeats every month and shows its due date', async ({ page }) => {
  await page.goto('/?tab=care');
  await page.getByRole('button', { name: 'Add reminder' }).click();
  const dialog = page.getByRole('dialog', { name: 'New reminder' });
  await dialog.getByRole('button', { name: 'Miso', exact: true }).click();
  await dialog.getByRole('button', { name: 'Flea and tick' }).click();
  await expect(dialog.getByLabel('Every how many')).toHaveValue('1');
  await dialog.getByLabel('Next due').fill('2031-05-16');
  await dialog.getByRole('button', { name: 'Save' }).click();
  const row = page.getByRole('region', { name: 'Due this week' }).getByRole('listitem').filter({ hasText: 'Flea and tick' }).filter({ hasText: 'Miso' });
  await expect(row).toContainText('Due in 2 days');
  await expect(row).toContainText('Every month');
});

test('the dose history shows who gave it', async ({ page }) => {
  await page.goto('/?tab=care');
  await page.getByRole('button', { name: 'Edit Kidney supplement for Miso' }).click();
  const given = page.getByRole('dialog', { name: 'Edit reminder' }).getByRole('region', { name: 'Given' });
  await expect(given.getByRole('listitem')).toHaveCount(3);
  await expect(given.getByRole('listitem').first()).toContainText('by Alex');
});
