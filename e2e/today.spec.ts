import { expect, test } from '@playwright/test';

// Today answers "what needs doing for the pets right now?" (signed out, sample data). The clock is
// pinned to the sample's morning: 10:30, Biscuit's 9:00 antibiotic and Miso's breakfast not given yet,
// and Biscuit's birthday.
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime('2031-05-14T10:30:00');
  await page.goto('./');
});

test('Needs doing comes first, most overdue first, the late dose saying how late', async ({ page }) => {
  const needs = page.getByRole('region', { name: 'Needs doing' });
  await expect(needs).toContainText('3 past due');
  const rows = needs.getByRole('listitem');
  // Four to do, then Biscuit's breakfast, done at 7:04, after them.
  await expect(rows).toHaveCount(5);
  await expect(rows.nth(4)).toHaveAttribute('data-completion', 'done');
  await expect(rows.nth(4)).toContainText('Fed by You · 7:04 AM');
  await expect(rows.nth(0)).toContainText('Flea and tick for Biscuit');
  await expect(rows.nth(1)).toContainText('Antibiotic for Biscuit');
  await expect(rows.nth(1)).toContainText('Due 9:00 AM · 1 hr 30 min ago');
  await expect(rows.nth(2)).toContainText('Not fed yet: Miso AM');
  await expect(rows.nth(3)).toContainText('Kidney supplement for Miso');
  // Nothing is above it but the sample note.
  const top = await needs.boundingBox();
  const board = await page.getByRole('region', { name: 'Feeding' }).boundingBox();
  expect(top!.y).toBeLessThan(board!.y);
});

test('one tap gives the late dose from the top, Undo puts it back', async ({ page }) => {
  const needs = page.getByRole('region', { name: 'Needs doing' });
  const give = needs.getByRole('button', { name: 'Give: Antibiotic for Biscuit' });
  await expect(give).toContainText('Give');
  await give.click();
  await expect(page.getByText('Biscuit Antibiotic: given at 10:30 AM')).toBeVisible();
  // Done: the row stays, after the open ones, with who and when and only Undo.
  await expect(give).toHaveCount(0);
  const done = needs.locator('li[data-completion=done]').filter({ hasText: 'Antibiotic for Biscuit' });
  await expect(done).toHaveCount(1);
  await expect(done).toContainText('Antibiotic for Biscuit');
  await expect(done).toContainText('Given by You · 10:30 AM');
  // The three still open lead; both done rows follow.
  await expect(needs.getByRole('listitem').nth(2)).toHaveAttribute('data-completion', 'open');
  await expect(needs.getByRole('listitem').nth(3)).toHaveAttribute('data-completion', 'done');
  await expect(needs.getByRole('button', { name: 'Undo given for Antibiotic for Biscuit' })).toBeVisible();
  await expect(needs.locator('[aria-pressed]')).toHaveCount(0);
  await expect(needs).toContainText('2 past due');
  await expect(page.getByRole('region', { name: 'Feeding' }).getByRole('button', { name: 'Undo given for Biscuit Antibiotic AM' })).toBeVisible();
  await needs.getByRole('button', { name: 'Undo given for Antibiotic for Biscuit' }).click();
  await expect(give).toBeVisible();
  await expect(done).toHaveCount(0);
});

test('Feed ticks the late meal; with everything done the card folds to what is next', async ({ page }) => {
  const needs = page.getByRole('region', { name: 'Needs doing' });
  await needs.getByRole('button', { name: 'Feed: Not fed yet: Miso AM' }).click();
  await expect(page.getByText('Miso AM: fed at 10:30 AM')).toBeVisible();
  for (const name of ['Give: Flea and tick for Biscuit', 'Give: Antibiotic for Biscuit', 'Give: Kidney supplement for Miso']) await needs.getByRole('button', { name }).click();
  const summary = needs.getByRole('button', { name: /All done for now · next: Antibiotic for Biscuit at 7 PM/ });
  await expect(summary).toHaveAttribute('aria-expanded', 'false');
  await expect(needs.getByRole('listitem')).toHaveCount(0);
  await summary.click();
  await expect(needs.locator('li[data-completion=done]')).toHaveCount(5);
});

test('later today, and the birthday three weeks away as one quiet line', async ({ page }) => {
  const later = page.getByRole('region', { name: 'Later today' });
  await expect(later).toContainText('Antibiotic for Biscuit');
  await expect(later).toContainText('PM meal for Biscuit and Miso');
  const coming = page.getByRole('region', { name: 'Coming up' });
  await expect(coming).toContainText("Miso's birthday in 3 weeks");
  await expect(coming).toContainText('Turns 2 on June 4');
  await expect(coming).not.toContainText("Biscuit's birthday");
});

test("on the day: a birthday card on Today and a party on the pet's page", async ({ page }) => {
  const card = page.getByRole('region', { name: "Biscuit's birthday" });
  await expect(card).toContainText('Happy birthday, Biscuit!');
  await expect(card).toContainText('Biscuit turns 4 today');
  await card.getByRole('button').click();
  const profile = page.getByRole('region', { name: "Biscuit's profile" });
  await expect(profile.getByRole('status')).toContainText('Happy birthday, Biscuit!');
  await page.getByRole('button', { name: 'Miso', exact: true }).click();
  await expect(page.getByRole('region', { name: "Miso's profile" })).not.toContainText('Happy birthday');
});

test('the pets row opens a pet’s page, where its details live', async ({ page }) => {
  await page.getByRole('region', { name: 'Pets' }).getByRole('button', { name: "Miso's page" }).click();
  await expect(page.getByRole('region', { name: "Miso's profile" })).toContainText('Kidney diet');
});

test('on a phone the overdue dose and its Give button are on screen without scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  const given = page.getByRole('region', { name: 'Needs doing' }).getByRole('button', { name: 'Give: Antibiotic for Biscuit' });
  await expect(given).toBeInViewport({ ratio: 1 });
  const box = await given.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
});
