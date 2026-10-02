import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

// The sample board (signed out, nothing saved). The clock is pinned to the sample's morning: Biscuit
// has had AM, Miso has not and her AM cut-off (9:00) has passed.
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime('2031-05-14T10:30:00');
  await page.goto('/');
});

test('the board shows who fed whom and who is still waiting', async ({ page }) => {
  const board = page.getByRole('region', { name: 'Feeding' });
  await expect(board.getByRole('button', { name: /^Biscuit AM: fed at 7:04/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(board.getByRole('button', { name: /^Biscuit AM/ })).toContainText('You');
  await expect(board.getByRole('button', { name: /^Miso AM: not fed yet/ })).toContainText('Not fed yet');
  await expect(board.getByRole('button', { name: /^Miso PM: not yet/ })).toContainText('by 7:00');
  await expect(board.getByText('Last fed 16h 23m ago')).toBeVisible();
});

test('a tap ticks a meal with the time and who, Undo puts it back', async ({ page }) => {
  const board = page.getByRole('region', { name: 'Feeding' });
  await board.getByRole('button', { name: /^Miso AM/ }).click();
  const tile = board.getByRole('button', { name: /^Miso AM: fed at 10:30 AM by You/ });
  await expect(tile).toHaveAttribute('aria-pressed', 'true');
  await expect(board.getByText('Last fed just now')).toBeVisible();
  await expect(page.getByText('Miso AM: fed at 10:30 AM')).toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(board.getByRole('button', { name: /^Miso AM: not fed yet/ })).toHaveAttribute('aria-pressed', 'false');
});

test('tapping a ticked meal un-ticks it, with Undo', async ({ page }) => {
  const board = page.getByRole('region', { name: 'Feeding' });
  await board.getByRole('button', { name: /^Biscuit AM/ }).click();
  await expect(board.getByRole('button', { name: /^Biscuit AM: not fed yet/ })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(board.getByRole('button', { name: /^Biscuit AM: fed at 7:04/ })).toBeVisible();
});

test('a medicine course puts its doses on the board, day 3 of 7', async ({ page }) => {
  const board = page.getByRole('region', { name: 'Feeding' });
  await expect(board.getByRole('button', { name: /^Biscuit Antibiotic AM: given at 7:06 AM by Alex/ })).toBeVisible();
  const pm = board.getByRole('button', { name: /^Biscuit Antibiotic PM: not yet, Day 3 of 7/ });
  await pm.click();
  await expect(board.getByRole('button', { name: /^Biscuit Antibiotic PM: given at 10:30 AM by You/ })).toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(pm).toBeVisible();
});

test('the pet page has the meals, two weeks of feeds and the course', async ({ page }) => {
  await page.getByRole('button', { name: 'Pets', exact: true }).click();
  await page.getByRole('button', { name: 'Miso', exact: true }).click();
  const feeding = page.getByRole('region', { name: "Miso's feeding" });
  await expect(feeding).toContainText('Not fed yet after 9:00 AM');
  const history = feeding.getByRole('table', { name: "Miso's feeds, last 14 days" });
  await expect(history.getByRole('row')).toHaveCount(15);
  await expect(history.getByRole('row', { name: /^Today/ })).toContainText('0');
  await expect(page.getByRole('region', { name: "Miso's medicine" })).toContainText('Anti-nausea');

  await page.getByRole('button', { name: 'Biscuit', exact: true }).click();
  const meds = page.getByRole('region', { name: "Biscuit's medicine" });
  await expect(meds).toContainText('Day 3 of 7');
  await expect(meds).toContainText('Twice a day with food');
});

test('a new course defaults to the pet’s AM and PM times and appears on the board', async ({ page }) => {
  await page.getByRole('button', { name: 'Pets', exact: true }).click();
  await page.getByRole('button', { name: 'Miso', exact: true }).click();
  await page.getByRole('region', { name: "Miso's medicine" }).getByRole('button', { name: 'Add course' }).click();
  const dialog = page.getByRole('dialog', { name: 'Medicine course for Miso' });
  await expect(dialog.getByText('It is read on this device and not kept.', { exact: false })).toBeVisible();
  await expect(dialog.getByLabel('Dose 1 time')).toHaveValue('09:00');
  await expect(dialog.getByLabel('Dose 2 time')).toHaveValue('19:00');
  await dialog.getByLabel('Medicine').fill('Eye drops');
  await dialog.getByLabel('Dose', { exact: true }).fill('1 drop each eye');
  await dialog.getByLabel('Number of days').fill('5');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Miso Eye drops AM: missed, Day 1 of 5/ })).toContainText('Missed');
});

test('renaming a meal changes the board', async ({ page }) => {
  await page.getByRole('button', { name: 'Pets', exact: true }).click();
  await page.getByRole('region', { name: "Biscuit's feeding" }).getByRole('button', { name: 'Edit PM' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit PM' });
  await dialog.getByLabel('Name').fill('Dinner');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Biscuit Dinner: not yet/ })).toBeVisible();
});

test('Scan the label fills the course from the photo and lists what it did not understand', async ({ page }) => {
  const label = readFileSync(new URL('./fixtures/label.txt', import.meta.url), 'utf8');
  await page.addInitScript((text) => {
    (window as unknown as { __mockLabelText: string }).__mockLabelText = text;
  }, label);
  await page.goto('/?tab=pets&pet=demo-pet-miso');
  await page.getByRole('region', { name: "Miso's medicine" }).getByRole('button', { name: 'Add course' }).click();
  const dialog = page.getByRole('dialog', { name: 'Medicine course for Miso' });
  await expect(dialog.getByRole('button', { name: 'Scan the label' })).toBeVisible();
  await dialog.getByLabel('Label photo').setInputFiles({ name: 'label.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('not a real photo') });
  await expect(dialog.getByText('Filled in from the label. Check each field before saving.')).toBeVisible();
  await expect(dialog.getByLabel('Medicine')).toHaveValue('Amoxicillin 50 mg');
  await expect(dialog.getByLabel('Dose', { exact: true })).toHaveValue('1 tablet');
  await expect(dialog.getByLabel('Dose 1 time')).toHaveValue('09:00');
  await expect(dialog.getByLabel('Dose 2 time')).toHaveValue('19:00');
  await expect(dialog.getByLabel('Number of days')).toHaveValue('10');
  await expect(dialog.getByLabel('Give with food')).toBeChecked();
  await expect(dialog.getByRole('list', { name: 'Not understood' })).toContainText('zq7 smudge');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('region', { name: "Miso's medicine" })).toContainText('Day 1 of 10');
});
