import { describe, expect, test } from 'bun:test';
import { groupContacts, type Contact } from '@huishouden/pwa-kit/contacts';
import { ROLES, appointmentFromHome, appointmentPoint, contactForRole, knownRole } from './contacts';
import { DEMO_HOME, demoData } from './demo';

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
  const groups = groupContacts([c('1', 'B', 'Groomer'), c('2', 'A', 'vet'), c('3', 'C'), c('4', 'D', 'Farrier'), c('5', 'E', 'Emergency vet')], ROLES);
  expect(groups.map((g) => [g.role, g.contacts.map((x) => x.id)])).toEqual([
    ['Vet', ['2']],
    ['Emergency vet', ['5']],
    ['Groomer', ['1']],
    ['Farrier', ['4']],
    ['Other', ['3']],
  ]);
});

describe('how far an appointment is from home', () => {
  const home = DEMO_HOME;
  const vet = demoData().contacts.find((x) => x.role === 'Vet')!;
  const groomer = demoData().contacts.find((x) => x.role === 'Groomer')!;

  test('at the vet, by its address, its name or no location at all', () => {
    expect(appointmentFromHome('25 Example Street, Springfield', vet, { home, locale: 'en-US' })).toBe('2.3 mi from home');
    expect(appointmentFromHome('25 example street', vet, { home, locale: 'en-US' })).toBe('2.3 mi from home');
    expect(appointmentFromHome('Example Vet Clinic', vet, { home, locale: 'en-US' })).toBe('2.3 mi from home');
    expect(appointmentFromHome('Example Vet Clinic, room 2', vet, { home, locale: 'en-US' })).toBe('2.3 mi from home');
    expect(appointmentFromHome(undefined, vet, { home, locale: 'nl-NL' })).toBe('3,7 km from home');
  });

  test('nothing when it is somewhere else, the contact has no position, or there is no home', () => {
    expect(appointmentFromHome('Springfield Dog Park', vet, { home })).toBeUndefined();
    expect(appointmentFromHome('Example Vet Clinics United', vet, { home })).toBeUndefined();
    expect(appointmentFromHome(undefined, groomer, { home })).toBeUndefined();
    expect(appointmentFromHome(undefined, undefined, { home })).toBeUndefined();
    expect(appointmentFromHome(undefined, vet, { home: undefined })).toBeUndefined();
  });

  test('the point is the contact’s own position', () => {
    expect(appointmentPoint(undefined, vet)).toEqual({ lat: 39.7817, lng: -89.6066 });
  });
});
