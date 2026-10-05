import { expect, test } from '@playwright/test';

// The sample's outings (signed out, nothing saved). The clock is pinned to the sample's morning:
// Biscuit went out at 7:36 (pooped, a 20-minute walk); his PM outing is still to come, and yesterday
// he pooped once of his two.
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime('2031-05-14T10:30:00');
  await page.goto('./');
});

test('Today shows the scheduled outings, the poops against the minimum and yesterday’s flag', async ({ page }) => {
  const board = page.getByRole('region', { name: 'Outings', exact: true });
  await expect(board.getByTestId('poop-count')).toContainText('1 of 2 poops today');
  await expect(board.getByTestId('poop-count')).toContainText('20 of 30 min walked');
  await expect(board.getByRole('note')).toHaveText(/Biscuit pooped 1 of 2 yesterday/);
  await expect(board.locator('[data-completion=done]')).toContainText('Pooped · walk 20 min');
  await expect(board.getByRole('button', { name: 'Take Biscuit out · PM: pooped' })).toBeVisible();
  // Miso has no outing plan: only Biscuit is on the board.
  await expect(board).not.toContainText('Miso');
});

test('Pooped logs the outing, counts it and Undo takes it back', async ({ page }) => {
  const board = page.getByRole('region', { name: 'Outings', exact: true });
  await board.getByRole('button', { name: 'Take Biscuit out · PM: pooped' }).click();
  await expect(board.getByTestId('poop-count')).toContainText('2 of 2 poops today');
  await expect(board.getByRole('button', { name: 'Undo Take Biscuit out · PM' })).toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(board.getByTestId('poop-count')).toContainText('1 of 2 poops today');
  await board.getByRole('button', { name: 'Take Biscuit out · PM: pee only' }).click();
  await expect(board.locator('[data-completion=done]').filter({ hasText: 'Pee only' })).toBeVisible();
  await expect(board.getByTestId('poop-count')).toContainText('1 of 2 poops today');
});

test('+ Outing logs a walk in one go, shown in the walk count but not as a scheduled outing', async ({ page }) => {
  const board = page.getByRole('region', { name: 'Outings', exact: true });
  await board.getByRole('button', { name: 'Log an outing or a walk for Biscuit' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Walk', exact: true }).click();
  await dialog.getByRole('button', { name: '30 min' }).click();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(board.getByTestId('poop-count')).toContainText('50 of 30 min walked');
  await expect(board.getByRole('button', { name: 'Take Biscuit out · PM: pooped' })).toBeVisible();
});

test("the pet's page has the plan, the 14-day strip and the plan's settings", async ({ page }) => {
  await page.goto('./?tab=pets&pet=demo-pet-biscuit');
  const card = page.getByRole('region', { name: "Biscuit's outings" });
  await expect(card).toContainText('at least 2 poops a day');
  await expect(card.getByRole('list', { name: "Biscuit's poops a day, last 14 days" }).getByRole('listitem')).toHaveCount(14);
  await card.getByRole('button', { name: 'Outing settings for Biscuit' }).click();
  const dialog = page.getByRole('dialog', { name: 'Outings for Biscuit' });
  await dialog.getByRole('button', { name: 'Set times' }).click();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(card).toContainText('7:00 AM, 12:00 PM, 6:00 PM');
});

test('a pet without a plan offers to set one up', async ({ page }) => {
  await page.goto('./?tab=pets&pet=demo-pet-miso');
  const card = page.getByRole('region', { name: "Miso's outings" });
  await expect(card).toContainText('Outings are off for Miso');
  await card.getByRole('button', { name: 'Set up outings' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(card).toContainText('With meals: AM 9:00 AM, PM 7:00 PM');
  await page.getByRole('button', { name: 'Today' }).first().click();
  await expect(page.getByRole('region', { name: 'Outings', exact: true })).toContainText('Miso');
});
