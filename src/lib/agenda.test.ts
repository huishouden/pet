import { describe, expect, test } from 'bun:test';
import { agendaDoc, agendaOpsAllowed, allDayStart, canEdit, fillEditOps } from '@huishouden/pwa-kit/agenda';
import { toYmd } from '@huishouden/pwa-kit/time';
import {
  appointmentEdit,
  appointmentEntry,
  courseEntry,
  reminderEdit,
  reminderEntry,
  agendaByRef,
  agendaItems,
  appointmentAgenda,
  birthdayAgenda,
  courseAgenda,
  agendaChanges,
  courseDetail,
  doseAgenda,
  mealAgenda,
  reminderAgenda,
  tabUrl,
  type AgendaData,
  type AgendaEntry,
} from './agenda';
import { mealAt } from './feeding';
import type { Appointment, Course, Feeding, Meal, MedDose, Pet, Reminder } from './model';

// Invented household: two pets on a fixed day in 2031.
const NOW = new Date(2031, 4, 14, 10, 30).getTime();
const at = (m: number, d: number, hhmm = '12:00', y = 2031) => {
  const [h, min] = hhmm.split(':').map(Number);
  return new Date(y, m - 1, d, h, min).getTime();
};
const day = (m: number, d: number, y = 2031) => toYmd(at(m, d, '12:00', y));
const ORIGIN = 'https://example-pet.web.app';
const URL = `${ORIGIN}/pet`;
const BY = 'sam@example.com';
const stamp = { createdAt: at(1, 5), by: BY };

const pepper: Pet = { id: 'pet-pepper', name: 'Pepper', species: 'dog', birthDate: day(7, 1, 2026), weightUnit: 'lb', ...stamp };
const juniper: Pet = { id: 'pet-juniper', name: 'Juniper', species: 'cat', birthDate: day(12, 1, 2028), weightUnit: 'kg', ...stamp };
const pets = [pepper, juniper];

const appointment = (over: Partial<Appointment> = {}): Appointment => ({
  id: 'apt-1',
  petIds: [pepper.id],
  kind: 'vet',
  title: 'Annual checkup',
  at: at(5, 20, '15:30'),
  location: 'Example Animal Clinic',
  ...stamp,
  ...over,
});

const reminder = (over: Partial<Reminder> = {}): Reminder => ({
  id: 'rem-1',
  petId: pepper.id,
  kind: 'flea-tick',
  title: 'Flea and tick',
  every: 1,
  unit: 'month',
  due: day(5, 20),
  ...stamp,
  ...over,
});

const course = (over: Partial<Course> = {}): Course => ({
  id: 'course-1',
  petId: juniper.id,
  name: 'Antibiotic',
  dose: '1 tablet',
  timesPerDay: 2,
  times: ['09:00', '19:00'],
  startDate: day(5, 12),
  days: 7,
  withFood: true,
  ...stamp,
  ...over,
});

const meals: Meal[] = [
  { id: 'meal-am', petId: pepper.id, name: 'AM', time: '09:00', food: 'Lamb kibble', portion: '1 cup', ...stamp },
  { id: 'meal-pm', petId: pepper.id, name: 'PM', time: '19:00', ...stamp },
];
const fedAm: Feeding = { id: 'feed-1', petId: pepper.id, mealId: 'meal-am', at: at(5, 14, '09:05'), ...stamp };
const fedAmYesterday: Feeding = { ...fedAm, id: 'feed-0', at: at(5, 13, '09:05') };
const givenAm: MedDose = { id: 'med-1', petId: juniper.id, courseId: 'course-1', slot: 0, at: at(5, 14, '09:10'), by: BY, createdAt: at(5, 14, '09:10') };

const valid = (items: AgendaEntry[]) => {
  for (const i of items) expect(() => agendaDoc('pet', { ...i, ref: 'x' }, BY, NOW)).not.toThrow();
};

