import { describe, expect, test } from 'bun:test';
import { addDays, age, calendarDaysBetween, fromLocalInput, isYmd, parseYmd, relativeDay, toLocalInput, toYmd } from './time';

const now = new Date('2031-05-14T10:30:00').getTime();

describe('dates', () => {
  test('YYYY-MM-DD round trip in local time, refusing impossible days', () => {
    expect(toYmd(parseYmd('2031-03-05')!)).toBe('2031-03-05');
    expect(parseYmd('2031-3-5')).toBeNull();
    expect(parseYmd('2031-02-30')).toBeNull();
    expect(parseYmd(undefined)).toBeNull();
    expect(isYmd('2032-02-29')).toBe(true);
    expect(isYmd('2031-02-29')).toBe(false);
    expect(isYmd(20310229)).toBe(false);
  });

  test('day arithmetic', () => {
    expect(toYmd(addDays(now, 1))).toBe('2031-05-15');
    expect(new Date(addDays(now, -1)).getHours()).toBe(0);
    expect(calendarDaysBetween(now, parseYmd('2031-05-12')!)).toBe(-2);
  });

  test('relative days', () => {
    expect(relativeDay(now, now)).toBe('Today');
    expect(relativeDay(addDays(now, 1), now)).toBe('Tomorrow');
    expect(relativeDay(addDays(now, -1), now)).toBe('Yesterday');
    expect(relativeDay(addDays(now, 6), now)).toBe('In 6 days');
    expect(relativeDay(addDays(now, -12), now)).toBe('12 days ago');
  });

  test('datetime-local inputs', () => {
    expect(toLocalInput(now)).toBe('2031-05-14T10:30');
    expect(fromLocalInput('2031-05-14T10:30')).toBe(now);
    expect(fromLocalInput('')).toBeNull();
  });
});

test('ages', () => {
  expect(age('2027-03-08', now)).toBe('4 years');
  expect(age('2029-09-20', now)).toBe('19 months');
  expect(age('2031-04-01', now)).toBe('6 weeks');
  expect(age('2031-05-10', now)).toBe('4 days');
  expect(age('2031-05-14', now)).toBe('Born today');
  expect(age('2031-06-01', now)).toBeNull();
  expect(age(undefined, now)).toBeNull();
});
