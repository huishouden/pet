import { describe, expect, test } from 'bun:test';
import { agendaDoc, allDayStart } from '@huishouden/pwa-kit/agenda';
import { toYmd } from '@huishouden/pwa-kit/time';
import {
  agendaByRef,
  agendaItems,
  appointmentAgenda,
  birthdayAgenda,
  courseAgenda,
  courseDetail,
  mealAgenda,
  reminderAgenda,
  tabUrl,
  type AgendaData,
  type AgendaEntry,
} from './agenda';
import { mealAt } from './feeding';
import type { Appointment, Course, Feeding, Meal, Pet, Reminder } from './model';

// Invented household: two pets on a fixed day in 2031.
const NOW = new Date(2031, 4, 14, 10, 30).getTime();
const at = (m: number, d: number, hhmm = '12:00', y = 2031) => {
  const [h, min] = hhmm.split(':').map(Number);
  return new Date(y, m - 1, d, h, min).getTime();
};
const day = (m: number, d: number, y = 2031) => toYmd(at(m, d, '12:00', y));
const URL = 'https://example-pet.web.app';
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

const valid = (items: AgendaEntry[]) => {
  for (const i of items) expect(() => agendaDoc('pet', { ...i, ref: 'x' }, BY, NOW)).not.toThrow();
};

describe('appointments', () => {
  test('timed at the appointment, its place as the detail, no status', () => {
    const [item] = appointmentAgenda(appointment(), pets, NOW, URL);
    expect(item).toEqual({
      kind: 'appointment',
      title: 'Annual checkup',
      start: at(5, 20, '15:30'),
      allDay: false,
      detail: 'Example Animal Clinic',
      url: `${URL}/?tab=appointments&pet=pet-pepper`,
      who: 'Pepper',
    });
    valid([item]);
  });

  test('a visit for several pets names them all and links to the tab', () => {
    const [item] = appointmentAgenda(appointment({ petIds: [pepper.id, juniper.id], location: undefined }), pets, NOW, URL);
    expect(item.who).toBe('Pepper, Juniper');
    expect(item.url).toBe(`${URL}/?tab=appointments`);
    expect(item).not.toHaveProperty('detail');
  });

  test('one long past is left out', () => {
    expect(appointmentAgenda(appointment({ at: at(1, 2) }), pets, NOW, URL)).toEqual([]);
  });
});

describe('care reminders', () => {
  test('the next due day only, all day, upcoming, with how often', () => {
    const items = reminderAgenda(reminder(), pets, NOW, URL);
    expect(items).toEqual([
      {
        kind: 'due',
        title: 'Flea and tick',
        start: allDayStart(day(5, 20)),
        allDay: true,
        detail: 'Every month',
        url: `${URL}/?tab=care`,
        who: 'Pepper',
        status: 'upcoming',
      },
    ]);
    valid(items);
  });

  test('due today is upcoming; a day past is overdue, whatever its age', () => {
    expect(reminderAgenda(reminder({ due: day(5, 14) }), pets, NOW, URL)[0].status).toBe('upcoming');
    expect(reminderAgenda(reminder({ due: day(5, 13) }), pets, NOW, URL)[0].status).toBe('overdue');
    expect(reminderAgenda(reminder({ due: day(1, 2) }), pets, NOW, URL)[0].status).toBe('overdue');
  });

  test('every 3 months reads so; a one-off reads once; a given one-off is left out', () => {
    expect(reminderAgenda(reminder({ every: 3, unit: 'month' }), pets, NOW, URL)[0].detail).toBe('Every 3 months');
    expect(reminderAgenda(reminder({ every: undefined, unit: undefined }), pets, NOW, URL)[0].detail).toBe('Once');
    expect(reminderAgenda(reminder({ every: undefined, unit: undefined, lastDoneAt: at(5, 1) }), pets, NOW, URL)).toEqual([]);
  });
});

