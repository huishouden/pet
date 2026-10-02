import { expect, test, type Page } from '@playwright/test';
import { signInTestUser } from '@huishouden/pwa-kit/e2e';

// Signed in as an invented test user on the staging site (pwa-kit STANDARD.md "Staging"): the real
// staging Firestore and rules, the seeded test household. Other runs share that household and it
// keeps its data, so the test adds its pet only once and starts from an unticked meal.
test.skip(!process.env.HH_STAGING_SA, 'signed-in tests run against staging, in CI');

const PET = 'Test pet';
const board = (page: Page) => page.getByRole('region', { name: 'Feeding' });
// first(): a pet added twice by runs racing on an empty household still gives one tile to follow.
const am = (page: Page) => board(page).getByRole('button', { name: new RegExp(`^${PET} AM`) }).first();

/** The test pet's board on Today, adding the pet (which gets AM and PM meals) the first time. */
async function openBoard(page: Page) {
  // Loaded: the board, or the first-pet prompt of an empty household.
  await expect(board(page).or(page.getByRole('button', { name: 'Add a pet' }))).toBeVisible({ timeout: 20_000 });
  if ((await am(page).count()) === 0) {
    await page.getByRole('button', { name: 'Pets', exact: true }).click();
    await page.getByRole('button', { name: 'Add pet' }).click();
    const dialog = page.getByRole('dialog', { name: 'New pet' });
    await dialog.getByLabel('Name').fill(PET);
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('region', { name: `${PET}'s profile` })).toBeVisible();
    await page.getByRole('button', { name: 'Today', exact: true }).click();
  }
  await expect(am(page)).toBeVisible({ timeout: 20_000 });
}

test('the morning feed one member ticks shows as fed for the other', async ({ page, browser }) => {
  await signInTestUser(page, { email: 'test-a@example.com' });
  await openBoard(page);
  // An earlier run may have ticked it already today: untick, so this run's tick is its own.
  if ((await am(page).getAttribute('aria-pressed')) === 'true') {
    await am(page).click();
    await expect(am(page)).toHaveAttribute('aria-pressed', 'false');
  }
  await am(page).click();
  await expect(am(page)).toHaveAttribute('aria-pressed', 'true');
  await expect(am(page)).toHaveAccessibleName(/fed at .* by You/);

  // Saved in the household, not just on this screen: the other member's own browser shows it fed.
  const other = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  try {
    const theirs = await other.newPage();
    await signInTestUser(theirs, { email: 'test-b@example.com' });
    await openBoard(theirs);
    await expect(am(theirs)).toHaveAttribute('aria-pressed', 'true', { timeout: 20_000 });
    await expect(am(theirs)).not.toHaveAccessibleName(/by You/);
  } finally {
    await other.close();
  }
});
