import { describe, expect, test } from 'bun:test';
import fixture from './__fixtures__/feeding.json';
import { dailyCounts, defaultMeals, fedTodayFor, formatAgo, formatDuration, isMealTime, lastFed, mealAt, mealsOn, recentFeedings, todaysMeals } from './feeding';
import { HOUR, MINUTE } from '@huishouden/pwa-kit/time';

const now = new Date(fixture.now).getTime();
const meals = fixture.meals;
const feedings = fixture.feedings.map((f) => ({ ...f, at: new Date(f.at).getTime() }));

describe('today’s board', () => {
  test('a fed meal shows its latest feed; a passed one is late; a coming one is due', () => {
    const p1 = todaysMeals(meals, feedings, 'p1', now);
    expect(p1.map((x) => x.meal.name)).toEqual(['AM', 'PM']);
    expect(p1[0].status).toMatchObject({ state: 'fed', feeding: { id: 'f2' } });
    expect(p1[1].status).toEqual({ state: 'due', at: mealAt('19:00', now) });
    const p2 = todaysMeals(meals, feedings, 'p2', now);
    expect(p2.map((x) => x.status.state)).toEqual(['late', 'due']);
  });

  test('the board starts empty the next day', () => {
    const tomorrow = new Date('2031-05-15T08:00:00').getTime();
    expect(todaysMeals(meals, feedings, 'p1', tomorrow).map((x) => x.status.state)).toEqual(['due', 'due']);
  });

  test('exactly at the cut-off is not late yet', () => {
    expect(todaysMeals(meals, [], 'p2', mealAt('09:00', now))[0].status.state).toBe('due');
    expect(todaysMeals(meals, [], 'p2', mealAt('09:00', now) + 1)[0].status.state).toBe('late');
  });

  test('un-ticking removes every feed for that meal today, nothing else', () => {
    expect(fedTodayFor(feedings, 'p1-am', now).map((f) => f.id)).toEqual(['f1', 'f2']);
    expect(fedTodayFor(feedings, 'p1-pm', now)).toEqual([]);
  });

  test("yesterday's board: every unfed meal is late, and a feed logged at the meal's time ticks it", () => {
    const tomorrow = new Date('2031-05-15T08:00:00').getTime();
    const yesterday = now; // the 14th, seen from the 15th
    const before = mealsOn(meals, feedings, 'p1', yesterday, tomorrow);
    expect(before.map((x) => x.status.state)).toEqual(['fed', 'late']);
    const backfill = { id: 'b1', petId: 'p1', mealId: 'p1-pm', at: mealAt('19:00', yesterday), by: 'sam@example.com' };
    expect(backfill.at).toBe(new Date('2031-05-14T19:00:00').getTime());
    expect(mealsOn(meals, [...feedings, backfill], 'p1', yesterday, tomorrow)[1].status).toMatchObject({ state: 'fed', feeding: { id: 'b1' } });
    expect(fedTodayFor([...feedings, backfill], 'p1-pm', yesterday).map((f) => f.id)).toEqual(['b1']);
    expect(todaysMeals(meals, [...feedings, backfill], 'p1', tomorrow).map((x) => x.status.state)).toEqual(['due', 'due']);
  });

  test('every pet starts with AM by 9:00 and PM by 19:00', () => {
    expect(defaultMeals('p9')).toEqual([
      { id: 'p9-am', petId: 'p9', name: 'AM', time: '09:00' },
      { id: 'p9-pm', petId: 'p9', name: 'PM', time: '19:00' },
    ]);
  });

  test('meal times are 24-hour HH:MM', () => {
    expect(['00:00', '07:30', '23:59'].every(isMealTime)).toBe(true);
    expect(['24:00', '7:30', '07:60', '', 730].some(isMealTime)).toBe(false);
  });
});

describe('time since', () => {
  test('last fed, any meal or extra', () => {
    expect(lastFed(feedings, 'p1', now)?.id).toBe('f2');
    expect(lastFed(feedings, 'p2', now)?.id).toBe('f4');
    expect(lastFed(feedings, 'p3', now)).toBeNull();
    expect(formatAgo(lastFed(feedings, 'p2', now)!.at, now)).toBe('15h 50m ago');
  });

  test('durations', () => {
    expect(formatDuration(35 * MINUTE)).toBe('35m');
    expect(formatDuration(2 * HOUR + 10 * MINUTE + 59_000)).toBe('2h 10m');
    expect(formatDuration(27 * HOUR)).toBe('1d 3h');
    expect(formatAgo(now - 30_000, now)).toBe('just now');
  });
});

describe('history', () => {
  test('feeds per day for two weeks, oldest first, today last', () => {
    const days = dailyCounts(feedings, 'p2', now, 14);
    expect(days).toHaveLength(14);
    expect(days[0].day).toBe('2031-05-01');
    expect(days.at(-1)).toEqual({ day: '2031-05-14', count: 0 });
    expect(days.find((d) => d.day === '2031-05-13')?.count).toBe(1);
    expect(days.find((d) => d.day === '2031-05-12')?.count).toBe(1);
    expect(days.reduce((n, d) => n + d.count, 0)).toBe(2);
  });

  test('recent feeds newest first, inside the window', () => {
    expect(recentFeedings(feedings, 'p2', now, 14).map((f) => f.id)).toEqual(['f4', 'f5']);
  });
});
