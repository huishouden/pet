import { expect, test } from '@playwright/test';
import { expectLocalized, useLanguage } from '@huishouden/pwa-kit/e2e';
import es from '../src/locales/es.json' with { type: 'json' };
import nl from '../src/locales/nl.json' with { type: 'json' };

// The signed-out sample pets in Spanish and Dutch: Pet's own chrome and the kit's, no English left.
// Pet, reminder, medicine and meal names are sample data and stay as entered.
const fixedTime = '2031-05-14T10:30:00';
const ENGLISH = ['Needs doing', 'Later today', 'Coming up', 'Feeding and medicine', 'Yesterday', 'Appointments', 'Care', 'Contacts', 'past due', 'Not fed yet', 'Give', 'Feed', 'Mark done', 'Undo'];

for (const [lang, messages] of [
  ['es', es],
  ['nl', nl],
] as const) {
  test(`the sample pets in ${lang}`, async ({ page }) => {
    await page.clock.setFixedTime(fixedTime);
    await expectLocalized(page, lang, { words: ENGLISH });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(messages['app.name']);
    await expect(page.getByRole('region', { name: messages['needs.title'] })).toBeVisible();
    await expect(page.getByRole('region', { name: messages['board.feeding'] })).toBeVisible();

    // Care, then a new reminder in that language.
    await page.getByRole('button', { name: messages['tab.care'], exact: true }).first().click();
    await page.getByRole('button', { name: messages['care.addReminder'] }).click();
    const dialog = page.getByRole('dialog', { name: messages['reminderDialog.new'] });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: messages['preset.fleaTick'], exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toHaveCount(0);
  });
}

test('a dose given from Needs doing says the time the Dutch way', async ({ page }) => {
  await page.clock.setFixedTime(fixedTime);
  await useLanguage(page, 'nl');
  await page.goto('./', { waitUntil: 'networkidle' });
  const needs = page.getByRole('region', { name: nl['needs.title'] });
  await needs.getByRole('button', { name: /^Geven: Antibiotic/ }).click();
  await expect(page.getByText(/gegeven om 10:30/i).first()).toBeVisible();
});
