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
