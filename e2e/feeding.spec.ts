import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

// The sample board (signed out, nothing saved). The clock is pinned to the sample's morning: Biscuit
// has had AM but not his 9:00 antibiotic, Miso has not had AM and her cut-off (9:00) has passed.
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime('2031-05-14T10:30:00');
  await page.goto('./');
});

test('the board shows who fed whom and who is still waiting', async ({ page }) => {
  const board = page.getByRole('region', { name: 'Feeding' });
  // Done: no button but Undo, and who and when; open: the "Feed" tile. Never aria-pressed.
  await expect(board.getByRole('button', { name: 'Feed Biscuit AM' })).toHaveCount(0);
  await expect(board.getByRole('button', { name: 'Undo fed for Biscuit AM' })).toBeVisible();
  await expect(board.locator('[data-completion=done]').filter({ hasText: 'Fed by you · 7:04 AM' })).toBeVisible();
  await expect(board.getByRole('button', { name: 'Feed Miso AM' })).toContainText('Not fed yet');
  await expect(board.getByRole('button', { name: 'Feed Miso PM' })).toContainText('by 7:00');
  await expect(board.locator('[data-completion][aria-pressed], [data-completion] [aria-pressed]')).toHaveCount(0);
  // The board is just the toggles: details live on each pet's page.
  await expect(board).not.toContainText('Last fed');
});

test('a tap ticks a meal with the time and who, Undo puts it back', async ({ page }) => {
  const board = page.getByRole('region', { name: 'Feeding' });
  await board.getByRole('button', { name: 'Feed Miso AM' }).click();
  await expect(board.getByRole('button', { name: 'Feed Miso AM' })).toHaveCount(0);
  await expect(board.getByRole('button', { name: 'Undo fed for Miso AM' })).toBeVisible();
  await expect(board).toContainText('Fed by you · 10:30 AM');
  await expect(page.getByText('Miso AM: fed at 10:30 AM')).toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(board.getByRole('button', { name: 'Feed Miso AM' })).toContainText('Not fed yet');
});

test("a fed meal's Undo un-ticks it, and the toast's Undo ticks it again", async ({ page }) => {
  const board = page.getByRole('region', { name: 'Feeding' });
  await board.getByRole('button', { name: 'Undo fed for Biscuit AM' }).click();
  await expect(board.getByRole('button', { name: 'Feed Biscuit AM' })).toContainText('Not fed yet');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(board.getByRole('button', { name: 'Undo fed for Biscuit AM' })).toBeVisible();
});

test('a medicine course puts its doses on the board, day 3 of 7', async ({ page }) => {
  const board = page.getByRole('region', { name: 'Feeding' });
  await expect(board.getByRole('button', { name: 'Give Biscuit Antibiotic AM' })).toContainText('Missed');
  const pm = board.getByRole('button', { name: 'Give Biscuit Antibiotic PM' });
  await expect(pm).toContainText('Day 3 of 7');
  await pm.click();
  await expect(board.getByRole('button', { name: 'Undo given for Biscuit Antibiotic PM' })).toBeVisible();
  await expect(board).toContainText('Given by you · 10:30 AM');
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
  await expect(page.getByRole('button', { name: 'Give Miso Eye drops AM' })).toContainText('Missed');
});