describe('appointments', () => {
  test('timed at the appointment, its place as the detail, no status', () => {
    const [item] = appointmentAgenda(appointment(), pets, NOW, ORIGIN);
    expect(item).toEqual({
      kind: 'appointment',
      title: 'Annual checkup',
      start: at(5, 20, '15:30'),
      allDay: false,
      detail: 'Example Animal Clinic',
      url: `${URL}/?tab=appointments&pet=pet-pepper`,
      who: 'Pepper',
      edit: appointmentEdit(appointment()),
    });
    valid([item]);
  });

  test('a visit for several pets names them all and links to the tab', () => {
    const [item] = appointmentAgenda(appointment({ petIds: [pepper.id, juniper.id], location: undefined }), pets, NOW, ORIGIN);
    expect(item.who).toBe('Pepper, Juniper');
    expect(item.url).toBe(`${URL}/?tab=appointments`);
    expect(item).not.toHaveProperty('detail');
  });

  test('one long past is left out', () => {
    expect(appointmentAgenda(appointment({ at: at(1, 2) }), pets, NOW, ORIGIN)).toEqual([]);
  });

  test('a private appointment stays private on the agenda', () => {
    expect(appointmentAgenda(appointment({ private: true }), pets, NOW, ORIGIN)[0]?.private).toBe(true);
    expect(appointmentAgenda(appointment(), pets, NOW, ORIGIN)[0]?.private).toBeUndefined();
  });
});

describe('care reminders', () => {
  test('the next due day only, all day, upcoming, with how often', () => {
    const items = reminderAgenda(reminder(), pets, NOW, ORIGIN);
    expect(items).toEqual([
      {
        kind: 'due',
        title: 'Flea and tick for Pepper',
        start: allDayStart(day(5, 20)),
        allDay: true,
        detail: 'Every month',
        url: `${URL}/?tab=care`,
        who: 'Pepper',
        status: 'upcoming',
        edit: reminderEdit(reminder()),
      },
    ]);
    valid(items);
  });

  test('due today is upcoming; a day past is overdue, whatever its age', () => {
    expect(reminderAgenda(reminder({ due: day(5, 14) }), pets, NOW, ORIGIN)[0].status).toBe('upcoming');
    expect(reminderAgenda(reminder({ due: day(5, 13) }), pets, NOW, ORIGIN)[0].status).toBe('overdue');
    expect(reminderAgenda(reminder({ due: day(1, 2) }), pets, NOW, ORIGIN)[0].status).toBe('overdue');
  });

  test('a dismissed reminder is left out', () => {
    expect(reminderAgenda(reminder({ due: day(5, 13), dismissedAt: NOW - 1000 }), pets, NOW, ORIGIN)).toEqual([]);
  });

  test('a reminder for a pet no longer in the household keeps its own title, without a who', () => {
    const item = reminderAgenda(reminder({ petId: 'gone' }), pets, NOW, ORIGIN)[0];
    expect(item.title).toBe('Flea and tick');
    expect(item).not.toHaveProperty('who');
  });

  test('every 3 months reads so; a one-off reads once; a given one-off is left out', () => {
    expect(reminderAgenda(reminder({ every: 3, unit: 'month' }), pets, NOW, ORIGIN)[0].detail).toBe('Every 3 months');
    expect(reminderAgenda(reminder({ every: undefined, unit: undefined }), pets, NOW, ORIGIN)[0].detail).toBe('Once');
    expect(reminderAgenda(reminder({ every: undefined, unit: undefined, lastDoneAt: at(5, 1) }), pets, NOW, ORIGIN)).toEqual([]);
  });
});

describe('medicine courses', () => {
  test('one all-day item from the first day to the day after the last, no per-dose items', () => {
    const items = courseAgenda(course(), pets, NOW, ORIGIN);
    expect(items).toEqual([
      {
        kind: 'medicine',
        title: 'Antibiotic for Juniper',
        start: allDayStart(day(5, 12)),
        end: allDayStart(day(5, 19)),
        allDay: true,
        detail: '1 tablet, twice a day, with food',
        url: `${URL}/?tab=pets&pet=pet-juniper`,
        who: 'Juniper',
      },
    ]);
    valid(items);
  });

  test('the detail follows the dose times', () => {
    expect(courseDetail({ dose: '2 drops', times: ['08:00'], timesPerDay: 1, withFood: false })).toBe('2 drops, once a day');
    expect(courseDetail({ dose: '1 tablet', times: ['08:00', '14:00', '20:00'], timesPerDay: 3, withFood: true })).toBe('1 tablet, 3 times a day, with food');
  });

  test('a one-day course spans its day; one finished long ago is left out', () => {
    expect(courseAgenda(course({ days: 1, startDate: day(5, 14) }), pets, NOW, ORIGIN)[0]).toMatchObject({ start: allDayStart(day(5, 14)), end: allDayStart(day(5, 15)) });
    expect(courseAgenda(course({ startDate: day(1, 2) }), pets, NOW, ORIGIN)).toEqual([]);
  });
});

