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
  await page.goto('/?tab=pets');
});

test('the sample pets show their next birthday', async ({ page }) => {
  await expect(page.getByRole('region', { name: "Biscuit's profile" })).toContainText('Turns 5 on March 8');
});

test('Find birthday in my calendar takes the year from a yearly series', async ({ page }) => {
  await addPet(page, 'Pip');
  await page.getByRole('button', { name: 'Edit Pip' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit Pip' });
  await dialog.getByRole('button', { name: 'Find birthday in my calendar' }).click();
  const found = dialog.getByRole('list', { name: 'Birthdays found' });
  await expect(found.getByRole('button')).toHaveCount(1);
  await expect(found).toContainText("Pip's birthday, yearly since 2029");
  await found.getByRole('button', { name: /June 20, 2029/ }).click();
  await expect(dialog.getByLabel('Birthday (optional)')).toHaveValue('2029-06-20');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('region', { name: "Pip's profile" })).toContainText('Turns 2 on June 20');
});

test('a birthday without its year asks for the year', async ({ page }) => {
  await addPet(page, 'Mochi');
  await page.getByRole('button', { name: 'Edit Mochi' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit Mochi' });
  await dialog.getByRole('button', { name: 'Find birthday in my calendar' }).click();
  await dialog.getByRole('list', { name: 'Birthdays found' }).getByRole('button', { name: /August 2/ }).click();
  await dialog.getByLabel('Year born (August 2)').fill('2030');
  await expect(dialog.getByLabel('Birthday (optional)')).toHaveValue('2030-08-02');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('region', { name: "Mochi's profile" })).toContainText('Turns 1 on August 2');
});

test('Import from calendar offers birthdays instead of adding them as visits', async ({ page }) => {
  await addPet(page, 'Pip');
  await page.getByRole('button', { name: 'Appointments', exact: true }).click();
  await page.getByRole('button', { name: 'Import from calendar' }).click();
  const dialog = page.getByRole('dialog', { name: 'Import from calendar' });
  const birthdays = dialog.getByRole('region', { name: 'Birthdays' });
  await expect(birthdays).toContainText('Pip: June 20, 2029');
  await expect(dialog.getByRole('list', { name: 'Calendar events' })).not.toContainText("Pip's birthday");
  await birthdays.getByRole('button', { name: "Set Pip's birthday" }).click();
  await expect(page.getByText("Saved Pip's birthday")).toBeVisible();
  await expect(birthdays).toHaveCount(0);
});
