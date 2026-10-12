import { expect, test, type Browser, type Page } from '@playwright/test';
import { expectPageReads, useTestHousehold } from '@huishouden/pwa-kit/e2e';
import { testHousehold } from '@huishouden/pwa-kit/staging';

// Read budgets (pwa-kit STANDARD.md "Read budgets"): what opening Pet costs a household in
// Firestore reads, on the emulators with a build that counts them (`expectPageReads`), each in a
// fresh browser context (a first open, nothing cached). A change that raises a ceiling says why in
// its PR. An invented household of two pets (below); some records are older than what Pet reads.
const NOW = Date.now();
const DAY = 86_400_000;
const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const by = testHousehold('reads').users.admin.email;
const made = { createdAt: NOW - 200 * DAY, by };

const docs: Record<string, Record<string, unknown>> = {
  'petProfiles/miso': { name: 'Test Miso', species: 'cat', weightUnit: 'kg', ...made },
  'petProfiles/rex': { name: 'Test Rex', species: 'dog', weightUnit: 'kg', ...made },
  // Two meals each; fed this morning, and a feeding of 20 days ago (Pet reads 15 days).
  'petMeals/miso-am': { petId: 'miso', name: 'AM', time: '07:00', ...made },
  'petMeals/miso-pm': { petId: 'miso', name: 'PM', time: '18:00', ...made },
  'petMeals/rex-am': { petId: 'rex', name: 'AM', time: '07:00', ...made },
  'petMeals/rex-pm': { petId: 'rex', name: 'PM', time: '18:00', ...made },
  'petFeedings/f1': { petId: 'miso', mealId: 'miso-am', at: NOW - 2 * 3_600_000, by, createdAt: NOW - 2 * 3_600_000 },
  'petFeedings/f-old': { petId: 'rex', mealId: 'rex-am', at: NOW - 20 * DAY, by, createdAt: NOW - 20 * DAY },
  // Care: a monthly flea treatment with two doses given.
  'petReminders/flea': { petId: 'miso', kind: 'flea-tick', title: 'Test flea drops', every: 1, unit: 'month', due: ymd(NOW + 10 * DAY), lastDoneAt: NOW - 20 * DAY, ...made },
  'petDoses/d1': { petId: 'miso', reminderId: 'flea', title: 'Test flea drops', at: NOW - 20 * DAY, by, createdAt: NOW - 20 * DAY },
  'petDoses/d2': { petId: 'miso', reminderId: 'flea', title: 'Test flea drops', at: NOW - 50 * DAY, by, createdAt: NOW - 50 * DAY },
  // A course of an antibiotic, twice a day, started three days ago: four doses given.
  'petMedCourses/abx': { petId: 'rex', name: 'Test antibiotic', dose: '1 tablet', timesPerDay: 2, times: ['08:00', '20:00'], startDate: ymd(NOW - 3 * DAY), days: 10, withFood: true, ...made },
  ...Object.fromEntries([1, 2, 3, 4].map((n) => [`petMedDoses/abx-${n}`, { petId: 'rex', courseId: 'abx', slot: n % 2, at: NOW - Math.ceil(n / 2) * DAY, by, createdAt: NOW - Math.ceil(n / 2) * DAY }])),
  // Appointments: one for everyone, one private (helpers and kids never read it).
  'petAppointments/vet': { petIds: ['rex'], kind: 'vet', title: 'Test vet visit', at: NOW + 5 * DAY, private: false, ...made },
  'petAppointments/groom': { petIds: ['miso'], kind: 'grooming', title: 'Test grooming', at: NOW + 8 * DAY, private: true, ...made },
  'petWeights/w1': { petId: 'rex', at: NOW - 30 * DAY, value: 20, unit: 'kg', by, createdAt: NOW - 30 * DAY },
  'petRecords/r1': { petId: 'rex', title: 'Test rabies certificate', date: ymd(NOW - 100 * DAY), ...made },
  // Routines: scoop daily, change the litter weekly. Pet reads back as far as the weekly one's
  // history (14 weeks, `logWindowStart`): the scoops of 5 and 20 days ago and the litter changes of
  // 14 and 50 days ago are read; the scoop of 120 days ago is not.
  'petRoutines/scoop': { name: 'Test scoop', kind: 'scoop', petIds: ['miso'], mode: 'fixed', every: 1, unit: 'day', since: ymd(NOW - 200 * DAY), ...made },
  'petRoutines/litter': { name: 'Test litter', kind: 'litter', petIds: ['miso'], mode: 'after-done', every: 1, unit: 'week', since: ymd(NOW - 200 * DAY), ...made },
  ...Object.fromEntries(
    [
      ['scoop', 5],
      ['scoop', 20],
      ['scoop', 120],
      ['litter', 14],
      ['litter', 50],
    ].map(([r, d]) => [`petRoutineLogs/rtn-${r}-${ymd(NOW - (d as number) * DAY)}`, { routineId: r, due: ymd(NOW - (d as number) * DAY), on: ymd(NOW - (d as number) * DAY), at: NOW - (d as number) * DAY, by, createdAt: NOW - (d as number) * DAY }]),
  ),
  'contacts/vet': { name: 'Test Vet clinic', role: 'Vet', phone: '555-0100', apps: ['pet'], private: false, ...made },
  'contacts/sitter': { name: 'Test sitter', role: 'Sitter', phone: '555-0101', apps: ['pet'], private: true, ...made },
};
const hh = useTestHousehold(test, { scope: 'reads', docs });

