import { expect, test } from '@playwright/test';
import { calendarEvents, mockCalendar } from './fixtures/calendar';

// Google Calendar has no emulator, and the sample app has no Google account: these tests stand in
// for the calendar with window.__mockCalendarEvents, which the kit's search answers from.

test('signed out, calendar search is off and says why', async ({ page }) => {
  await page.goto('/?tab=appointments');
  await expect(page.getByRole('button', { name: 'Import from calendar' })).toBeDisabled();
  await expect(page.getByText('Sign in to search your calendar.')).toBeVisible();
  await page.getByRole('button', { name: 'Add appointment' }).click();
  const dialog = page.getByRole('dialog', { name: 'New appointment' });
  await dialog.getByLabel('What').fill('Vet visit');
  await expect(dialog.getByRole('button', { name: 'Find in my calendar' })).toBeDisabled();
});

test.describe('with a calendar', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(mockCalendar, calendarEvents);
    await page.goto('/?tab=appointments');
  });

  test('Find in my calendar fills the appointment, its kind and pet, and links the event', async ({ page }) => {
    await page.getByRole('button', { name: 'Add appointment' }).click();
    const dialog = page.getByRole('dialog', { name: 'New appointment' });
    await dialog.getByLabel('What').fill('Rabies vaccine');
    await expect(dialog.getByText('Google will ask once to let Pet read your calendar. Pet never changes it.')).toBeVisible();
    await dialog.getByRole('button', { name: 'Find in my calendar' }).click();
    const match = dialog.getByRole('list', { name: 'Calendar matches' }).getByRole('button', { name: /Biscuit vet: rabies vaccine/ });
    await expect(match).toContainText('Family');
    await match.click();
    await expect(dialog.getByLabel('Date')).toHaveValue('2031-06-09');
    await expect(dialog.getByLabel('Time')).toHaveValue('09:30');
    await expect(dialog.getByLabel('Where (optional)')).toHaveValue('25 Example Street, Springfield');
    await expect(dialog.getByLabel('Notes (optional)')).toHaveValue('Bring the vaccine card.');
    await expect(dialog.getByRole('button', { name: 'Biscuit' })).toHaveAttribute('aria-pressed', 'true');
    await expect(dialog.getByRole('button', { name: 'Vet', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await dialog.getByRole('button', { name: 'Save' }).click();
    const row = page.locator('main li', { hasText: 'Rabies vaccine' });
    await expect(row.getByRole('link', { name: 'Open in Calendar' })).toHaveAttribute('href', 'https://calendar.example.com/event?eid=evt-vaccines');
  });

  test('Import from calendar lists new pet events once and adds them', async ({ page }) => {
    await page.getByRole('button', { name: 'Import from calendar' }).click();
    const dialog = page.getByRole('dialog', { name: 'Import from calendar' });
    const list = dialog.getByRole('list', { name: 'Calendar events' });
    await expect(list.getByRole('listitem')).toHaveCount(3);
    await expect(list).not.toContainText('Dental cleaning');
    await list.getByRole('button', { name: 'Add Miso grooming' }).click();
    await expect(list.getByRole('listitem')).toHaveCount(2);
    await dialog.getByRole('button', { name: 'Add all 2' }).click();
    await expect(page.getByText('Added 2 appointments')).toBeVisible();
    const upcoming = page.getByRole('region', { name: 'Upcoming appointments' });
    await expect(upcoming.locator('li', { hasText: 'Miso grooming' })).toContainText('Grooming');
    await expect(upcoming.locator('li', { hasText: 'Kennel tour' })).toContainText('Boarding');
    await page.getByRole('button', { name: 'Import from calendar' }).click();
    await expect(dialog.getByText('Every pet event in your calendar is already in Pet.')).toBeVisible();
  });

  test('a closed permission window is explained, with Try again', async ({ page }) => {
    await page.evaluate(() => {
      Object.defineProperty(window, '__mockCalendarEvents', {
        configurable: true,
        get() {
          throw Object.assign(new Error('Firebase: Error (auth/popup-closed-by-user).'), { code: 'auth/popup-closed-by-user' });
        },
      });
    });
    await page.getByRole('button', { name: 'Import from calendar' }).click();
    const alert = page.getByRole('dialog', { name: 'Import from calendar' }).getByRole('alert');
    await expect(alert).toContainText('Calendar access was not allowed');
    await expect(alert.getByRole('button', { name: 'Try again' })).toBeVisible();
  });
});
