// Pets' birthdays: finding them in the household's Google Calendar, saying when the next one is,
// and the yearly notification. Pure: every function takes `now`.

import type { CalendarMatch } from '@huishouden/pwa-kit/calendar';
import type { ReminderInput } from '@huishouden/pwa-kit/reminders';
import { MONTHS, addDays, addMonths, daysBetween, daysInMonth, inDays, toYmd, ymd, ymdParts, type Ymd } from '@huishouden/pwa-kit/time';

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
  /** The birth year, when the event's title tells it. */
  year?: number;
  /** The full date, when the year is known. */
  date?: Ymd;
  /**
   * The year a yearly series began, offered as a hint only: it is usually when someone added the
   * event, not when the pet was born.
   */
  suggestedYear?: number;
  /** How the year was found. */
  from: 'age' | 'year' | null;
}

/** An age in the title: "turns 5", "5th birthday", "5 years old". */
function ageInTitle(title: string): number | null {
  const m = /\bturns\s+(\d{1,2})\b/i.exec(title) ?? /\b(\d{1,2})(?:st|nd|rd|th)\s+(?:birthday|bday|b-day)\b/i.exec(title) ?? /\b(\d{1,2})\s+(?:years?|yrs?)\s+old\b/i.exec(title);
  return m ? Number(m[1]) : null;
}

/** The birthday in year `y` (29 February falls on the 28th in other years). */
const birthdayIn = (y: number, month: number, day: number) => ymd(y, month, Math.min(day, daysInMonth(y, month)));

/**
 * The birthday a calendar event says: its month and day, and the birth year only when the title
 * gives an age ("turns 5") or a year ("born 2027"). A yearly series that began in an earlier year
 * gives `suggestedYear`, never a date. A year that would put the birth after `now` is dropped.
 */
export function birthdayFromMatch(m: Pick<CalendarMatch, 'title' | 'start' | 'seriesStart'>, now: number): BirthdayGuess {
  const occurrence = ymdParts(toYmd(m.start))!;
  const { m: month, d: day } = occurrence;
  const today = toYmd(now);
  let year: number | undefined;
  let from: BirthdayGuess['from'] = null;
  const age = ageInTitle(m.title);
  const written = /\b(19[89]\d|20\d\d)\b/.exec(m.title);
  if (age !== null) [year, from] = [occurrence.y - age, 'age'];
  else if (written) [year, from] = [Number(written[1]), 'year'];
  if (year !== undefined) {
    const date = birthdayIn(year, month, day);
    if (daysBetween(date, today) >= 0) return { month, day, year, date, from };
  }
  if (m.seriesStart !== undefined) {
    const series = ymdParts(toYmd(m.seriesStart))!;
    if (series.m === month && series.d === day && series.y < occurrence.y && daysBetween(birthdayIn(series.y, month, day), today) >= 0) {
      return { month, day, suggestedYear: series.y, from: null };
    }
  }
  return { month, day, from: null };
}

/** The oldest age the "Age or year born" field takes. */
export const MAX_AGE = 60;

/**
 * What "Age or year born" means for a birthday on `month`/`day`: "6" is an age (born in the year
 * that makes the pet 6 today, depending on whether this year's birthday has passed), "2019" is the
 * year. Null for anything else, or a date after `now`.
 */
export function birthDateFromAgeOrYear(text: string, month: number, day: number, now: number): Ymd | null {
  const t = text.trim().toLowerCase();
  const today = toYmd(now);
  const thisYear = ymdParts(today)!.y;
  let year: number;
  const yearMatch = /^(\d{4})$/.exec(t);
  const ageMatch = /^(\d{1,2})(?:\s*(?:years?|yrs?)(?:\s+old)?)?$/.exec(t);
  if (yearMatch) year = Number(yearMatch[1]);
  else if (ageMatch && Number(ageMatch[1]) <= MAX_AGE) {
    const passed = daysBetween(birthdayIn(thisYear, month, day), today) >= 0;
    year = thisYear - Number(ageMatch[1]) - (passed ? 0 : 1);
  } else return null;
  if (year < thisYear - MAX_AGE) return null;
  const date = birthdayIn(year, month, day);
  return daysBetween(date, today) >= 0 ? date : null;
}

