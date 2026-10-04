import type { Contact } from '@huishouden/pwa-kit/contacts';
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
