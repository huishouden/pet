import { expect, test, type Page } from '@playwright/test';

// The sample's care routines (signed out, nothing saved). The clock is pinned to the sample's
// morning, Wednesday 14 May 2031: Miso's litter box is scooped every evening (today's is still to
// do), her litter was changed on the 5th (due the 12th, two days overdue), and Biscuit is brushed
// on Sundays and Wednesdays. The fountain, for both pets, is next due on the 17th.
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime('2031-05-14T10:30:00');
  await page.goto('./');
});

const board = (page: Page) => page.getByRole('region', { name: 'Care routines', exact: true });

test('Today lists what is due, the most overdue first, and says how late', async ({ page }) => {
  const rows = board(page).getByRole('listitem');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText('Change litter');
  await expect(rows.nth(0)).toContainText('Overdue by 2 days');
  await expect(rows.nth(1)).toContainText('Brush Biscuit');
  await expect(rows.nth(2)).toContainText('Scoop litter box');
  await expect(rows.nth(2)).toContainText('Miso · Due today');
  await expect(board(page)).toContainText('1 overdue');
  // The fountain is not due until the 17th.
  await expect(board(page)).not.toContainText('Clean water fountain');
});

test('Mark done shows who and when, and Undo brings it back', async ({ page }) => {
  await board(page).getByRole('button', { name: 'Mark Scoop litter box done' }).click();
  const done = board(page).locator('[data-completion=done]').filter({ hasText: 'Scoop litter box' });
  await expect(done).toContainText('Done by you');
  await expect(board(page).getByRole('listitem')).toHaveCount(3);
  await board(page).getByRole('button', { name: 'Undo done for Scoop litter box' }).click();
  await expect(board(page).getByRole('button', { name: 'Mark Scoop litter box done' })).toBeVisible();
});

test('doing the litter a few days late counts the next change from today', async ({ page }) => {
  await board(page).getByRole('button', { name: 'Mark Change litter done' }).click();
  await expect(board(page).locator('[data-completion=done]').filter({ hasText: 'Change litter' })).toBeVisible();
  // In the app, not a reload: the sample keeps nothing across one.
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: 'Pets' }).click();
  await page.getByRole('group', { name: 'Pet' }).getByRole('button', { name: 'Miso' }).click();
  const card = page.getByRole('region', { name: "Miso's care routines" });
  await expect(card.getByRole('button', { name: 'Open Change litter' })).toContainText('Done by you');
  await card.getByRole('button', { name: 'Open Change litter' }).click();
  // A week from today, the 21st.
  await expect(page.getByRole('dialog', { name: 'Change litter' })).toContainText('Done by you');
});

test('a routine opens to its history, and Mark done takes a note', async ({ page }) => {
  await board(page).getByRole('button', { name: 'Open Change litter' }).click();
  const sheet = page.getByRole('dialog', { name: 'Change litter' });
  await expect(sheet).toContainText('counted from when it was last done');
  await expect(sheet.getByRole('region', { name: 'History' })).toContainText('Fresh bag of the unscented kind');
  await sheet.getByLabel('Note (optional)').fill('Used the big bag');
  await sheet.getByRole('button', { name: 'Mark Change litter done' }).click();
  await board(page).getByRole('button', { name: 'Open Change litter' }).click();
  await expect(page.getByRole('dialog', { name: 'Change litter' }).getByRole('region', { name: 'History' })).toContainText('Used the big bag');
});

test("the pet's page lists its routines, one shared with Biscuit, and sets up a new one for two pets", async ({ page }) => {
  await page.goto('./?tab=pets&pet=demo-pet-miso');
  const card = page.getByRole('region', { name: "Miso's care routines" });
  await expect(card.getByRole('listitem')).toHaveCount(3);
  await expect(card.getByRole('button', { name: 'Open Clean water fountain' })).toContainText('with Biscuit');
  await card.getByRole('button', { name: 'Add a care routine for Miso' }).click();
  const dialog = page.getByRole('dialog', { name: 'New care routine' });
  await dialog.getByRole('button', { name: 'Brush or groom' }).click();
  await dialog.getByLabel('Name').fill('Brush the cats');
  await dialog.getByRole('group', { name: 'For' }).getByRole('button', { name: 'Biscuit' }).click();
  await dialog.getByRole('button', { name: 'On set days' }).click();
  await dialog.getByRole('group', { name: 'On' }).getByRole('button', { name: 'Fri' }).click();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(card.getByRole('button', { name: 'Open Brush the cats' })).toContainText('with Biscuit');
  await expect(card.getByRole('button', { name: 'Open Brush the cats' })).toContainText('Monday and Friday');
});

test('a helper marks routines done but cannot set them up', async ({ page }) => {
  await page.goto('./?as=helper');
  await board(page).getByRole('button', { name: 'Mark Scoop litter box done' }).click();
  await expect(board(page).locator('[data-completion=done]').filter({ hasText: 'Scoop litter box' })).toContainText('Done by you');
  await page.goto('./?tab=pets&pet=demo-pet-miso&as=helper');
  await expect(page.getByRole('button', { name: 'Add a care routine for Miso' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Open Scoop litter box' }).click();
  await expect(page.getByRole('dialog', { name: 'Scoop litter box' }).getByRole('button', { name: 'Edit' })).toHaveCount(0);
});