// One open at a time: another open's writes (a sign-in's profile, its publish) would reach this
// page's listeners and be counted as its reads.
test.describe.configure({ mode: 'serial' });

type Role = 'admin' | 'member' | 'helper' | 'kid';
const board = (page: Page) => expect(page.getByRole('region', { name: 'Feeding' })).toBeVisible({ timeout: 30_000 });

// Each person has used Pet before on another device: a first sign-in's own writes (joined, the
// profile) are done, so they don't land in a measured open.
test.beforeAll(async ({ browser }) => {
  test.setTimeout(150_000);
  for (const as of ['admin', 'member', 'helper', 'kid'] as const) {
    const page = await hh.open(browser, as);
    await board(page);
    await page.waitForTimeout(3000);
    await page.close();
  }
});

async function firstOpen(browser: Browser, as: Role, path: string, ready: (page: Page) => Promise<unknown>, max: number, label: string) {
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  try {
    const page = await context.newPage();
    return await expectPageReads(
      page,
      async () => {
        await hh.signIn(page, as, path);
        await ready(page);
      },
      // Past the publish two seconds after the lists are in.
      { max, min: max, label, settleMs: 3500 },
    );
  } finally {
    await context.close();
  }
}

// 32: every tab mounts the same listeners: the household (1); pets (2), care reminders (1) and their
// doses (2), the course (1) and its doses (4), appointments (2), weights (1), records (1), meals (4),
// two weeks of feedings (1) and outings (none: 1), outing plans (none: 1), photos (none: 1),
// routines (2) and their logs (4); the contacts (2) and their payment details (none: 1). On the
// local preview the links are http, so the publish stops before reading; e2e/reads.sdk.ts budgets it.
for (const [tab, ready] of [
  ['', board],
  ['?tab=care', (p: Page) => expect(p.getByText('Test flea drops').first()).toBeVisible({ timeout: 30_000 })],
  ['?tab=appointments', (p: Page) => expect(p.getByText('Test vet visit').first()).toBeVisible({ timeout: 30_000 })],
  ['?tab=pets', (p: Page) => expect(p.getByText('Test Miso').first()).toBeVisible({ timeout: 30_000 })],
  ['?tab=contacts', (p: Page) => expect(p.getByText('Test Vet clinic').first()).toBeVisible({ timeout: 30_000 })],
] as const) {
  test(`opening Pet${tab ? ` at ${tab.slice(5)}` : ' (Today)'}, signed in as an admin`, async ({ browser }) => {
    await firstOpen(browser, 'admin', `./${tab}`, ready, 32, `Pet ${tab || 'Today'}, admin`);
  });
}

// A member reads what an admin does. Helpers and kids ask only for what isn't private: the vet
// visit, not the grooming; the vet clinic, not the sitter; and no contacts' payment details.
for (const [as, max] of [['member', 32], ['helper', 29], ['kid', 29]] as const) {
  test(`opening Pet (Today), signed in as a ${as}`, async ({ browser }) => {
    await firstOpen(browser, as, './', board, max, `Pet Today, ${as}`);
  });
}
