import type { Contact, ContactInput } from '@huishouden/pwa-kit/contacts';

// The pets' people: which roles Pet knows about, how free-text roles map onto them, and how the
// Contacts tab groups them. Contacts themselves are the household's, shared by every app.

export const APP = 'pet';

/** Roles offered as one-tap choices, in the order the Contacts tab shows them. */
export const ROLES = ['Vet', 'Emergency vet', 'Groomer', 'Boarding', 'Pet sitter', 'Trainer'] as const;
export type KnownRole = (typeof ROLES)[number];

/** Limits from the household rules for contacts. */
export const CONTACT_LIMITS = { name: 120, role: 60, phone: 40, email: 120, website: 300, address: 300, notes: 1000 } as const;

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

export interface ContactGroup {
  role: string;
  contacts: Contact[];
}

/** Known roles first in their fixed order, then free-text roles A–Z, then contacts without a role as "Other". */
export function groupContacts(contacts: Contact[]): ContactGroup[] {
  const groups = new Map<string, Contact[]>();
  for (const c of [...contacts].sort((a, b) => a.name.localeCompare(b.name))) {
    const typed = c.role?.trim();
    const role = (typed && (ROLES.find((r) => r.toLowerCase() === typed.toLowerCase()) ?? typed)) || 'Other';
    groups.set(role, [...(groups.get(role) ?? []), c]);
  }
  const rank = (role: string) => {
    const i = (ROLES as readonly string[]).indexOf(role);
    if (i >= 0) return i;
    return role === 'Other' ? ROLES.length + 2 : ROLES.length + 1;
  };
  return [...groups.entries()]
    .map(([role, list]) => ({ role, contacts: list }))
    .sort((a, b) => rank(a.role) - rank(b.role) || a.role.localeCompare(b.role));
}

/** "example.com" → "https://example.com"; empty stays empty. */
export function normalizeWebsite(url: string | undefined): string | undefined {
  const t = url?.trim();
  if (!t) return undefined;
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

/** "https://www.example.com/pets/" → "example.com/pets", for showing a link compactly. */
export function displayWebsite(url: string): string {
  return url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');
}

/** What the dialog saves: trimmed to the rules' limits, the website made a full URL, and shown in Pet. */
export function contactInput(fields: Omit<ContactInput, 'apps'>, apps: string[]): ContactInput {
  const cut = (s: string | undefined, max: number) => s?.trim().slice(0, max) || undefined;
  return {
    name: fields.name.trim().slice(0, CONTACT_LIMITS.name),
    role: cut(fields.role, CONTACT_LIMITS.role),
    phone: cut(fields.phone, CONTACT_LIMITS.phone),
    email: cut(fields.email, CONTACT_LIMITS.email),
    website: cut(normalizeWebsite(fields.website), CONTACT_LIMITS.website),
    address: cut(fields.address, CONTACT_LIMITS.address),
    mapsUrl: fields.mapsUrl?.trim() || undefined,
    notes: cut(fields.notes, CONTACT_LIMITS.notes),
    apps: apps.includes(APP) ? apps : [...apps, APP],
  };
}