describe('medicine doses', () => {
  test("today's and tomorrow's doses at their times, done once given, so the portal's Today can tick them off", () => {
    const list = doseAgenda(course(), [givenAm], pets, NOW, ORIGIN);
    expect(list.map((d) => d.ref)).toEqual(['dose:course-1:2031-05-14:0', 'dose:course-1:2031-05-14:1', 'dose:course-1:2031-05-15:0', 'dose:course-1:2031-05-15:1']);
    expect(list[0].items).toEqual([
      {
        kind: 'medicine',
        title: 'Antibiotic for Juniper',
        start: at(5, 14, '09:00'),
        allDay: false,
        detail: '1 tablet',
        url: `${URL}/`,
        who: 'Juniper',
        status: 'done',
      },
    ]);
    expect(list[1].items[0]).toMatchObject({ start: at(5, 14, '19:00'), status: 'upcoming' });
    expect(list[2].items[0]).toMatchObject({ start: at(5, 15, '09:00'), status: 'upcoming' });
    valid(list.flatMap((d) => d.items));
  });

  test('a dose not given by its time stays upcoming for the kit to call overdue; none outside the course', () => {
    expect(doseAgenda(course(), [], pets, at(5, 14, '11:00'), ORIGIN)[0].items[0].status).toBe('upcoming');
    expect(doseAgenda(course({ startDate: day(5, 1) }), [], pets, NOW, ORIGIN)).toEqual([]);
    expect(doseAgenda(course({ startDate: day(5, 15), days: 1 }), [], pets, NOW, ORIGIN).map((d) => d.ref)).toEqual(['dose:course-1:2031-05-15:0', 'dose:course-1:2031-05-15:1']);
  });
});

describe('birthdays', () => {
  test('the next birthday within 180 days, with the age it brings', () => {
    const items = birthdayAgenda(pepper, NOW, ORIGIN);
    expect(items).toEqual([
      { kind: 'birthday', title: 'Pepper turns 5', start: allDayStart(day(7, 1)), allDay: true, url: `${URL}/?tab=pets&pet=pet-pepper`, who: 'Pepper' },
    ]);
    valid(items);
  });

  test('today counts; more than 180 days ahead, approximate or missing does not', () => {
    expect(birthdayAgenda({ ...pepper, birthDate: day(5, 14, 2029) }, NOW, ORIGIN)[0]).toMatchObject({ title: 'Pepper turns 2', start: allDayStart(day(5, 14)) });
    expect(birthdayAgenda(juniper, NOW, ORIGIN)).toEqual([]);
    expect(birthdayAgenda({ ...pepper, birthDateApprox: true }, NOW, ORIGIN)).toEqual([]);
    expect(birthdayAgenda({ ...pepper, birthDate: undefined }, NOW, ORIGIN)).toEqual([]);
  });
});

describe('feeding', () => {
  test("today's and tomorrow's meals at their times: done once fed that day, otherwise upcoming", () => {
    const list = mealAgenda(pepper, meals, [fedAm], NOW, ORIGIN);
    expect(list.map((m) => m.ref)).toEqual(['meal:meal-am:2031-05-14', 'meal:meal-pm:2031-05-14', 'meal:meal-am:2031-05-15', 'meal:meal-pm:2031-05-15']);
    expect(list[0].items).toEqual([
      {
        kind: 'feeding',
        title: 'Feed Pepper · AM',
        start: mealAt('09:00', NOW),
        allDay: false,
        detail: 'Lamb kibble, 1 cup',
        url: `${URL}/`,
        who: 'Pepper',
        status: 'done',
      },
    ]);
    expect(list[1].items[0]).toMatchObject({ title: 'Feed Pepper · PM', start: mealAt('19:00', NOW), status: 'upcoming' });
    expect(list[1].items[0]).not.toHaveProperty('detail');
    valid(list.flatMap((m) => m.items));
  });

  test("tomorrow's meals at tomorrow's times, upcoming even though today's is fed", () => {
    const list = mealAgenda(pepper, meals, [fedAm], NOW, ORIGIN);
    expect(list[2].items).toEqual([
      {
        kind: 'feeding',
        title: 'Feed Pepper · AM',
        start: at(5, 15, '09:00'),
        allDay: false,
        detail: 'Lamb kibble, 1 cup',
        url: `${URL}/`,
        who: 'Pepper',
        status: 'upcoming',
      },
    ]);
    expect(list[3].items[0]).toMatchObject({ title: 'Feed Pepper · PM', start: at(5, 15, '19:00'), status: 'upcoming' });
  });

  test("just before midnight, tomorrow's morning meal is already published", () => {
    const late = at(5, 14, '23:59');
    const list = mealAgenda(pepper, meals, [], late, ORIGIN);
    expect(list.find((m) => m.ref === 'meal:meal-am:2031-05-15')!.items[0]).toMatchObject({ start: at(5, 15, '09:00'), status: 'upcoming' });
  });

  test("yesterday's feed does not tick today's meal", () => {
    expect(mealAgenda(pepper, meals, [fedAmYesterday], NOW, ORIGIN)[0].items[0].status).toBe('upcoming');
  });

  test('a pet with no meals has none', () => {
    expect(mealAgenda(juniper, meals, [], NOW, ORIGIN)).toEqual([]);
  });
});

