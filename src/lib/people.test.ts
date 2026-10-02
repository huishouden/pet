import { expect, test } from 'bun:test';
import { PERSON_COLOURS, personColour, personInitial, personName } from './people';

test('names from addresses', () => {
  expect(personName('pat.lee@example.com')).toBe('Pat');
  expect(personName('JORDAN99@example.com')).toBe('Jordan');
  expect(personName('pat@example.com', { email: 'Pat@example.com' })).toBe('You');
  expect(personInitial('pat@example.com', { email: 'pat@example.com', displayName: 'Robin Doe' })).toBe('R');
});

test('colours follow member order', () => {
  const members = ['pat@example.com', 'lee@example.com'];
  expect(personColour('lee@example.com', members)).toBe(PERSON_COLOURS[1]);
  expect(PERSON_COLOURS).toContain(personColour('someone@example.com', members));
});
