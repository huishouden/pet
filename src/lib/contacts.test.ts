import { describe, expect, test } from 'bun:test';
import type { Contact } from '@huishouden/pwa-kit/contacts';
import { contactForRole, contactInput, displayWebsite, groupContacts, knownRole, normalizeWebsite } from './contacts';

const c = (id: string, name: string, role?: string): Contact => ({ id, name, role, apps: ['pet'], createdAt: 1, by: 'sam@example.com' });

describe('roles', () => {
  test('free text maps to known roles', () => {
    expect(knownRole('Our vet')).toBe('Vet');
    expect(knownRole('Veterinarian')).toBe('Vet');
    expect(knownRole('Emergency animal hospital')).toBe('Emergency vet');
    expect(knownRole('24 hour vet')).toBe('Emergency vet');
    expect(knownRole('Dog groomer')).toBe('Groomer');
    expect(knownRole('Kennel')).toBe('Boarding');
    expect(knownRole('Dog walker')).toBe('Pet sitter');
    expect(knownRole('Obedience classes')).toBe('Trainer');
    expect(knownRole('Plumber')).toBeNull();
    expect(knownRole(undefined)).toBeNull();
  });

  test('the contact for a role, typed roles included', () => {
    const list = [c('2', 'Zed Animal Clinic', 'veterinarian'), c('1', 'Example Vet Clinic', 'Vet'), c('3', 'Example Grooming', 'Groomer')];
    expect(contactForRole(list, 'Vet')?.id).toBe('1');
    expect(contactForRole(list, 'Boarding')).toBeUndefined();
  });
});

test('groups: known roles in order, then typed roles, then Other', () => {
  const groups = groupContacts([c('1', 'B', 'Groomer'), c('2', 'A', 'vet'), c('3', 'C'), c('4', 'D', 'Farrier'), c('5', 'E', 'Emergency vet')]);
  expect(groups.map((g) => [g.role, g.contacts.map((x) => x.id)])).toEqual([
    ['Vet', ['2']],
    ['Emergency vet', ['5']],
    ['Groomer', ['1']],
    ['Farrier', ['4']],
    ['Other', ['3']],
  ]);
});

test('websites', () => {
  expect(normalizeWebsite('vet.example.com')).toBe('https://vet.example.com');
  expect(normalizeWebsite(' ')).toBeUndefined();
  expect(displayWebsite('https://www.vet.example.com/pets/')).toBe('vet.example.com/pets');
});

test('saved contacts are trimmed and shown in Pet, keeping other apps', () => {
  const input = contactInput({ name: '  Example Vet Clinic ', role: 'Vet', phone: ' ', website: 'vet.example.com', notes: 'x'.repeat(2000) }, ['baby']);
  expect(input.name).toBe('Example Vet Clinic');
  expect(input.phone).toBeUndefined();
  expect(input.website).toBe('https://vet.example.com');
  expect(input.notes!.length).toBe(1000);
  expect(input.apps).toEqual(['baby', 'pet']);
});