describe('everything Pet publishes', () => {
  const data: AgendaData = {
    pets,
    appointments: [appointment()],
    reminders: [reminder(), reminder({ id: 'rem-done', every: undefined, unit: undefined, lastDoneAt: at(5, 1) })],
    courses: [course()],
    medDoses: [],
    meals,
    feedings: [fedAm],
  };

  test('each record under its ref, records with nothing to publish kept (empty) so their items are removed', () => {
    const byRef = agendaByRef(data, NOW, ORIGIN);
    expect([...byRef.keys()].sort()).toEqual(
      [
        'appointment:apt-1',
        'birthday:pet-juniper',
        'birthday:pet-pepper',
        'course:course-1',
        'dose:course-1:2031-05-14:0',
        'dose:course-1:2031-05-14:1',
        'dose:course-1:2031-05-15:0',
        'dose:course-1:2031-05-15:1',
        'meal:meal-am:2031-05-14',
        'meal:meal-pm:2031-05-14',
        'meal:meal-am:2031-05-15',
        'meal:meal-pm:2031-05-15',
        'reminder:rem-1',
        'reminder:rem-done',
      ].sort(),
    );
    expect(byRef.get('reminder:rem-done')).toEqual([]);
    expect(byRef.get('birthday:pet-juniper')).toEqual([]);
  });

  test('a flat list with refs, every item one the rules accept', () => {
    const items = agendaItems(data, NOW, ORIGIN);
    expect(items.map((i) => `${i.kind} ${i.ref}`).sort()).toEqual(
      [
        'appointment appointment:apt-1',
        'birthday birthday:pet-pepper',
        'due reminder:rem-1',
        'feeding meal:meal-am:2031-05-14',
        'feeding meal:meal-pm:2031-05-14',
        'feeding meal:meal-am:2031-05-15',
        'feeding meal:meal-pm:2031-05-15',
        'medicine course:course-1',
        'medicine dose:course-1:2031-05-14:0',
        'medicine dose:course-1:2031-05-14:1',
        'medicine dose:course-1:2031-05-15:0',
        'medicine dose:course-1:2031-05-15:1',
      ].sort(),
    );
    for (const i of items) expect(() => agendaDoc('pet', i, BY, NOW)).not.toThrow();
  });

  test('logs are not published', () => {
    const items = agendaItems({ ...data, feedings: [fedAm, { ...fedAm, id: 'extra', mealId: undefined }] }, NOW, ORIGIN);
    expect(items.filter((i) => i.kind === 'feeding')).toHaveLength(4);
  });

  test('links default to the live app', () => {
    expect(tabUrl('care')).toBe('https://huishouden-piekstra.web.app/pet/?tab=care');
    expect(agendaItems(data, NOW).every((i) => i.url.startsWith('https://huishouden-piekstra.web.app/pet/'))).toBe(true);
  });

  test('the course span has no status, so the portal shows it on the calendar but not on Today', () => {
    expect(agendaByRef(data, NOW, ORIGIN).get('course:course-1')![0]).not.toHaveProperty('status');
  });
});