describe('medicine courses', () => {
  test('one all-day item from the first day to the day after the last, no per-dose items', () => {
    const items = courseAgenda(course(), pets, NOW, URL);
    expect(items).toEqual([
      {
        kind: 'medicine',
        title: 'Antibiotic',
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
    expect(courseAgenda(course({ days: 1, startDate: day(5, 14) }), pets, NOW, URL)[0]).toMatchObject({ start: allDayStart(day(5, 14)), end: allDayStart(day(5, 15)) });
    expect(courseAgenda(course({ startDate: day(1, 2) }), pets, NOW, URL)).toEqual([]);
  });
});

describe('birthdays', () => {
  test('the next birthday within 180 days, with the age it brings', () => {
    const items = birthdayAgenda(pepper, NOW, URL);
    expect(items).toEqual([
      { kind: 'birthday', title: 'Pepper turns 5', start: allDayStart(day(7, 1)), allDay: true, url: `${URL}/?tab=pets&pet=pet-pepper`, who: 'Pepper' },
    ]);
    valid(items);
  });

  test('today counts; more than 180 days ahead, approximate or missing does not', () => {
    expect(birthdayAgenda({ ...pepper, birthDate: day(5, 14, 2029) }, NOW, URL)[0]).toMatchObject({ title: 'Pepper turns 2', start: allDayStart(day(5, 14)) });
    expect(birthdayAgenda(juniper, NOW, URL)).toEqual([]);
    expect(birthdayAgenda({ ...pepper, birthDateApprox: true }, NOW, URL)).toEqual([]);
    expect(birthdayAgenda({ ...pepper, birthDate: undefined }, NOW, URL)).toEqual([]);
  });
});

describe('feeding', () => {
  test("today's meals at their times: done once fed today, otherwise upcoming", () => {
    const list = mealAgenda(pepper, meals, [fedAm], NOW, URL);
    expect(list.map((m) => m.ref)).toEqual(['meal:meal-am:2031-05-14', 'meal:meal-pm:2031-05-14']);
    expect(list[0].items).toEqual([
      {
        kind: 'feeding',
        title: 'Pepper: AM',
        start: mealAt('09:00', NOW),
        allDay: false,
        detail: 'Lamb kibble, 1 cup',
        url: `${URL}/?tab=pets&pet=pet-pepper`,
        who: 'Pepper',
        status: 'done',
      },
    ]);
    expect(list[1].items[0]).toMatchObject({ title: 'Pepper: PM', start: mealAt('19:00', NOW), status: 'upcoming' });
    expect(list[1].items[0]).not.toHaveProperty('detail');
    valid(list.flatMap((m) => m.items));
  });

  test("yesterday's feed does not tick today's meal", () => {
    expect(mealAgenda(pepper, meals, [fedAmYesterday], NOW, URL)[0].items[0].status).toBe('upcoming');
  });

  test('a pet with no meals has none', () => {
    expect(mealAgenda(juniper, meals, [], NOW, URL)).toEqual([]);
  });
});

describe('everything Pet publishes', () => {
  const data: AgendaData = {
    pets,
    appointments: [appointment()],
    reminders: [reminder(), reminder({ id: 'rem-done', every: undefined, unit: undefined, lastDoneAt: at(5, 1) })],
    courses: [course()],
    meals,
    feedings: [fedAm],
  };

  test('each record under its ref, records with nothing to publish kept (empty) so their items are removed', () => {
    const byRef = agendaByRef(data, NOW, URL);
    expect([...byRef.keys()].sort()).toEqual(
      [
        'appointment:apt-1',
        'birthday:pet-juniper',
        'birthday:pet-pepper',
        'course:course-1',
        'meal:meal-am:2031-05-14',
        'meal:meal-pm:2031-05-14',
        'reminder:rem-1',
        'reminder:rem-done',
      ].sort(),
    );
    expect(byRef.get('reminder:rem-done')).toEqual([]);
    expect(byRef.get('birthday:pet-juniper')).toEqual([]);
  });

  test('a flat list with refs, every item one the rules accept', () => {
    const items = agendaItems(data, NOW, URL);
    expect(items.map((i) => `${i.kind} ${i.ref}`).sort()).toEqual(
      [
        'appointment appointment:apt-1',
        'birthday birthday:pet-pepper',
        'due reminder:rem-1',
        'feeding meal:meal-am:2031-05-14',
        'feeding meal:meal-pm:2031-05-14',
        'medicine course:course-1',
      ].sort(),
    );
    for (const i of items) expect(() => agendaDoc('pet', i, BY, NOW)).not.toThrow();
  });

  test('logs are not published', () => {
    const items = agendaItems({ ...data, feedings: [fedAm, { ...fedAm, id: 'extra', mealId: undefined }] }, NOW, URL);
    expect(items.filter((i) => i.kind === 'feeding')).toHaveLength(2);
  });

  test('links default to the live app', () => {
    expect(tabUrl('care')).toBe('https://huishouden-pet.web.app/?tab=care');
    expect(agendaItems(data, NOW).every((i) => i.url.startsWith('https://huishouden-pet.web.app/?tab='))).toBe(true);
  });
});
