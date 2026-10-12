// Read budgets of Pet's own sync paths (pwa-kit STANDARD.md "Read budgets"), on the emulators with
// the household's rules (`bun run e2e:emulator`, which `hh dev evidence` runs inside
// `firebase emulators:exec`): what an open publishes (push reminders, the household to-dos and
// agenda) and what a change republishes. Reads are counted from the SDK's own results as Firestore
// bills them (`readCounter().sdk`); the interleaving tests land another device's write before each
// read. Its own `bun test` process: it replaces firebase/firestore with the counted module for the
// process. A change that raises a ceiling says why in its PR.
import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { expectReads, readCounter, writeBeforeEachRead } from '@huishouden/pwa-kit/read-test';
import { e2eProject, e2eTarget, seedTestHousehold, testHousehold, writeTestDocs, type TestHousehold } from '@huishouden/pwa-kit/staging';
import { agendaDoc } from '@huishouden/pwa-kit/agenda';
import { reminderDoc } from '@huishouden/pwa-kit/reminders';
import { todoDoc } from '@huishouden/pwa-kit/todos';
import { addDays, toYmd } from '@huishouden/pwa-kit/time';
import { emptyData, type PetHouseholdData } from '../src/lib/demo';

const real = await import('firebase/firestore');
const counter = readCounter();
mock.module('firebase/firestore', () => counter.sdk(real));
const { connectFirestoreEmulator, initializeFirestore, memoryLocalCache, terminate } = await import('firebase/firestore');
const { publishAgenda, publishAgendaChanges, publishReminderChanges, publishReminders, publishTodos, reminderSignatures } = await import('../src/data/publish');
const { agendaByRef } = await import('../src/lib/agenda');

const emulator = e2eTarget() === 'emulator';
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
// Tomorrow at 10:30 local time, so the counts don't hang on when the test runs: the morning meals
// and doses are past, the evening ones ahead.
const NOW = new Date(new Date().setHours(0, 0, 0, 0) + DAY + 10.5 * HOUR).getTime();
const TODAY = toYmd(NOW);
// The rules take only the suite's own addresses.
const URL = 'https://huishouden-staging.web.app/pet/';

let hh: TestHousehold;
let app: FirebaseApp;
let db: ReturnType<typeof real.getFirestore>;
/** The helper's device. */
let helperApp: FirebaseApp;
let helperDb: ReturnType<typeof real.getFirestore>;
let admin: string;
let outers: string[];

beforeAll(async () => {
  if (!emulator) return;
  hh = await seedTestHousehold({ household: testHousehold('pet-reads-sdk') });
  admin = hh.users.admin.email;
  outers = [hh.users.admin, hh.users.member, hh.users.helper].map((u) => u.email);
  app = initializeApp({ apiKey: 'demo-key', projectId: e2eProject(), appId: 'demo' }, `reads-${hh.id}`);
  db = initializeFirestore(app, { localCache: memoryLocalCache() });
  connectFirestoreEmulator(db, process.env.HH_EMULATOR_HOST || '127.0.0.1', Number(process.env.HH_EMULATOR_FIRESTORE_PORT || 8080), {
    mockUserToken: { sub: hh.users.admin.uid, email: admin, email_verified: true },
  });
  helperApp = initializeApp({ apiKey: 'demo-key', projectId: e2eProject(), appId: 'demo' }, `reads-helper-${hh.id}`);
  helperDb = initializeFirestore(helperApp, { localCache: memoryLocalCache() });
  connectFirestoreEmulator(helperDb, process.env.HH_EMULATOR_HOST || '127.0.0.1', Number(process.env.HH_EMULATOR_FIRESTORE_PORT || 8080), {
    mockUserToken: { sub: hh.users.helper.uid, email: hh.users.helper.email, email_verified: true },
  });
});

afterAll(async () => {
  if (!emulator) return;
  await terminate(db);
  await terminate(helperDb);
  await deleteApp(app);
  await deleteApp(helperApp);
});

