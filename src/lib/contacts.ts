import type { Contact } from '@huishouden/pwa-kit/contacts';

// The pets' people: which roles Pet knows about and how free-text roles map onto them. Grouping,
// saving and the dialog are the kit's (@huishouden/pwa-kit/contacts, /react/contacts).

export const APP = 'pet';

/** Roles offered as one-tap choices, in the order the Contacts tab shows them. */
export const ROLES = ['Vet', 'Emergency vet', 'Groomer', 'Boarding', 'Pet sitter', 'Trainer'] as const;
export type KnownRole = (typeof ROLES)[number];

// Order matters: "Emergency animal hospital" is an emergency vet before it is a vet.
const KEYWORDS: [KnownRole, RegExp][] = [
  ['Emergency vet', /\b(emergency|er|24[- ]?h(ou)?r?|after[- ]hours)\b/i],
  ['Vet', /\b(vets?|veterinar(y|ian|ians)|animal (hospital|clinic))\b/i],
  ['Groomer', /\bgroom(er|ers|ing)?\b/i],
  ['Boarding', /\b(board(ing)?|kennels?|pet (hotel|lodge|resort)|daycare)\b/i],
  ['Pet sitter', /\b((pet|dog|cat)[- ]?sitt(er|ing)|dog walk(er|ing)|walker)\b/i],
  ['Trainer', /\b(train(er|ing)|obedience|behaviou?rist)\b/i],
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
