import { describe, expect, test } from 'bun:test';
import { courseDay, courseHistory, courseState, courseText, daysUntil, defaultTimes, dosesOn, givenOnFor, givenTodayFor, lastDay, progress, slotAt, slotMealName, timesText, todaysDoses } from './courses';
import { mealAt } from './feeding';

const now = new Date('2031-05-14T10:30:00').getTime();
const course = { id: 'k1', petId: 'p1', name: 'Antibiotic', times: ['09:00', '19:00'], startDate: '2031-05-12', days: 7 };
const at = (s: string) => new Date(s).getTime();
const doses = [
  { id: 'd1', courseId: 'k1', slot: 0, at: at('2031-05-12T08:00:00'), by: 'sam@example.com' },
  { id: 'd2', courseId: 'k1', slot: 1, at: at('2031-05-12T18:00:00'), by: 'alex@example.com' },
  { id: 'd3', courseId: 'k1', slot: 0, at: at('2031-05-13T08:00:00'), by: 'sam@example.com' },
  { id: 'd4', courseId: 'k1', slot: 0, at: at('2031-05-14T07:06:00'), by: 'alex@example.com' },
  { id: 'd5', courseId: 'other', slot: 0, at: at('2031-05-14T07:00:00'), by: 'alex@example.com' },
];

describe('days of a course', () => {
  test('day 3 of 7, ending on the 18th', () => {
    expect(courseDay(course, now)).toBe(3);
    expect(courseText(course, now)).toBe('Day 3 of 7');
    expect(lastDay(course)).toBe('2031-05-18');
    expect(courseState(course, now)).toBe('active');
  });

  test('before and after', () => {
    expect(courseText({ ...course, startDate: '2031-05-15' }, now)).toBe('Starts tomorrow');
    expect(courseText({ ...course, startDate: '2031-05-17' }, now)).toBe('Starts in 3 days');
    expect(courseState({ ...course, startDate: '2031-05-15' }, now)).toBe('upcoming');
    expect(courseState({ ...course, startDate: '2031-05-01' }, now)).toBe('finished');
    expect(courseText({ ...course, startDate: '2031-05-08' }, now)).toBe('Day 7 of 7');
    expect(courseText({ ...course, startDate: '2031-05-07' }, now)).toBe('Finished');
  });

  test('until a date, both days included', () => {
    expect(daysUntil('2031-05-12', '2031-05-18')).toBe(7);
    expect(daysUntil('2031-05-12', '2031-05-12')).toBe(1);
    expect(daysUntil('2031-05-12', '2031-05-11')).toBeNull();
  });
});

describe('today’s doses', () => {
  test('given, then due later today', () => {
    const today = todaysDoses(course, doses, now);
    expect(today.map((d) => d.status.state)).toEqual(['given', 'due']);
    expect(today[0].status).toMatchObject({ dose: { id: 'd4' } });
    expect(today[1].status.at).toBe(mealAt('19:00', now));
  });

  test('missed once its time has passed', () => {
    expect(todaysDoses(course, doses, at('2031-05-14T19:01:00'))[1].status.state).toBe('missed');
  });

  test('a finished course has no doses on the board', () => {
    expect(todaysDoses(course, doses, at('2031-05-19T08:00:00'))).toEqual([]);
  });

  test('un-ticking a slot removes only that slot today', () => {
    expect(givenTodayFor(doses, 'k1', 0, now).map((d) => d.id)).toEqual(['d4']);
    expect(givenTodayFor(doses, 'k1', 1, now)).toEqual([]);
  });

  test('doses given over the course', () => {
    expect(progress(course, doses)).toEqual({ given: 4, total: 14, daysComplete: 1, days: 7 });
  });
});

describe('earlier days of a course', () => {
  test('day by day from the start through today, each complete when every dose was given', () => {
    const h = courseHistory(course, doses, now);
    expect(h.map((d) => [d.day, d.n, d.complete])).toEqual([
      ['2031-05-12', 1, true],
      ['2031-05-13', 2, false],
      ['2031-05-14', 3, false],
    ]);
    expect(h[1].doses.map((d) => d.status.state)).toEqual(['given', 'missed']);
    expect(h[1].doses[1].status.at).toBe(at('2031-05-13T19:00:00'));
    expect(h[2].doses.map((d) => d.status.state)).toEqual(['given', 'due']);
  });

  test('a finished course stops at its last day; one not started has none', () => {
    expect(courseHistory(course, doses, at('2031-06-01T08:00:00'))).toHaveLength(7);
    expect(courseHistory({ ...course, startDate: '2031-05-20' }, doses, now)).toEqual([]);
  });

  test('a course added today that started yesterday: yesterday is all missed, ticking it in fills the day', () => {
    const k = { ...course, startDate: '2031-05-13', days: 3 };
    expect(progress(k, [])).toEqual({ given: 0, total: 6, daysComplete: 0, days: 3 });
    // Back-filled at the slots' own times on the 13th.
    const backfill = k.times.map((t, slot) => ({ id: `b${slot}`, courseId: 'k1', slot, at: slotAt(t, '2031-05-13'), by: 'sam@example.com' }));
    expect(backfill.map((d) => d.at)).toEqual([at('2031-05-13T09:00:00'), at('2031-05-13T19:00:00')]);
    expect(dosesOn(k, backfill, '2031-05-13', now).map((d) => d.status.state)).toEqual(['given', 'given']);
    expect(progress(k, backfill)).toEqual({ given: 2, total: 6, daysComplete: 1, days: 3 });
    expect(courseHistory(k, backfill, now).map((d) => d.complete)).toEqual([true, false]);
  });

  test('doses outside the course days or times do not count', () => {
    const stray = [
      { id: 's1', courseId: 'k1', slot: 0, at: at('2031-05-11T09:00:00'), by: 'x' },
      { id: 's2', courseId: 'k1', slot: 4, at: at('2031-05-12T09:00:00'), by: 'x' },
    ];
    expect(progress(course, stray).given).toBe(0);
    expect(dosesOn(course, doses, '2031-05-11', now)).toEqual([]);
  });

  test('un-ticking a slot on an earlier day removes only that day', () => {
    expect(givenOnFor(doses, 'k1', 0, '2031-05-13').map((d) => d.id)).toEqual(['d3']);
  });
});

describe('dose times', () => {
  test('twice a day follows the AM and PM meals', () => {
    expect(defaultTimes(2, ['19:00', '09:00'])).toEqual(['09:00', '19:00']);
    expect(defaultTimes(1, ['09:00', '19:00'])).toEqual(['09:00']);
  });

  test('otherwise spread from 8 to 8', () => {
    expect(defaultTimes(1, [])).toEqual(['08:00']);
    expect(defaultTimes(2, [])).toEqual(['08:00', '20:00']);
    expect(defaultTimes(3, ['09:00', '19:00'])).toEqual(['08:00', '14:00', '20:00']);
    expect(defaultTimes(9, [])).toHaveLength(6);
  });

  test('words', () => {
    expect([1, 2, 3].map(timesText)).toEqual(['Once a day', 'Twice a day', '3 times a day']);
    expect(slotMealName('09:00', [{ time: '09:00', name: 'AM' }])).toBe('AM');
    expect(slotMealName('13:00', [{ time: '09:00', name: 'AM' }])).toBeNull();
  });
});
