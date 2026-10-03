import { expect, test, type Page } from '@playwright/test';
import { birthdayEvents, calendarEvents, mockCalendar } from './fixtures/calendar';

// Birthdays from the calendar, with window.__mockCalendarEvents standing in for Google Calendar.

async function addPet(page: Page, name: string) {
  await page.getByRole('button', { name: 'Add pet' }).click();
  const dialog = page.getByRole('dialog', { name: 'New pet' });
  await dialog.getByLabel('Name').fill(name);
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('region', { name: `${name}'s profile` })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(mockCalendar, [...calendarEvents, ...birthdayEvents]);
  await page.goto('./?tab=pets');
});

test('the sample pets show their next birthday', async ({ page }) => {
  await expect(page.getByRole('region', { name: "Biscuit's profile" })).toContainText('Biscuit turns 4 today');
  await page.getByRole('button', { name: 'Miso', exact: true }).click();
  await expect(page.getByRole('region', { name: "Miso's profile" })).toContainText('Turns 2 on June 4');
});

test('a yearly series only suggests the year; an age finishes the birthday', async ({ page }) => {
  await addPet(page, 'Pip');
  await page.getByRole('button', { name: 'Edit Pip' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit Pip' });
  await dialog.getByRole('button', { name: 'Find birthday in my calendar' }).click();
  const found = dialog.getByRole('list', { name: 'Birthdays found' });
  await expect(found.getByRole('button')).toHaveCount(1);
  await expect(found).toContainText("Pip's birthday; yearly in your calendar since 2029");
  await found.getByRole('button', { name: /June 20/ }).click();
  const field = dialog.getByLabel('Age or year born');
  await expect(field).toHaveValue('');
  await expect(dialog.getByText("Your calendar entry starts in 2029 — use it if that's the year born.")).toBeVisible();
  // The sample day is May 14, 2031: June 20 hasn't come yet, so a 2-year-old was born in 2028.
  await field.fill('2');
  await expect(dialog.getByText('Born June 20, 2028 · turns 3 next')).toBeVisible();
  await field.fill('2029');
  await expect(dialog.getByText('Born June 20, 2029 · turns 2 next')).toBeVisible();
  await expect(dialog.getByLabel('Birthday (optional)')).toHaveValue('2029-06-20');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('region', { name: "Pip's profile" })).toContainText('Turns 2 on June 20');
});

test('a birthday without its year asks for the age or year', async ({ page }) => {
  await addPet(page, 'Mochi');
  await page.getByRole('button', { name: 'Edit Mochi' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit Mochi' });
  await dialog.getByRole('button', { name: 'Find birthday in my calendar' }).click();
  await dialog.getByRole('list', { name: 'Birthdays found' }).getByRole('button', { name: /August 2/ }).click();
  await expect(dialog.getByText('Your calendar has August 2 but not the year.')).toBeVisible();
  await dialog.getByLabel('Age or year born').fill('soon');
  await expect(dialog.getByText('An age like 6, or a year like 2019.')).toBeVisible();
  await dialog.getByLabel('Age or year born').fill('2030');
  await expect(dialog.getByLabel('Birthday (optional)')).toHaveValue('2030-08-02');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('region', { name: "Mochi's profile" })).toContainText('Turns 1 on August 2');
});

test('an age without a birthday shows as about that age, with no birthday line', async ({ page }) => {
  await page.getByRole('button', { name: 'Add pet' }).click();
  const dialog = page.getByRole('dialog', { name: 'New pet' });
  await dialog.getByLabel('Name').fill('Rex');
  await dialog.getByRole('button', { name: "Don't know the birthday? Enter an age" }).click();
  await dialog.getByLabel('Years').fill('6');
  await dialog.getByLabel('Months').fill('4');
  await expect(dialog.getByText('Shows as "About 6 years". No birthday reminder, since the day isn\'t known.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Save' }).click();
  const card = page.getByRole('region', { name: "Rex's profile" });
  await expect(card).toContainText('About 6 years');
  await expect(card).not.toContainText('Turns');
  await expect(card).not.toContainText('Born');

  // Reopening keeps the age; picking a real birthday drops "about".
  await page.getByRole('button', { name: 'Edit Rex' }).click();
  const edit = page.getByRole('dialog', { name: 'Edit Rex' });
  await expect(edit.getByLabel('Years')).toHaveValue('6');
  await expect(edit.getByLabel('Months')).toHaveValue('4');
  await edit.getByRole('button', { name: 'Know the birthday? Pick the date' }).click();
  await edit.getByLabel('Birthday (optional)').fill('2025-01-10');
  await edit.getByRole('button', { name: 'Save' }).click();
  await expect(card).toContainText('6 years');
  await expect(card).not.toContainText('About');
  await expect(card).toContainText('Turns 7 on January 10');
});

test('a birthday picked this year asks whether the year is right', async ({ page }) => {
  await page.getByRole('button', { name: 'Add pet' }).click();
  const dialog = page.getByRole('dialog', { name: 'New pet' });
  await dialog.getByLabel('Name').fill('Bean');
  await dialog.getByLabel('Birthday (optional)').fill('2031-04-01');
  await expect(dialog.getByText('That makes Bean 6 weeks old — is the year right?')).toBeVisible();
  await dialog.getByLabel('Birthday (optional)').fill('2021-04-01');
  await expect(dialog.getByText('is the year right?')).toHaveCount(0);
});

test('Import from calendar offers birthdays instead of adding them as visits', async ({ page }) => {
  await addPet(page, 'Pip');
  await page.getByRole('button', { name: 'Appointments', exact: true }).click();
  await page.getByRole('button', { name: 'Import from calendar' }).click();
  const dialog = page.getByRole('dialog', { name: 'Import from calendar' });
  const birthdays = dialog.getByRole('region', { name: 'Birthdays' });
  await expect(birthdays).toContainText('Pip: June 20');
  await expect(birthdays).toContainText('yearly in your calendar since 2029');
  await expect(dialog.getByRole('list', { name: 'Calendar events' })).not.toContainText("Pip's birthday");
  // A series start is not a birth year: the year is asked for, not set.
  await expect(birthdays.getByRole('button', { name: "Set Pip's birthday" })).toHaveCount(0);
  await birthdays.getByRole('button', { name: "Add the year of Pip's birthday" }).click();
  const edit = page.getByRole('dialog', { name: 'Edit Pip' });
  await expect(edit.getByLabel('Age or year born')).toHaveValue('');
  await expect(edit.getByText("Your calendar entry starts in 2029 — use it if that's the year born.")).toBeVisible();
});

test('Import from calendar sets a birthday whose title gives the age', async ({ page }) => {
  await page.addInitScript(mockCalendar, [...calendarEvents, ...birthdayEvents, { ...birthdayEvents[1], id: 'evt-bo-bday', title: "Bo's 3rd birthday" }]);
  await page.goto('./?tab=pets');
  await addPet(page, 'Bo');
  await page.getByRole('button', { name: 'Appointments', exact: true }).click();
  await page.getByRole('button', { name: 'Import from calendar' }).click();
  const birthdays = page.getByRole('dialog', { name: 'Import from calendar' }).getByRole('region', { name: 'Birthdays' });
  await expect(birthdays).toContainText('Bo: August 2, 2028');
  await birthdays.getByRole('button', { name: "Set Bo's birthday" }).click();
  await expect(page.getByText("Saved Bo's birthday")).toBeVisible();
});
