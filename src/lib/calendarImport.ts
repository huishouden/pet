import { plainText, type CalendarMatch } from '@huishouden/pwa-kit/calendar';
import type { AppointmentKind, Pet } from './model';
import { LIMITS } from './model';

/** What Import from calendar looks for: the words pet events tend to carry. */
export const PET_CALENDAR_QUERIES = [
  'vet',
  'veterinary',
  'veterinarian',
  'animal hospital',
  'groomer',
  'grooming',
  'vaccine',
  'vaccination',
  'boarding',
  'kennel',
  'pet sitter',
];

/** The kind of visit a title or place describes; "other" when it says nothing recognisable. */
export function guessKind(text: string): AppointmentKind {
  if (/\b(groom(er|ing)?|bath|nail trim)\b/i.test(text)) return 'grooming';
  if (/\b(board(ing)?|kennels?|pet (hotel|lodge|resort)|pet sitt(er|ing))\b/i.test(text)) return 'boarding';
  if (/\b(vets?|veterinar(y|ian)|animal hospital|vaccin(e|es|ation)|check[- ]?up|dental|rabies|booster|spay|neuter)\b/i.test(text)) return 'vet';
  return 'other';
}

/** Pets named in the text ("Biscuit's grooming" → Biscuit); every pet when there is only one. */
export function guessPets(text: string, pets: Pick<Pet, 'id' | 'name'>[]): string[] {
  const named = pets.filter((p) => new RegExp(`\\b${escapeRegExp(p.name.trim())}\\b`, 'i').test(text)).map((p) => p.id);
  if (named.length) return named;
  return pets.length === 1 ? [pets[0].id] : [];
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export interface CalendarFill {
  title: string;
  at: number;
  kind: AppointmentKind;
  petIds: string[];
  location?: string;
  notes?: string;
  calendarEventId: string;
  calendarLink: string;
}

/** The appointment fields a calendar event fills in, with the kind and pets guessed from its words. */
export function fromCalendar(m: CalendarMatch, pets: Pick<Pet, 'id' | 'name'>[]): CalendarFill {
  const notes = plainText(m.description ?? '', LIMITS.notes);
  const location = m.location?.trim().slice(0, LIMITS.location);
  return {
    title: m.title.trim().slice(0, LIMITS.title),
    at: m.start,
    kind: guessKind(`${m.title} ${m.location ?? ''}`),
    petIds: guessPets(`${m.title} ${notes}`, pets),
    ...(location ? { location } : {}),
    ...(notes ? { notes } : {}),
    calendarEventId: m.id,
    calendarLink: m.link,
  };
}
