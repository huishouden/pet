import { expect, test } from 'bun:test';
import { age } from './time';

// The shared time helpers are tested in @huishouden/pwa-kit; this is Pet's own phrase.
const now = new Date('2031-05-14T10:30:00').getTime();

test('ages', () => {
  expect(age('2027-03-08', now)).toBe('4 years');
  expect(age('2029-09-20', now)).toBe('19 months');
  expect(age('2031-04-01', now)).toBe('6 weeks');
  expect(age('2031-05-10', now)).toBe('4 days');
  expect(age('2031-05-14', now)).toBe('Born today');
  expect(age('2031-06-01', now)).toBeNull();
  expect(age(undefined, now)).toBeNull();
});

test('approximate ages say nothing finer than the age entered', () => {
  expect(age('2025-05-14', now, true)).toBe('About 6 years');
  expect(age('2025-03-01', now, true)).toBe('About 6 years');
  expect(age('2030-05-14', now, true)).toBe('About 1 year');
  expect(age('2029-11-14', now, true)).toBe('About 1 year');
  expect(age('2031-01-14', now, true)).toBe('About 4 months');
  expect(age('2031-04-14', now, true)).toBe('About 1 month');
  expect(age('2031-05-01', now, true)).toBe('Under a month');
});