/** "Born March 8, 2019 · turns 7 next", confirming a birth date worked out from an age or year. */
export function bornWords(date: Ymd, now: number): string {
  const p = ymdParts(date)!;
  const born = `Born ${MONTHS[p.m - 1]} ${p.d}, ${p.y}`;
  const next = nextBirthday(date, now);
  if (!next) return born;
  return `${born} · ${next.days === 0 ? `turns ${next.turns} today` : `turns ${next.turns} next`}`;
}

/**
 * An approximate birth date for a pet whose birthday isn't known: today, `years` and `months` ago.
 * Null when the age is zero, negative or not a whole number.
 */
export function approxBirthDate(years: number, months: number, now: number): Ymd | null {
  if (![years, months].every((n) => Number.isInteger(n) && n >= 0) || years > MAX_AGE || months > 11) return null;
  const total = years * 12 + months;
  return total > 0 ? addMonths(toYmd(now), -total) : null;
}

/** The whole years and months between an (approximate) birth date and `now`, to refill the age fields. */
export function ageParts(birthDate: string, now: number): { years: number; months: number } | null {
  const b = ymdParts(birthDate);
  if (!b) return null;
  const n = ymdParts(toYmd(now))!;
  let total = (n.y - b.y) * 12 + n.m - b.m;
  if (n.d < b.d) total -= 1;
  return total < 0 ? null : { years: Math.floor(total / 12), months: total % 12 };
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

/** "Birthday today" on the day, "Turns 6 on March 14" otherwise; null without a birth date, or when it is only approximate. */
export function birthdayText(birthDate: string | undefined, now: number, approx?: boolean): string | null {
  const next = birthDate && !approx ? nextBirthday(birthDate, now) : null;
  if (!next) return null;
  if (next.days === 0) return 'Birthday today';
  const p = ymdParts(next.date)!;
  return `Turns ${next.turns} on ${MONTHS[p.m - 1]} ${p.d}`;
}

/** The hour of the morning the birthday notification arrives. */
export const BIRTHDAY_HOUR = 9;

/**
 * The next birthday notification: 9:00 on the day (today's, until 9:00 has passed). Re-written when
 * the app opens, so each year brings the next one. None for an approximate birth date.
 */
export function birthdayReminder(pet: { id: string; name: string; birthDate?: string; birthDateApprox?: boolean }, now: number, app: { app: string; url: string; ref: string }): ReminderInput | null {
  if (!pet.birthDate || pet.birthDateApprox) return null;
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

/** How far ahead Today mentions a coming birthday. */
export const BIRTHDAY_LEAD_MONTHS = 3;

export interface BirthdayCountdown {
  date: Ymd;
  turns: number;
  days: number;
  /** "today", "tomorrow", "in 5 days", "in 3 weeks", "in 2 months". */
  when: string;
}

/**
 * A birthday close enough to mention: within three months (by the calendar), counted down in months,
 * then weeks, then days. Null further off, without a birth date, or when it is only approximate.
 */
export function birthdayCountdown(birthDate: string | undefined, now: number, approx?: boolean): BirthdayCountdown | null {
  const next = birthDate && !approx ? nextBirthday(birthDate, now) : null;
  if (!next || next.date > addMonths(toYmd(now), BIRTHDAY_LEAD_MONTHS)) return null;
  return { ...next, when: inDays(next.days, { months: 'nearest' }) };
}

/** "Biscuit's birthday in 3 weeks", "Biscuit's birthday tomorrow"; the day itself is a celebration, not a line. */
export const birthdayLine = (name: string, c: Pick<BirthdayCountdown, 'when'>) => `${name}'s birthday ${c.when}`;

/** "Turns 5 on June 4": the line under a coming birthday. */
export function turnsOn(c: Pick<BirthdayCountdown, 'turns' | 'date'>): string {
  const p = ymdParts(c.date)!;
  return `Turns ${c.turns} on ${MONTHS[p.m - 1]} ${p.d}`;
}
