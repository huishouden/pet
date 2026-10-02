import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { captureScreenshot } from '@huishouden/pwa-kit/e2e';
import places from './fixtures/nominatim.json' with { type: 'json' };
import { calendarEvents, mockCalendar } from './fixtures/calendar';

// README images of the signed-out app's invented sample pets, refreshed by CI after each deploy.
// The clock is frozen at the sample data's moment so every run renders the same.
const fixedTime = '2031-05-14T10:30:00';

test('today', ({ page }) =>
  captureScreenshot(page, 'today', {
    fixedTime,
    prepare: (p) => expect(p.getByText('Overdue: flea and tick')).toBeVisible(),
  }));

test('care', ({ page }) =>
  captureScreenshot(page, 'care', {
    path: '/?tab=care',
    fixedTime,
    prepare: (p) => expect(p.getByRole('region', { name: 'Overdue' })).toBeVisible(),
  }));

test('pet', ({ page }) =>
  captureScreenshot(page, 'pet', {
    path: '/?tab=pets',
    fixedTime,
    prepare: (p) => expect(p.getByRole('region', { name: "Biscuit's weight" })).toBeVisible(),
  }));

test('appointments', ({ page }) =>
  captureScreenshot(page, 'appointments', {
    path: '/?tab=appointments',
    fixedTime,
    prepare: (p) => expect(p.getByText('Yearly check-up')).toBeVisible(),
  }));

test('contacts', ({ page }) =>
  captureScreenshot(page, 'contacts', {
    path: '/?tab=contacts',
    fixedTime,
    prepare: (p) => expect(p.getByText('Example Vet Clinic')).toBeVisible(),
  }));

test('new reminder', ({ page }) =>
  captureScreenshot(page, 'new-reminder', {
    path: '/?tab=care',
    fixedTime,
    prepare: async (p) => {
      await p.getByRole('button', { name: 'Add reminder' }).click();
      const dialog = p.getByRole('dialog', { name: 'New reminder' });
      await dialog.getByRole('button', { name: 'Heartworm prevention' }).click();
      await expect(dialog.getByLabel('What')).toHaveValue('Heartworm prevention');
    },
  }));

test('contact search', async ({ page }) => {
  await page.route('https://nominatim.openstreetmap.org/**', (route) => route.fulfill({ json: places }));
  await captureScreenshot(page, 'contact-search', {
    path: '/?tab=contacts',
    fixedTime,
    prepare: async (p) => {
      await p.getByRole('button', { name: 'Add contact' }).click();
      const dialog = p.getByRole('dialog', { name: 'New contact' });
      await dialog.getByLabel('Find a business').fill('Example Animal Clinic Springfield');
      await dialog.getByRole('button', { name: 'Search', exact: true }).click();
      await expect(dialog.getByRole('list', { name: 'Places' })).toBeVisible();
    },
  });
});

test('calendar import', async ({ page }) => {
  await page.addInitScript(mockCalendar, calendarEvents);
  await captureScreenshot(page, 'calendar-import', {
    path: '/?tab=appointments',
    fixedTime,
    prepare: async (p) => {
      await p.getByRole('button', { name: 'Import from calendar' }).click();
      await expect(p.getByRole('list', { name: 'Calendar events' })).toBeVisible();
    },
  });
});

test('phone: today', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await captureScreenshot(page, 'phone-today', {
    fixedTime,
    prepare: (p) => expect(p.getByText('Overdue: flea and tick')).toBeVisible(),
  });
});

test('phone: pet', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await captureScreenshot(page, 'phone-pet', {
    path: '/?tab=pets',
    fixedTime,
    prepare: (p) => expect(p.getByRole('region', { name: "Biscuit's weight" })).toBeVisible(),
  });
});

test('scan the label', async ({ page }) => {
  const label = readFileSync(new URL('./fixtures/label.txt', import.meta.url), 'utf8');
  await page.addInitScript((text) => {
    (window as unknown as { __mockLabelText: string }).__mockLabelText = text;
  }, label);
  await captureScreenshot(page, 'scan-label', {
    path: '/?tab=pets&pet=demo-pet-miso',
    fixedTime,
    prepare: async (p) => {
      await p.getByRole('region', { name: "Miso's medicine" }).getByRole('button', { name: 'Add course' }).click();
      const dialog = p.getByRole('dialog', { name: 'Medicine course for Miso' });
      await dialog.getByLabel('Label photo').setInputFiles({ name: 'label.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('photo') });
      await expect(dialog.getByText('Filled in from the label. Check each field before saving.')).toBeVisible();
    },
  });
});
