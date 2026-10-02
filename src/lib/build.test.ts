import { expect, test } from 'bun:test';
import { petDoc, petInputOf } from './build';

const base = { name: ' Biscuit ', species: 'dog' as const, weightUnit: 'lb' as const };

test('a target weight is kept with its note; an invalid one is dropped with it', () => {
  expect(petDoc({ ...base, targetWeight: 24.456, targetNote: " Vet's goal " }, 'sam@example.com', 1)).toMatchObject({ name: 'Biscuit', targetWeight: 24.46, targetNote: "Vet's goal" });
  for (const targetWeight of [0, -2, 1000, Number.NaN, undefined]) {
    const doc = petDoc({ ...base, targetWeight, targetNote: 'x' }, 'sam@example.com', 1);
    expect('targetWeight' in doc || 'targetNote' in doc).toBe(false);
  }
  expect(petDoc({ ...base, targetWeight: 24, targetNote: 'x'.repeat(300) }, 'sam@example.com', 1).targetNote).toHaveLength(200);
});

test('editing starts from the stored pet, target included', () => {
  const doc = petDoc({ ...base, birthDate: '2027-03-08', targetWeight: 24 }, 'sam@example.com', 1);
  expect(petInputOf(doc)).toMatchObject({ name: 'Biscuit', birthDate: '2027-03-08', targetWeight: 24 });
});

test('an approximate birth date is flagged only alongside a date', () => {
  const base = { name: 'Rex', species: 'dog' as const, weightUnit: 'lb' as const };
  expect(petDoc({ ...base, birthDate: '2025-05-14', birthDateApprox: true }, 'sam@example.com', 1)).toMatchObject({ birthDate: '2025-05-14', birthDateApprox: true });
  expect(petDoc({ ...base, birthDateApprox: true }, 'sam@example.com', 1)).not.toHaveProperty('birthDateApprox');
  expect(petDoc({ ...base, birthDate: '2025-05-14', birthDateApprox: false }, 'sam@example.com', 1)).not.toHaveProperty('birthDateApprox');
  expect(petInputOf(petDoc({ ...base, birthDate: '2025-05-14', birthDateApprox: true }, 'sam@example.com', 1)).birthDateApprox).toBe(true);
});

import { appointmentDoc, courseDoc } from './build';
import { FIELDS } from './model';

test('appointments always carry the private flag, so helpers see the open ones', () => {
  const a = { petIds: ['p1'], kind: 'vet' as const, title: 'Checkup', at: 1 };
  expect(appointmentDoc(a, 'sam@example.com', 1).private).toBe(false);
  expect(appointmentDoc({ ...a, private: true }, 'sam@example.com', 1).private).toBe(true);
  for (const k of Object.keys(appointmentDoc(a, 'sam@example.com', 1))) expect(FIELDS.petAppointments as readonly string[]).toContain(k);
});

test('a course says who can give it: every helper unless restricted to approved ones', () => {
  const c = { petId: 'p1', name: 'Antibiotic', dose: '1 tablet', timesPerDay: 1, times: ['09:00'], startDate: '2031-05-12', days: 7, withFood: true };
  expect(courseDoc(c, 'sam@example.com', 1).givers).toBe('all');
  expect(courseDoc(c, 'sam@example.com', 1).approvedHelpers).toBeUndefined();
  const restricted = courseDoc({ ...c, givers: 'approved', approvedHelpers: ['Jo@Example.com'] }, 'sam@example.com', 1);
  expect(restricted).toMatchObject({ givers: 'approved', approvedHelpers: ['jo@example.com'] });
  for (const k of Object.keys(restricted)) expect(FIELDS.petMedCourses as readonly string[]).toContain(k);
});
