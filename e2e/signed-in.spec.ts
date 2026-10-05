import { expect, test, type Page } from '@playwright/test';
import { runPortalTodo, useTestHousehold } from '@huishouden/pwa-kit/e2e';

// Signed in as the invented people of a household of this run's own (pwa-kit STANDARD.md
// "Staging"), against the real rules: on the emulators (`bun run e2e:emulator`), and on
// staging for what needs the suite's site (@staging) or a kit bump (@smoke).
const hh = useTestHousehold(test);

const PET = 'Test pet';
const board = (page: Page) => page.getByRole('region', { name: 'Feeding' });
// first(): two tests adding the pet at once still give one tile to follow.
const am = (page: Page) => board(page).getByRole('button', { name: `Feed ${PET} AM` }).first();
const amDone = (page: Page) => board(page).getByRole('button', { name: `Undo fed for ${PET} AM` }).first();
/** The AM tile in either state. */
const amAny = (page: Page) => am(page).or(amDone(page)).first();

/** The test pet's board on Today, adding the pet (which gets AM and PM meals) the first time. */
async function openBoard(page: Page) {
  // Loaded: the board, or the first-pet prompt of an empty household.
  await expect(board(page).or(page.getByRole('button', { name: 'Add a pet' }))).toBeVisible({ timeout: 20_000 });
  if ((await amAny(page).count()) === 0) {
    await page.getByRole('button', { name: 'Pets', exact: true }).click();
    await page.getByRole('button', { name: 'Add pet' }).click();
    const dialog = page.getByRole('dialog', { name: 'New pet' });
    await dialog.getByLabel('Name').fill(PET);
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('region', { name: `${PET}'s profile` })).toBeVisible();
    await page.getByRole('button', { name: 'Today', exact: true }).click();
  }
  await expect(amAny(page)).toBeVisible({ timeout: 20_000 });
}

test('the morning feed one member ticks shows as fed for the other', { tag: '@smoke' }, async ({ browser }) => {
  const page = await hh.open(browser, 'admin');
  await openBoard(page);
  await am(page).click();
  await expect(amDone(page)).toBeVisible();
  await expect(am(page)).toHaveCount(0);
  await expect(board(page)).toContainText(/Fed by you · /);

  // Saved in the household, not just on this screen: the other member's own browser shows it fed.
  const theirs = await hh.open(browser, 'member');
  await openBoard(theirs);
  await expect(amDone(theirs)).toBeVisible({ timeout: 20_000 });
  await expect(board(theirs).locator('[data-completion=done]').filter({ hasText: /Fed by .* · / }).first()).not.toContainText('by you');
});

/** The test pet's page on Pets: a household with one pet opens straight on it, with more there's a pick. */
async function openPet(page: Page) {
  await page.getByRole('button', { name: 'Pets', exact: true }).click();
  const profile = page.getByRole('region', { name: `${PET}'s profile` });
  const pick = page.getByRole('button', { name: PET }).first();
  await expect(profile.or(pick).first()).toBeVisible({ timeout: 20_000 });
  if (!(await profile.isVisible())) await pick.click();
  await expect(profile).toBeVisible();
}

const PILL = 'Restricted pill';
const pill = (page: Page) => board(page).getByRole('button', { name: new RegExp(`^Give ${PET} ${PILL}`) }).first();

/** The admin's year-long course for the test pet that only approved helpers may give (none are). */
async function restrictedCourse(page: Page) {
  await openBoard(page);
  if ((await pill(page).count()) > 0) return;
  await openPet(page);
  await page.getByRole('region', { name: `${PET}'s medicine` }).getByRole('button', { name: 'Add course' }).click();
  const dialog = page.getByRole('dialog', { name: `Medicine course for ${PET}` });
  await dialog.getByLabel('Medicine', { exact: true }).fill(PILL);
  await dialog.getByPlaceholder('1 tablet').fill('1 tablet');
  await dialog.getByLabel('Number of days').fill('365');
  await dialog.getByText('Only approved helpers').click();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await expect(pill(page)).toBeVisible({ timeout: 20_000 });
}