describe('writes after a change', () => {
  const data: AgendaData = { pets, appointments: [appointment()], reminders: [reminder()], courses: [course()], medDoses: [], meals, feedings: [] };
  const writtenFrom = (d: AgendaData) => new Map([...agendaByRef(d, NOW, ORIGIN)].map(([ref, items]) => [ref, JSON.stringify(items)]));

  test('nothing to write when nothing changed', () => {
    expect(agendaChanges(writtenFrom(data), agendaByRef(data, NOW, ORIGIN))).toEqual({ replace: [], remove: [] });
  });

  test('ticking a meal rewrites only that meal, now done', () => {
    const { replace, remove } = agendaChanges(writtenFrom(data), agendaByRef({ ...data, feedings: [fedAm] }, NOW, ORIGIN));
    expect(replace.map(([ref]) => ref)).toEqual(['meal:meal-am:2031-05-14']);
    expect(replace[0][1][0].status).toBe('done');
    expect(remove).toEqual([]);
  });

  test('giving a dose rewrites only that dose, now done; un-ticking puts it back', () => {
    const given = { ...data, medDoses: [givenAm] };
    const tick = agendaChanges(writtenFrom(data), agendaByRef(given, NOW, ORIGIN));
    expect(tick.replace.map(([ref]) => ref)).toEqual(['dose:course-1:2031-05-14:0']);
    expect(tick.replace[0][1][0].status).toBe('done');
    const untick = agendaChanges(writtenFrom(given), agendaByRef(data, NOW, ORIGIN));
    expect(untick.replace.map(([ref, items]) => [ref, items[0].status])).toEqual([['dose:course-1:2031-05-14:0', 'upcoming']]);
  });

  test('a deleted course removes its span and its doses', () => {
    const { remove } = agendaChanges(writtenFrom(data), agendaByRef({ ...data, courses: [] }, NOW, ORIGIN));
    expect(remove.sort()).toEqual(['course:course-1', 'dose:course-1:2031-05-14:0', 'dose:course-1:2031-05-14:1', 'dose:course-1:2031-05-15:0', 'dose:course-1:2031-05-15:1']);
  });
});

describe('changes made in a calendar come back', () => {
  test('an appointment: moved, renamed, re-noted (no updatedAt, as its rules say), deleted', () => {
    const a = appointment();
    const edit = appointmentEdit(a);
    expect(fillEditOps(edit.reschedule!.ops, { start: a.at + 3_600_000 })).toEqual([{ col: 'petAppointments', id: a.id, data: { at: a.at + 3_600_000 }, merge: true }]);
    expect(fillEditOps(edit.rename!.ops, { title: 'Checkup' })[0].data).toEqual({ title: 'Checkup' });
    expect(edit.cancel!.ops).toEqual([{ col: 'petAppointments', id: a.id, data: null }]);
    for (const x of Object.values(edit)) expect(agendaOpsAllowed('pet', x!.ops)).toBe(true);
    const item = agendaDoc('pet', { ...appointmentAgenda(a, pets, NOW, ORIGIN)[0], ref: 'appointment:x' }, a.by);
    expect(canEdit(item, 'reschedule', 'helper', 'someone@example.com')).toBe(false);
    expect(canEdit(item, 'reschedule', 'helper', a.by)).toBe(true);
  });

  test('a reminder: moved to another day moves its due day; deleted dismisses it; no rename', () => {
    const r = reminder();
    const edit = reminderEdit(r);
    expect(fillEditOps(edit.reschedule!.ops, { date: '2031-06-01' })[0].data).toEqual({ due: '2031-06-01', updatedAt: '$now' });
    expect(edit.cancel!.ops[0].data).toEqual({ dismissedAt: '$now', updatedAt: '$now' });
    expect(edit.rename).toBeUndefined();
    expect(edit.reschedule!.roles).toEqual(['admin', 'member', 'helper']);
    expect(reminderEdit({ ...r, kind: 'vaccine' }).reschedule!.roles).toContain('kid');
  });

  test('"Add to calendar" entries: an appointment at its place, a reminder all day, a course first day to last', () => {
    expect(appointmentEntry(appointment(), pets, ORIGIN)).toMatchObject({ title: 'Annual checkup', allDay: false, location: 'Example Animal Clinic' });
    expect(reminderEntry(reminder(), pets, NOW, ORIGIN)).toMatchObject({ title: 'Flea and tick for Pepper', allDay: true });
    expect(reminderEntry(reminder({ dismissedAt: NOW }), pets, NOW, ORIGIN)).toBeNull();
    const [span] = courseAgenda(course(), pets, NOW, ORIGIN);
    expect(courseEntry(course(), pets, ORIGIN)).toMatchObject({ allDay: true, start: span.start, end: span.end });
  });
});
