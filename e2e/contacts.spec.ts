import { expect, test } from '@playwright/test';
import places from './fixtures/nominatim.json' with { type: 'json' };

// The sample pets' vet, groomer and boarding (signed out, nothing saved). Place search goes to
// OpenStreetMap's Nominatim, stubbed here with invented results.

test('the vet is one tap from a call or a map', async ({ page }) => {
  await page.goto('/?tab=contacts');
  const card = page.getByRole('region', { name: 'Example Vet Clinic' });
  await expect(card).toContainText('Vet');
  await expect(card.getByRole('link', { name: 'Call Example Vet Clinic, (555) 010-0150' })).toHaveAttribute('href', 'tel:5550100150');
  await expect(card.getByRole('link', { name: 'Open in Google Maps' })).toHaveAttribute('href', /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=Example%20Vet%20Clinic/);
  await expect(card.getByRole('link', { name: 'vet.example.com' })).toHaveAttribute('href', 'https://vet.example.com');
});

test('Find a business fills the contact from OpenStreetMap, only on Search', async ({ page }) => {
  let searches = 0;
  await page.route('https://nominatim.openstreetmap.org/**', (route) => {
    searches++;
    return route.fulfill({ json: places });
  });
  await page.goto('/?tab=contacts');
  await page.getByRole('button', { name: 'Add contact' }).click();
  const dialog = page.getByRole('dialog', { name: 'New contact' });
  await dialog.getByLabel('Phone').fill('(555) 010-0199');
  await dialog.getByLabel('Find a business').fill('Example Dog Grooming Springfield');
  expect(searches).toBe(0);
  await expect(dialog.getByRole('link', { name: 'Search Google Maps' })).toHaveAttribute(
    'href',
    'https://www.google.com/maps/search/?api=1&query=Example%20Dog%20Grooming%20Springfield',
  );
  await dialog.getByRole('button', { name: 'Search', exact: true }).click();
  const results = dialog.getByRole('list', { name: 'Places' }).getByRole('button');
  await expect(results).toHaveCount(2);
  expect(searches).toBe(1);
  await results.filter({ hasText: 'Example Dog Grooming' }).click();
  await expect(dialog.getByLabel('Name')).toHaveValue('Example Dog Grooming');
  await expect(dialog.getByLabel('Address')).toHaveValue('3 Demo Lane, Springfield, 00000, United States');
  await expect(dialog.getByLabel('Phone')).toHaveValue('(555) 010-0199');
  await dialog.getByRole('button', { name: 'Groomer', exact: true }).click();
  await dialog.getByRole('button', { name: 'Save' }).click();

  const card = page.getByRole('region', { name: 'Example Dog Grooming' });
  await expect(card).toContainText('Groomer');
  await expect(card.getByRole('link', { name: /^Call Example Dog Grooming/ })).toHaveAttribute('href', 'tel:5550100199');
});

test('deleting a contact can be undone', async ({ page }) => {
  await page.goto('/?tab=contacts');
  await page.getByRole('button', { name: 'Delete Example Pet Lodge' }).click();
  await expect(page.getByRole('region', { name: 'Example Pet Lodge' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Example Pet Lodge' })).toBeVisible();
});

test('an appointment with the vet takes their address and shows their phone', async ({ page }) => {
  await page.goto('/?tab=appointments');
  await page.getByRole('button', { name: 'Add appointment' }).click();
  const dialog = page.getByRole('dialog', { name: 'New appointment' });
  await dialog.getByLabel('What').fill('Booster shots');
  await dialog.getByRole('button', { name: 'Miso' }).click();
  await dialog.getByLabel('With (optional)').selectOption({ label: 'Example Vet Clinic (Vet)' });
  await expect(dialog.getByLabel('Where (optional)')).toHaveValue('25 Example Street, Springfield');
  await dialog.getByRole('button', { name: 'Save' }).click();
  const row = page.locator('main li', { hasText: 'Booster shots' });
  await expect(row).toContainText('Miso');
  await expect(row.getByRole('link', { name: 'Call Example Vet Clinic, (555) 010-0150' })).toHaveAttribute('href', 'tel:5550100150');
});

// Businesses OpenStreetMap lacks: Google Maps' Share menu, a listing screenshot, or pasted text.

test('a place shared from Google Maps opens a new contact, prefilled', async ({ page }) => {
  const text = 'Example Animal Hospital\n1234 Example Ave, Springfield, IL 62704\nhttps://maps.app.goo.gl/example1';
  await page.goto(`/?share_title=${encodeURIComponent('Example Animal Hospital')}&share_text=${encodeURIComponent(text)}`);
  const dialog = page.getByRole('dialog', { name: 'New contact' });
  await expect(dialog.getByLabel('Name')).toHaveValue('Example Animal Hospital');
  await expect(dialog.getByLabel('Address')).toHaveValue('1234 Example Ave, Springfield, IL 62704');
  await expect(dialog).toContainText('Filled in the name and address from what was shared. Check them before saving.');
  await expect(page).toHaveURL(/\/\?tab=contacts$/);
});

test('the installed app is offered in the Share menu', async ({ request }) => {
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest.share_target).toEqual({
    action: 'share-target',
    method: 'POST',
    enctype: 'multipart/form-data',
    params: {
      title: 'share_title',
      text: 'share_text',
      url: 'share_url',
      files: [{ name: 'contact', accept: ['text/vcard', 'text/x-vcard', 'text/directory', '.vcf', '.vcard'] }],
    },
  });
});

test('pasted listing text fills the contact and shows what was not used', async ({ page }) => {
  await page.goto('/?tab=contacts');
  await page.getByRole('button', { name: 'Add contact' }).click();
  const dialog = page.getByRole('dialog', { name: 'New contact' });
  await dialog.getByRole('button', { name: 'Paste listing text' }).click();
  await dialog.getByLabel('Listing text').fill('Example Pet Hospital\n4.7 (210)\nVeterinarian · 1.2 mi\n55 Example Rd, Springfield, IL 62704\n(555) 010-0177\nexample.com\n"So kind to our old cat."');
  await dialog.getByRole('button', { name: 'Fill in' }).click();
  await expect(dialog.getByLabel('Name')).toHaveValue('Example Pet Hospital');
  await expect(dialog.getByLabel('Phone')).toHaveValue('(555) 010-0177');
  await expect(dialog.getByLabel('Website')).toHaveValue('https://example.com');
  // Lines the fill didn't use are folded away (pwa-kit 0.28.1), one tap from view.
  await dialog.getByText("Show the text that wasn't used").click();
  await expect(dialog).toContainText('So kind to our old cat.');
});

test('a Google Maps screenshot is read on the device and fills the contact', async ({ page }) => {
  test.setTimeout(120_000); // the OCR engine downloads on first use
  await page.goto('/?tab=contacts');
  await page.getByRole('button', { name: 'Add contact' }).click();
  const dialog = page.getByRole('dialog', { name: 'New contact' });
  await expect(dialog).toContainText('Take a screenshot of the business in Google Maps, then choose it here.');
  await dialog.getByLabel('Screenshot of the business').setInputFiles('e2e/fixtures/listing-screenshot.png');
  await expect(dialog.getByLabel('Name')).toHaveValue('Maple Grove Animal Hospital', { timeout: 100_000 });
  await expect(dialog.getByLabel('Address')).toHaveValue('1234 Elm St, Springfield, IL 62704');
  await expect(dialog.getByLabel('Phone')).toHaveValue('(217) 555-0142');
  await expect(dialog.getByLabel('Website')).toHaveValue('https://maplegrove.example.com');
});