// An invented household: two pets with a morning and an evening meal each, an antibiotic course
// twice a day, a flea treatment due in three days, a vet visit in five, and two routines (scoop
// daily with reminders, change the litter weekly).
function data(): PetHouseholdData {
  const made = { createdAt: NOW - 100 * DAY, by: admin };
  return {
    ...emptyData(),
    pets: [
      { id: 'miso', name: 'Test Miso', species: 'cat', weightUnit: 'kg', ...made },
      { id: 'rex', name: 'Test Rex', species: 'dog', weightUnit: 'kg', ...made },
    ],
    meals: ['miso', 'rex'].flatMap((petId) => [
      { id: `${petId}-am`, petId, name: 'AM', time: '07:00', ...made },
      { id: `${petId}-pm`, petId, name: 'PM', time: '18:00', ...made },
    ]),
    courses: [{ id: 'abx', petId: 'rex', name: 'Test antibiotic', dose: '1 tablet', timesPerDay: 2, times: ['08:00', '20:00'], startDate: addDays(TODAY, -1), days: 10, withFood: true, ...made }],
    reminders: [{ id: 'flea', petId: 'miso', kind: 'flea-tick', title: 'Test flea drops', every: 1, unit: 'month', due: addDays(TODAY, 3), ...made }],
    appointments: [{ id: 'vet', petIds: ['rex'], kind: 'vet', title: 'Test vet visit', at: NOW + 5 * DAY, private: false, ...made }],
    routines: [
      { id: 'scoop', name: 'Test scoop', kind: 'scoop', petIds: ['miso'], mode: 'fixed', every: 1, unit: 'day', since: addDays(TODAY, -30), remind: true, time: '09:00', ...made },
      { id: 'litter', name: 'Test litter', kind: 'litter', petIds: ['miso'], mode: 'after-done', every: 1, unit: 'week', since: addDays(TODAY, -30), ...made },
    ],
  } as PetHouseholdData;
}

/** An open's publish: reminders, to-dos and agenda, one after the other (as the app's hooks run them). */
async function openPublish(published: null) {
  const reminders = await publishReminders(db, hh.id, admin, data(), NOW, outers, { published });
  const todos = await publishTodos(db, hh.id, admin, data(), NOW, { published });
  const agenda = await publishAgenda(db, hh.id, admin, data(), NOW, { published });
  return { reminders, todos, agenda };
}

/** Another device's stray Pet item in each list Pet publishes to: the sync must remove it. */
const stray = (n: number) => ({
  [`reminders/pet-stray-${n}`]: reminderDoc({ app: 'pet', ref: `pet:stray:${n}`, title: `Old ${n}`, at: NOW + 2 * DAY, url: URL, recipients: 'all' }, admin, NOW),
  [`agenda/pet-stray-${n}`]: agendaDoc('pet', { ref: `pet:stray:${n}`, kind: 'other', title: `Old ${n}`, start: NOW + 2 * DAY, allDay: true, url: URL }, admin, NOW),
  [`todos/pet-stray-${n}`]: todoDoc('pet', { ref: `pet:stray:${n}`, title: `Old ${n}`, createdAt: NOW - DAY, url: URL }, admin, NOW),
});

describe.skipIf(!emulator)("an open's publish (reminders, to-dos, agenda): one query each, none when this device already published the same", () => {
  test('first, again, and with this device\'s note', async () => {
    await expectReads(() => openPublish(null), { max: 3, min: 3, counter, label: 'Pet publish, first' });
    // Again without the note: each query returns what the first wrote: 24 reminders (the course's
    // doses, the evening meals, the daily scoop), 4 to-dos and 15 agenda items.
    const { value, reads } = await expectReads(() => openPublish(null), { max: 43, min: 43, counter, label: 'Pet publish, again' });
    expect(reads).toBe(value.reminders.unchanged + value.todos.unchanged + value.agenda.unchanged);
    const notes = new Map<string, string>();
    const store = { getItem: (k: string) => notes.get(k) ?? null, setItem: (k: string, v: string) => void notes.set(k, v), removeItem: (k: string) => void notes.delete(k), key: (i: number) => [...notes.keys()][i] ?? null, get length() { return notes.size; } };
    await publishReminders(db, hh.id, admin, data(), NOW, outers, { published: store });
    await publishTodos(db, hh.id, admin, data(), NOW, { published: store });
    await publishAgenda(db, hh.id, admin, data(), NOW, { published: store });
    await expectReads(
      async () => {
        await publishReminders(db, hh.id, admin, data(), NOW, outers, { published: store });
        await publishTodos(db, hh.id, admin, data(), NOW, { published: store });
        await publishAgenda(db, hh.id, admin, data(), NOW, { published: store });
      },
      { max: 0, counter, label: 'Pet publish, published' },
    );
  });

  test('interleaving: another device writes before each of its three reads; one pass, its 43 items and the 6 strays read once', async () => {
    let n = 0;
    const { value } = await expectReads(() => openPublish(null), {
      max: 49,
      min: 49,
      counter,
      label: 'Pet publish with a write before each read',
      beforeRead: writeBeforeEachRead(() => writeTestDocs(hh, stray(++n))),
    });
    expect(n).toBe(3);
    expect([value.reminders.deleted, value.todos.deleted, value.agenda.deleted]).toEqual([1, 2, 3]);
  });
});

