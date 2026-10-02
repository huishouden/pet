// Pets' birthdays: finding them in the household's Google Calendar, saying when the next one is,
// and the yearly notification. Pure: every function takes `now`.

import type { CalendarMatch } from '@huishouden/pwa-kit/calendar';
import type { ReminderInput } from '@huishouden/pwa-kit/reminders';
import { MONTHS, addDays, daysBetween, daysInMonth, toYmd, ymd, ymdParts, type Ymd } from '@huishouden/pwa-kit/time';

/** The searches for one pet's birthday: "Biscuit birthday", "Biscuit's birthday", "Biscuit bday". */
export function birthdayQueries(name: string): string[] {
  const n = name.trim().toLowerCase();
  return n ? [`${n} birthday`, `${n}'s birthday`, `${n} bday`] : [];
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Whether an event's title is this pet's birthday: the name and "birthday", "bday" or "b-day", in either order. */
export function isBirthdayOf(title: string, name: string): boolean {
  const n = name.trim();
  if (!n) return false;
  const pet = new RegExp(`(^|[^\\p{L}])${escapeRegExp(n)}(['’]s)?($|[^\\p{L}])`, 'iu');
  return pet.test(title) && /\b(birthday|bday|b-day)\b/i.test(title);
}

export interface BirthdayGuess {
  month: number;
  day: number;
  /** The birth year, when the calendar tells it. */
  year?: number;
  /** The full date, when the year is known. */
  date?: Ymd;
  /** How the year was found. */
  from: 'age' | 'year' | 'series' | null;
}

/** An age in the title: "turns 5", "5th birthday", "5 years old". */
function ageInTitle(title: string): number | null {
  const m = /\bturns\s+(\d{1,2})\b/i.exec(title) ?? /\b(\d{1,2})(?:st|nd|rd|th)\s+(?:birthday|bday|b-day)\b/i.exec(title) ?? /\b(\d{1,2})\s+(?:years?|yrs?)\s+old\b/i.exec(title);
  return m ? Number(m[1]) : null;
}

/**
 * The birthday a calendar event says: its month and day, and the birth year when the title gives
 * an age ("turns 5") or a year ("born 2027"), or when a yearly series began on that same day in an
 * earlier year (a birthday entered on the day itself). A year that would put the birth after
 * `now` is dropped.
 */
export function birthdayFromMatch(m: Pick<CalendarMatch, 'title' | 'start' | 'seriesStart'>, now: number): BirthdayGuess {
  const occurrence = ymdParts(toYmd(m.start))!;
  const { m: month, d: day } = occurrence;
  let year: number | undefined;
  let from: BirthdayGuess['from'] = null;
  const age = ageInTitle(m.title);
  const written = /\b(19[89]\d|20\d\d)\b/.exec(m.title);
  if (age !== null) [year, from] = [occurrence.y - age, 'age'];
  else if (written) [year, from] = [Number(written[1]), 'year'];
  else if (m.seriesStart !== undefined) {
    const series = ymdParts(toYmd(m.seriesStart))!;
    if (series.m === month && series.d === day && series.y < occurrence.y) [year, from] = [series.y, 'series'];
  }
  if (year !== undefined) {
    const date = ymd(year, month, Math.min(day, daysInMonth(year, month)));
    if (daysBetween(date, toYmd(now)) >= 0) return { month, day, year, date, from };
  }
  return { month, day, from: null };
}

/** "March 8, 2027", or "March 8" when the year isn't known. */
export function guessWords(g: Pick<BirthdayGuess, 'month' | 'day' | 'year'>): string {
  return `${MONTHS[g.month - 1]} ${g.day}${g.year ? `, ${g.year}` : ''}`;
}

/** This pet's birthday this year or next: the day (29 February falls on the 28th in other years) and the age it brings. */
export function nextBirthday(birthDate: string, now: number): { date: Ymd; turns: number; days: number } | null {
  const born = ymdParts(birthDate);
  if (!born) return null;
  const today = toYmd(now);
  const t = ymdParts(today)!;
  const on = (y: number) => ymd(y, born.m, Math.min(born.d, daysInMonth(y, born.m)));
  let year = t.y;
  if (daysBetween(today, on(year)) < 0) year++;
  const date = on(year);
  if (year <= born.y) return null;
  return { date, turns: year - born.y, days: daysBetween(today, date) };
}

/** "Birthday today" on the day, "Turns 6 on March 14" otherwise; null without a birth date. */
export function birthdayText(birthDate: string | undefined, now: number): string | null {
  const next = birthDate ? nextBirthday(birthDate, now) : null;
  if (!next) return null;
  if (next.days === 0) return 'Birthday today';
  const p = ymdParts(next.date)!;
  return `Turns ${next.turns} on ${MONTHS[p.m - 1]} ${p.d}`;
}

/** The hour of the morning the birthday notification arrives. */
export const BIRTHDAY_HOUR = 9;

/**
 * The next birthday notification: 9:00 on the day (today's, until 9:00 has passed). Re-written when
 * the app opens, so each year brings the next one.
 */
export function birthdayReminder(pet: { id: string; name: string; birthDate?: string }, now: number, app: { app: string; url: string; ref: string }): ReminderInput | null {
  if (!pet.birthDate) return null;
  let next = nextBirthday(pet.birthDate, now);
  if (!next) return null;
  const at = (date: Ymd) => {
    const p = ymdParts(date)!;
    return new Date(p.y, p.m - 1, p.d, BIRTHDAY_HOUR).getTime();
  };
  if (at(next.date) <= now) next = nextBirthday(pet.birthDate, addDays(now, 1));
  if (!next) return null;
  return {
    app: app.app,
    title: `${pet.name}'s birthday`,
    body: `${pet.name} turns ${next.turns} today.`,
    at: at(next.date),
    url: app.url,
    ref: app.ref,
  };
}
