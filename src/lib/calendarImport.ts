import type { CalendarMatch } from '@huishouden/pwa-kit/calendar';
import type { Appointment, AppointmentKind, Pet } from './model';
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

/** Calendar descriptions often arrive as HTML; notes are plain text within the rules' limit. */
export function plainText(description: string, max: number = LIMITS.notes): string {
  const text = description
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

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
  const notes = plainText(m.description ?? '');
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

const sameTitle = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Whether an appointment already stands for this calendar event. */
export function isImported(m: CalendarMatch, appointments: Appointment[]): boolean {
  return appointments.some(
    (a) => (a.calendarEventId && a.calendarEventId === m.id) || (a.calendarLink && a.calendarLink === m.link) || (a.at === m.start && sameTitle(a.title, m.title)),
  );
}

/** Calendar events not yet in Pet, each once, soonest first. */
export function notImported(matches: CalendarMatch[], appointments: Appointment[]): CalendarMatch[] {
  const seen = new Set<string>();
  return matches
    .filter((m) => {
      if (seen.has(m.id) || isImported(m, appointments)) return false;
      seen.add(m.id);
      return true;
    })
    .sort((a, b) => a.start - b.start);
}

/** A readable reason for a failed calendar search; every case offers Try again. */
export function calendarError(e: unknown): string {
  const code = (e as { code?: string })?.code;
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request' || code === 'auth/user-cancelled')
    return 'Calendar access was not allowed. Try again when you are ready.';
  if (code === 'auth/popup-blocked') return 'The browser blocked the Google window. Allow pop-ups for this site and try again.';
  return "Couldn't search your calendar. Check the connection and try again.";
}