test('a helper is refused a course only approved helpers give, and logs a feed', async ({ browser }) => {
  await restrictedCourse(await hh.open(browser, 'admin'));

  const page = await hh.open(browser, 'helper');
  await openBoard(page);
  // Refused: the dose, in words, and nothing written.
  await expect(pill(page)).toBeVisible({ timeout: 20_000 });
  const before = await pill(page).getAttribute('aria-label');
  await pill(page).click();
  await expect(page.getByText(`Only approved helpers can give ${PILL}.`)).toBeVisible();
  await expect(pill(page)).toHaveAttribute('aria-label', before!);

  // Permitted: a feed of their own, saved by the rules (no error toast) and shown as theirs.
  const note = 'Helper feed';
  await openPet(page);
  await page.getByRole('region', { name: `${PET}'s feeding` }).getByRole('button', { name: 'Log a feed' }).click();
  const dialog = page.getByRole('dialog', { name: `Log a feed for ${PET}` });
  await dialog.getByLabel('Note (optional)').fill(note);
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText(/^Logged a feed at/)).toBeVisible();
  await expect(page.getByText(/only admins and members can do that/)).toHaveCount(0);
  await page.waitForTimeout(3000);
  await expect(page.getByText(/only admins and members can do that/)).toHaveCount(0);
});

// @staging: the portal's To-do list is another app on the suite's site.
test('care due today, done from the portal’s To-do list, moves on to its next due day in Pet', { tag: '@staging' }, async ({ browser }) => {
  test.setTimeout(120_000);
  const title = 'To-do check';
  const page = await hh.open(browser, 'admin');
  await openBoard(page);

  // A weekly "Other" reminder for the test pet, due today (the dialog's default).
  await openPet(page);
  await page.getByRole('region', { name: `${PET}'s care` }).getByRole('button', { name: 'Add reminder' }).click();
  const dialog = page.getByRole('dialog', { name: 'New reminder' });
  await dialog.getByLabel('What').fill(title);
  await dialog.getByLabel('Kind').selectOption('other');
  await dialog.getByLabel('Every how many').fill('1');
  await dialog.getByLabel('Unit').selectOption('week');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText(`Added ${title}`)).toBeVisible();
  await page.getByRole('button', { name: 'Care', exact: true }).click();
  const row = page.getByRole('listitem').filter({ hasText: title });
  await expect(row).toContainText('Due today');

  // Pet stays open (it publishes a couple of seconds after the change) while the portal, in
  // another tab signed in as the same member, gives it from the To-do list as Pet's own Done.
  const portal = await hh.open(browser, 'admin', 'about:blank');
  await runPortalTodo(portal, title, { action: 'done' });
  await expect(row).toContainText('Due in 7 days', { timeout: 20_000 });
  await expect(row).toContainText('last given today');
});

test('an admin turns outings on; a helper logs the AM outing, and the admin sees it as theirs', async ({ browser }) => {
  const admin = await hh.open(browser, 'admin');
  await openBoard(admin);
  const outings = (page: Page) => page.getByRole('region', { name: 'Outings', exact: true });
  if ((await outings(admin).count()) === 0) {
    await openPet(admin);
    const card = admin.getByRole('region', { name: `${PET}'s outings` });
    const setUp = card.getByRole('button', { name: 'Set up outings' });
    if (await setUp.isVisible()) {
      await setUp.click();
      const dialog = admin.getByRole('dialog', { name: `Outings for ${PET}` });
      await dialog.getByLabel('Poops a day, at least').fill('2');
      await dialog.getByRole('button', { name: 'Save' }).click();
    }
    await expect(card).toContainText('at least 2 poops a day');
    await admin.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: 'Today' }).click();
  }
  await expect(outings(admin)).toBeVisible({ timeout: 20_000 });

  const helper = await hh.open(browser, 'helper');
  await openBoard(helper);
  const pooped = outings(helper).getByRole('button', { name: `Take ${PET} out · AM: pooped` });
  const done = outings(helper).getByRole('button', { name: `Undo Take ${PET} out · AM` });
  await expect(pooped.or(done).first()).toBeVisible({ timeout: 20_000 });
  if (await pooped.isVisible()) await pooped.click();
  await expect(done).toBeVisible();
  await expect(outings(helper).getByTestId('poop-count')).toContainText(/[12] of 2 poops today/);
  await helper.waitForTimeout(3000);
  await expect(helper.getByText(/only admins and members can do that/)).toHaveCount(0);
  // The plan is the household's setup: a helper sees no Settings.
  await openPet(helper);
  await expect(helper.getByRole('button', { name: `Outing settings for ${PET}` })).toHaveCount(0);

  await admin.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: 'Today' }).click();
  await expect(outings(admin).locator('[data-completion=done]').first()).toContainText('Pooped', { timeout: 20_000 });
  await expect(outings(admin).locator('[data-completion=done]').first()).not.toContainText('You');
});
