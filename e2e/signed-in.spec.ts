import { expect, test, type Page } from '@playwright/test';
import { runPortalTodo, signInTestUser } from '@huishouden/pwa-kit/e2e';
import { seedTestHousehold } from '@huishouden/pwa-kit/staging';

// Signed in as an invented test user on the staging site (pwa-kit STANDARD.md "Staging"): the real
// staging Firestore and rules, the seeded test household. Other runs share that household and it
// keeps its data, so the test adds its pet only once and starts from an unticked meal.
test.skip(!process.env.HH_STAGING_SA, 'signed-in tests run against staging, in CI');

// Another app's run may have reseeded the household with an older kit, without the helper.
test.beforeAll(async () => {
  if (process.env.HH_STAGING_ACCESS_TOKEN) await seedTestHousehold({ accessToken: process.env.HH_STAGING_ACCESS_TOKEN });
});

const PET = 'Test pet';
const board = (page: Page) => page.getByRole('region', { name: 'Feeding' });
// first(): a pet added twice by runs racing on an empty household still gives one tile to follow.
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

test('the morning feed one member ticks shows as fed for the other', async ({ page, browser }) => {
  await signInTestUser(page, { email: 'test-a@example.com' });
  await openBoard(page);
  // An earlier run may have ticked it already today: untick, so this run's tick is its own.
  if (await amDone(page).isVisible()) {
    await amDone(page).click();
    await expect(am(page)).toBeVisible();
  }
  await am(page).click();
  await expect(amDone(page)).toBeVisible();
  await expect(am(page)).toHaveCount(0);
  await expect(board(page)).toContainText(/Fed by you · /);

  // Saved in the household, not just on this screen: the other member's own browser shows it fed.
  const other = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  try {
    const theirs = await other.newPage();
    await signInTestUser(theirs, { email: 'test-b@example.com' });
    await openBoard(theirs);
    await expect(amDone(theirs)).toBeVisible({ timeout: 20_000 });
    await expect(board(theirs).locator('[data-completion=done]').filter({ hasText: /Fed by .* · / }).first()).not.toContainText('by you');
  } finally {
    await other.close();
  }
});

const PILL = 'Restricted pill';
const pill = (page: Page) => board(page).getByRole('button', { name: new RegExp(`^Give ${PET} ${PILL}`) }).first();

/** test-a's year-long course for the test pet that only approved helpers may give (none are). */
async function restrictedCourse(page: Page) {
  await openBoard(page);
  if ((await pill(page).count()) > 0) return;
  await page.getByRole('button', { name: 'Pets', exact: true }).click();
  await page.getByRole('button', { name: PET }).first().click();
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

test('a helper is refused a course only approved helpers give, and logs a feed', async ({ page, browser }) => {
  const admin = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  try {
    const theirs = await admin.newPage();
    await signInTestUser(theirs, { email: 'test-a@example.com' });
    await restrictedCourse(theirs);
  } finally {
    await admin.close();
  }

  await signInTestUser(page, { email: 'test-helper@example.com' });
  await openBoard(page);
  // Refused: the dose, in words, and nothing written.
  await expect(pill(page)).toBeVisible({ timeout: 20_000 });
  const before = await pill(page).getAttribute('aria-label');
  await pill(page).click();
  await expect(page.getByText(`Only approved helpers can give ${PILL}.`)).toBeVisible();
  await expect(pill(page)).toHaveAttribute('aria-label', before!);

  // Permitted: a feed of their own, saved by the rules (no error toast) and shown as theirs.
  const note = `Helper feed ${Date.now()}`;
  await page.getByRole('button', { name: 'Pets', exact: true }).click();
  await page.getByRole('button', { name: PET }).first().click();
  await page.getByRole('region', { name: `${PET}'s feeding` }).getByRole('button', { name: 'Log a feed' }).click();
  const dialog = page.getByRole('dialog', { name: `Log a feed for ${PET}` });
  await dialog.getByLabel('Note (optional)').fill(note);
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText(/^Logged a feed at/)).toBeVisible();
  await expect(page.getByText(/only admins and members can do that/)).toHaveCount(0);
  await page.waitForTimeout(3000);
  await expect(page.getByText(/only admins and members can do that/)).toHaveCount(0);
});

const TODO_PREFIX = 'To-do check ';

/** Deletes this run's reminder and any an earlier run left behind (over 10 minutes old), from Care. */
async function removeTodoChecks(page: Page, title: string) {
  await page.getByRole('button', { name: 'Care', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Care', level: 2 })).toBeVisible();
  const edits = page.getByRole('button', { name: new RegExp(`^Edit ${TODO_PREFIX}\\d+ for `) });
  const names = await edits.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''));
  for (const name of new Set(names)) {
    const stamp = Number(name.slice(`Edit ${TODO_PREFIX}`.length).split(' ')[0]);
    if (!name.startsWith(`Edit ${title} `) && Date.now() - stamp < 10 * 60_000) continue;
    await page.getByRole('button', { name, exact: true }).first().click();
    await page.getByRole('dialog', { name: 'Edit reminder' }).getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
  }
}

test('care due today, done from the portal’s To-do list, moves on to its next due day in Pet', async ({ page, context }) => {
  test.setTimeout(120_000);
  const title = `${TODO_PREFIX}${Date.now()}`;
  await signInTestUser(page, { email: 'test-a@example.com' });
  await openBoard(page);

  try {
    // A weekly "Other" reminder for the test pet, due today (the dialog's default).
    await page.getByRole('button', { name: 'Pets', exact: true }).click();
    await page.getByRole('button', { name: PET }).first().click();
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
    const portal = await context.newPage();
    try {
      await runPortalTodo(portal, title, { action: 'done' });
    } finally {
      await portal.close();
    }
    await expect(row).toContainText('Due in 7 days', { timeout: 20_000 });
    await expect(row).toContainText('last given today');
  } finally {
    await removeTodoChecks(page, title);
  }
});
