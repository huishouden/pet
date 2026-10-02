import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { parseDirections, toMedCourse } from '@huishouden/pwa-kit/dose';
import { courseDoc } from './build';
import { FIELDS } from './model';

// An invented vet label, as the on-device reader returns its text.
const label = readFileSync(new URL('./__fixtures__/label.txt', import.meta.url), 'utf8');

test('a parsed label becomes a course the rules accept, on the pet’s AM and PM times', () => {
  const parsed = parseDirections(label);
  expect(parsed.unparsed).toEqual(['zq7 smudge']);
  const draft = toMedCourse(parsed, { startDate: '2031-05-14', defaultTimes: { morning: '09:00', evening: '19:00' } });
  const doc = courseDoc({ ...draft, petId: 'p1', days: draft.days ?? 7, withFood: draft.withFood ?? false }, 'sam@example.com', 1);
  expect(doc).toMatchObject({ name: 'Amoxicillin 50 mg', dose: '1 tablet', timesPerDay: 2, times: ['09:00', '19:00'], days: 10, withFood: true, notes: 'Finish all medication' });
  for (const k of Object.keys(doc)) expect(FIELDS.petMedCourses as readonly string[]).toContain(k);
});