describe.skipIf(!emulator)("a change: one query for each record whose agenda items changed", () => {
  test('the vet visit moved and the flea treatment gone: two queries', async () => {
    const before = data();
    const written = new Map([...agendaByRef(before, NOW)].map(([ref, items]) => [ref, JSON.stringify(items)]));
    const after = { ...before, appointments: [{ ...before.appointments[0]!, at: NOW + 6 * DAY }], reminders: [] };
    const { value } = await expectReads(() => publishAgendaChanges(db, hh.id, admin, written, after, NOW), { max: 2, min: 2, counter, label: 'Pet agenda change' });
    expect(value).toEqual({ replaced: 1, removed: 1 });
  });
});

describe.skipIf(!emulator)('a change to reminders: one query for each record whose reminders changed', () => {
  test("Miso's morning meal fed: only Miso's meal reminders are read and replaced", async () => {
    const before = data();
    await publishReminders(db, hh.id, admin, before, NOW, outers, { published: null });
    const written = reminderSignatures(before, NOW, outers);
    // Fed this evening's meal early: today's PM cut-off goes, tomorrow's stays.
    const after = { ...before, feedings: [{ id: 'f1', petId: 'miso', mealId: 'miso-pm', at: NOW, by: admin, createdAt: NOW }] } as PetHouseholdData;
    // Miso's meal reminders before the change: today's PM and tomorrow's AM and PM.
    const { value } = await expectReads(() => publishReminderChanges(db, hh.id, admin, written, after, NOW, outers), { max: 3, min: 3, counter, label: 'Pet reminders, a meal fed' });
    expect(value).toEqual({ replaced: 1, removed: 0, failed: 0 });
    // Nothing changed since: nothing read.
    await expectReads(() => publishReminderChanges(db, hh.id, admin, written, after, NOW, outers), { max: 0, counter, label: 'Pet reminders, no change' });
  });
});

describe.skipIf(!emulator)("a helper's device: the restricted publish, under the rules", () => {
  test("publishes what isn't private, and leaves the private items another member published", async () => {
    // The admin's device publishes with a private grooming appointment the helper never reads.
    const groom = { id: 'groom', petIds: ['miso'], kind: 'grooming', title: 'Test grooming', at: NOW + 4 * DAY, private: true, createdAt: NOW - DAY, by: admin };
    const full = { ...data(), appointments: [...data().appointments, groom] } as PetHouseholdData;
    await publishAgenda(db, hh.id, admin, full, NOW, { published: null });
    // The helper's device, with what the rules let it read, publishes restricted: its queries ask
    // only for items that aren't private.
    const { value } = await expectReads(
      async () => {
        const reminders = await publishReminders(helperDb, hh.id, hh.users.helper.email, data(), NOW, outers, { restricted: true, published: null });
        const todos = await publishTodos(helperDb, hh.id, hh.users.helper.email, data(), NOW, { restricted: true, published: null });
        const agenda = await publishAgenda(helperDb, hh.id, hh.users.helper.email, data(), NOW, { restricted: true, published: null });
        return { reminders, todos, agenda };
      },
      // 43: the 23 reminders already there (Miso's meal changed above, one is written), the 4 to-dos
      // and one stray of the interleaving test's, and the 15 agenda items: not the private grooming.
      { max: 43, min: 43, counter, label: 'Pet publish, helper' },
    );
    expect(value.agenda.deleted).toBe(0);
    // The private item is still there: the admin's next publish has nothing to put back.
    const again = await publishAgenda(db, hh.id, admin, full, NOW, { published: null });
    expect(again).toMatchObject({ written: 0, deleted: 0 });
  });
});
