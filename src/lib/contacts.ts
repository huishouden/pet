import { coordinates, type Contact } from '@huishouden/pwa-kit/contact-core';
import { formatFromHome, type HouseholdHome } from '@huishouden/pwa-kit/home';
import { t } from '../i18n';

// The pets' people: which roles Pet knows about and how free-text roles map onto them. Grouping,
// saving and the dialog are the kit's (@huishouden/pwa-kit/contacts, /react/contacts).

export const APP = 'pet';

/** Roles offered as one-tap choices, in the order the Contacts tab shows them. Stored in English, shown with `roleLabel`. */
export const ROLES = ['Vet', 'Emergency vet', 'Groomer', 'Boarding', 'Pet sitter', 'Trainer'] as const;
export type KnownRole = (typeof ROLES)[number];

const ROLE_KEYS = {
  Vet: 'role.vet',
  'Emergency vet': 'role.emergencyVet',
  Groomer: 'role.groomer',
  Boarding: 'role.boarding',
  'Pet sitter': 'role.petSitter',
  Trainer: 'role.trainer',
} as const satisfies Record<KnownRole, string>;

/** A role in the active language: one of `ROLES` (matched ignoring case) translated, any other as typed. */
export function roleLabel(role: string): string {
  const known = ROLES.find((r) => r.toLowerCase() === role.trim().toLowerCase());
  return known ? t(ROLE_KEYS[known]) : role;
}

// Order matters: "Emergency animal hospital" is an emergency vet before it is a vet. English,
// Spanish and Dutch: roles are typed and imported in the household's own words.
const KEYWORDS: [KnownRole, RegExp][] = [
  ['Emergency vet', /\b(emergency|er|24[- ]?h(ou)?r?|after[- ]hours|urgencias?|emergencias?|24 horas|spoed\w*|dierenambulance)\b/i],
  ['Vet', /\b(vets?|veterinar(y|ian|ians)|animal (hospital|clinic)|veterinari[oa]s?|cl[ií]nica veterinaria|dierenarts\w*|dierenkliniek)\b/i],
  ['Groomer', /\b(groom(er|ers|ing)?|peluquer[ií]a (canina|de mascotas)|est[ée]tica canina|trimsalon|trimmer|hondentrimmer)\b/i],
  ['Boarding', /\b(board(ing)?|kennels?|pet (hotel|lodge|resort)|daycare|hotel (canino|para mascotas)|guarder[ií]a|residencia canina|dierenpension|hondenpension|kattenpension|pension)\b/i],
  ['Pet sitter', /\b((pet|dog|cat)[- ]?sitt(er|ing)|dog walk(er|ing)|walker|cuidador(a)?|paseador(a)?( de perros)?|oppas|dierenoppas|uitlaatservice|hondenuitlaatservice)\b/i],
  ['Trainer', /\b(train(er|ing)|obedience|behaviou?rist|adiestrador(a)?|entrenador(a)?|educador(a)? canin[oa]|hondenschool|gedragstherapeut|puppycursus)\b/i],
];

/** The known role a piece of text is about ("Our vet" → "Vet"), or null. */
export function knownRole(text: string | undefined): KnownRole | null {
  if (!text) return null;
  for (const [role, re] of KEYWORDS) if (re.test(text)) return role;
  return null;
}

/** The first contact (by name) with the given role, free-text roles included. */
export function contactForRole(contacts: Contact[], role: KnownRole): Contact | undefined {
  return [...contacts]
    .sort((a, b) => a.name.localeCompare(b.name))
    .find((c) => c.role?.trim().toLowerCase() === role.toLowerCase() || knownRole(c.role) === role);
}

const plain = (text: string | undefined) => (text ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/**
 * Where an appointment is, when that is its contact's place: no other location, the contact's
 * address (the dialog copies it in, cut to the field's length), or its name ("City Hospital, level
 * 2"). Undefined when the contact has no position or the appointment is somewhere else.
 */
export function appointmentPoint(location: string | undefined, contact: Contact | undefined): { lat: number; lng: number } | undefined {
  const point = coordinates(contact);
  if (!contact || !point) return undefined;
  const where = plain(location);
  if (!where) return point;
  const address = plain(contact.address);
  const name = plain(contact.name);
  const atAddress = !!address && (address.startsWith(where) || where.includes(address));
  const atName = !!name && (where === name || where.startsWith(`${name} `));
  return atAddress || atName ? point : undefined;
}

/** "2.3 mi from home" for an appointment at its contact's place, when the household has a home. */
export function appointmentFromHome(location: string | undefined, contact: Contact | undefined, { home, locale }: { home: HouseholdHome | undefined; locale?: string }): string | undefined {
  return formatFromHome(appointmentPoint(location, contact), { home, locale });
}