test('renaming a meal changes the board', async ({ page }) => {
  await page.getByRole('button', { name: 'Pets', exact: true }).click();
  await page.getByRole('region', { name: "Biscuit's feeding" }).getByRole('button', { name: 'Edit PM' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit PM' });
  await dialog.getByLabel('Name').fill('Dinner');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Feed Biscuit Dinner' })).toBeVisible();
});

test('Scan the label fills the course from the photo and lists what it did not understand', async ({ page }) => {
  const label = readFileSync(new URL('./fixtures/label.txt', import.meta.url), 'utf8');
  await page.addInitScript((text) => {
    (window as unknown as { __mockLabelText: string }).__mockLabelText = text;
  }, label);
  await page.goto('./?tab=pets&pet=demo-pet-miso');
  await page.getByRole('region', { name: "Miso's medicine" }).getByRole('button', { name: 'Add course' }).click();
  const dialog = page.getByRole('dialog', { name: 'Medicine course for Miso' });
  await expect(dialog.getByText('Scan the label', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Choose photos' })).toBeVisible();
  await expect(dialog.locator('input[type=file]:not([capture])')).toHaveCount(1);
  await dialog.getByLabel('Label photo').setInputFiles({ name: 'label.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('not a real photo') });
  await expect(dialog.getByText('Filled in from the label. Check each field before saving.')).toBeVisible();
  await expect(dialog.getByLabel('Medicine')).toHaveValue('Amoxicillin 50 mg');
  await expect(dialog.getByLabel('Dose', { exact: true })).toHaveValue('1 tablet');
  await expect(dialog.getByLabel('Dose 1 time')).toHaveValue('09:00');
  await expect(dialog.getByLabel('Dose 2 time')).toHaveValue('19:00');
  await expect(dialog.getByLabel('Number of days')).toHaveValue('10');
  await expect(dialog.getByLabel('Give with food')).toBeChecked();
  // What was filled, field by field, and the label text read but not used, in plain sight.
  await expect(dialog.getByRole('region', { name: 'Filled in from the label' })).toContainText('MedicineAmoxicillin 50 mg');
  await expect(dialog.getByRole('list', { name: 'Not used' })).toContainText('zq7 smudge');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('region', { name: "Miso's medicine" })).toContainText('Day 1 of 10');
});

test('Scan the label takes two photos chosen together, and a photo pasted with Ctrl+V', async ({ page }) => {
  const label = readFileSync(new URL('./fixtures/label.txt', import.meta.url), 'utf8');
  // The reader asks the mock for its text twice per photo (is there one, then take it): count them.
  await page.addInitScript((text) => {
    const w = window as unknown as { __mockLabelText: string; __labelReads: number };
    w.__labelReads = 0;
    Object.defineProperty(w, '__mockLabelText', { get: () => (w.__labelReads++, text) });
  }, label);
  await page.goto('./?tab=pets&pet=demo-pet-miso');
  await page.getByRole('region', { name: "Miso's medicine" }).getByRole('button', { name: 'Add course' }).click();
  const dialog = page.getByRole('dialog', { name: 'Medicine course for Miso' });
  await dialog.getByLabel('Label photo').setInputFiles([
    { name: 'front.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('front') },
    { name: 'back.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('back') },
  ]);
  await expect(dialog.getByLabel('Medicine')).toHaveValue('Amoxicillin 50 mg');
  expect(await page.evaluate(() => (window as unknown as { __labelReads: number }).__labelReads)).toBe(4);
  await dialog.getByLabel('Medicine').fill('');
  await page.evaluate(() => {
    const data = new DataTransfer();
    data.items.add(new File(['photo'], 'pasted.png', { type: 'image/png' }));
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  });
  await expect(dialog.getByLabel('Medicine')).toHaveValue('Amoxicillin 50 mg');
});

test('Share → Pet with a label photo opens Scan the label in a new course', async ({ page }) => {
  const label = readFileSync(new URL('./fixtures/label.txt', import.meta.url), 'utf8');
  await page.addInitScript((text) => {
    (window as unknown as { __mockLabelText: string }).__mockLabelText = text;
  }, label);
  // What the service worker keeps for a photo shared from the gallery.
  await page.evaluate(async () => {
    const cache = await caches.open('hh-share-images');
    await cache.put(new URL('hh-shared-image-0', location.href).href, new Response('photo', { headers: { 'Content-Type': 'image/jpeg', 'X-File-Name': 'label.jpg' } }));
  });
  await page.goto('./?share=image');
  const dialog = page.getByRole('dialog', { name: /^Medicine course for / });
  await expect(dialog.getByRole('region', { name: 'Filled in from the label' })).toContainText('MedicineAmoxicillin 50 mg');
  await expect(page).not.toHaveURL(/share=image/);
});

test('a course that started yesterday: mark yesterday’s doses as given, at their times', async ({ page }) => {
  await page.getByRole('button', { name: 'Pets', exact: true }).click();
  await page.getByRole('button', { name: 'Miso', exact: true }).click();
  await page.getByRole('region', { name: "Miso's medicine" }).getByRole('button', { name: 'Add course' }).click();
  const form = page.getByRole('dialog', { name: 'Medicine course for Miso' });
  await form.getByLabel('Medicine').fill('Eye drops');
  await form.getByLabel('Dose', { exact: true }).fill('1 drop');
  await form.getByLabel('First day').fill('2031-05-13');
  await form.getByLabel('Number of days').fill('3');
  await form.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText('Started on Tuesday, May 13. Mark the doses already given?')).toBeVisible();
  await page.getByRole('button', { name: 'Mark doses' }).click();
  const log = page.getByRole('dialog', { name: 'Eye drops: doses by day' });
  await expect(log).toContainText('Day 2 of 3 · 0 of 6 doses given · 0 of 3 days complete');
  const day1 = log.getByRole('listitem', { name: 'Day 1, Tuesday, May 13' });
  await expect(day1.getByRole('button', { name: 'Give Miso Eye drops AM on Tuesday, May 13' })).toContainText('Missed');

  await day1.getByRole('button', { name: 'Give Miso Eye drops AM on Tuesday, May 13' }).click();
  await expect(day1.getByRole('button', { name: 'Undo given for Miso Eye drops AM on Tuesday, May 13' })).toBeVisible();
  await expect(day1).toContainText('Given by you · 9:00 AM');
  await expect(page.getByText('Miso Eye drops yesterday: given at 9 AM')).toBeVisible();
  await day1.getByRole('button', { name: 'Give Miso Eye drops PM on Tuesday, May 13' }).click();
  await expect(day1).toContainText('All given');
  await expect(log).toContainText('2 of 6 doses given · 1 of 3 days complete');

  // The PM dose was really given at 6:30.
  await day1.getByRole('button', { name: 'Change the time of Eye drops PM on Tuesday, May 13' }).click();
  await day1.getByLabel('Time Eye drops PM was given on Tuesday, May 13').fill('18:30');
  await day1.getByRole('button', { name: 'Save' }).click();
  await expect(day1).toContainText('Given by you · 6:30 PM');

  // Undo puts it back to missed; the toast's Undo gives it again.
  await day1.getByRole('button', { name: 'Undo given for Miso Eye drops AM on Tuesday, May 13' }).click();
  await expect(day1.getByRole('button', { name: 'Give Miso Eye drops AM on Tuesday, May 13' })).toContainText('Missed');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(day1.getByRole('button', { name: 'Undo given for Miso Eye drops AM on Tuesday, May 13' })).toBeVisible();

  await log.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('region', { name: "Miso's medicine" })).toContainText('2 of 6 doses given · 1 of 3 days complete');
});

test('the board switches to yesterday to tick a meal and a dose at their times', async ({ page }) => {
  const board = page.getByRole('region', { name: 'Feeding' });
  await board.getByRole('button', { name: 'Yesterday', exact: true }).click();
  await expect(board).toContainText('Tuesday, May 13');
  const miso = board.getByRole('button', { name: /Miso PM yesterday$/ });
  await expect(miso).toBeVisible();
  // The sample has Biscuit's antibiotic given both times on the 13th.
  await expect(board).toContainText('Given by you · 6:05 PM');
  await board.getByRole('button', { name: 'Undo given for Biscuit Antibiotic PM yesterday' }).click();
  const pm = board.getByRole('button', { name: 'Give Biscuit Antibiotic PM yesterday' });
  await expect(pm).toContainText('Missed');
  await pm.click();
  await expect(board.getByRole('button', { name: 'Undo given for Biscuit Antibiotic PM yesterday' })).toBeVisible();
  await expect(board).toContainText('Given by you · 7:00 PM');

  await board.getByRole('button', { name: 'Today', exact: true }).click();
  await expect(board.getByRole('button', { name: 'Give Biscuit Antibiotic PM' })).toContainText('Day 3 of 7');
  await page.getByRole('region', { name: 'Needs doing' }).getByRole('button', { name: /^Antibiotic for Biscuit, .*Open$/ }).click();
  await expect(page.getByRole('dialog', { name: 'Antibiotic: doses by day' })).toContainText('Day 3 of 7 · 4 of 14 doses given · 2 of 7 days complete');
});
