/** A short name for whoever logged something: "You", their first name, or the address's first word. */
export function personName(email: string, me?: { email?: string | null; displayName?: string | null } | null): string {
  if (me?.email && email.toLowerCase() === me.email.toLowerCase()) return 'You';
  const local = email.split('@')[0] ?? email;
  const word = local.split(/[^a-zA-Z]+/).find(Boolean) ?? local;
  return word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : '?';
}

export function personInitial(email: string, me?: { email?: string | null; displayName?: string | null } | null): string {
  if (me?.email && email.toLowerCase() === me.email.toLowerCase() && me.displayName) return me.displayName.trim().charAt(0).toUpperCase();
  return personName(email).charAt(0);
}

/** Palette colours that keep white initials above 4.5:1; each member keeps one colour. */
export const PERSON_COLOURS = ['#2d6a4f', '#94452f', '#44403c', '#1b4332'];

export function personColour(email: string, members: string[]): string {
  const i = members.indexOf(email.toLowerCase());
  if (i >= 0) return PERSON_COLOURS[i % PERSON_COLOURS.length];
  let h = 0;
  for (const c of email) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PERSON_COLOURS[h % PERSON_COLOURS.length];
}
