// Short medicine courses ("1 tablet twice daily for 7 days with food"): which day of the course it is,
// each day's doses as given / not yet / missed, and default dose times from the pet's meals. Pure.

import type { MedCourse } from '@huishouden/pwa-kit/dose';
import { mealAt } from './feeding';
import { addDays, daysBetween, parseYmd, toYmd, ymdToTime, type Ymd, isHhmm } from '@huishouden/pwa-kit/time';
import { t } from '../i18n';

/**
 * What "Scan the label" hands over: the kit's `MedCourse` (read on the device and parsed by
 * `@huishouden/pwa-kit/dose`). `days` and `withFood` are missing when the label doesn't say; the
 * form keeps its own values then.
 */
export type CourseDraft = MedCourse;

export const MAX_TIMES_PER_DAY = 6;
export const MAX_COURSE_DAYS = 365;

interface CourseLike {
  id: string;
  petId: string;
  name: string;
  times: string[];
  startDate: string;
  days: number;
}

interface DoseLike {
  id: string;
  courseId: string;
  slot: number;
  at: number;
  by: string;
  skipped?: boolean;
}

/** YYYY-MM-DD of the course's last day. */
export function lastDay(c: Pick<CourseLike, 'startDate' | 'days'>): string {
  const start = parseYmd(c.startDate);
  if (start === null) return c.startDate;
  return toYmd(addDays(start, Math.max(1, c.days) - 1));
}

/** 1-based day of the course on the day of `now`; below 1 before it starts, above `days` after it ends. */
export function courseDay(c: Pick<CourseLike, 'startDate'>, now: number): number {
  const start = parseYmd(c.startDate);
  return start === null ? 0 : daysBetween(start, now) + 1;
}

export type CourseState = 'upcoming' | 'active' | 'finished';

export function courseState(c: Pick<CourseLike, 'startDate' | 'days'>, now: number): CourseState {
  const day = courseDay(c, now);
  if (day < 1) return 'upcoming';
  return day > c.days ? 'finished' : 'active';
}

/** "Day 3 of 7", "Starts in 2 days", "Starts tomorrow", "Finished". */
export function courseText(c: Pick<CourseLike, 'startDate' | 'days'>, now: number): string {
  const day = courseDay(c, now);
  if (day > c.days) return t('course.finished');
  if (day >= 1) return t('course.dayOf', { day, days: c.days });
  return day === 0 ? t('course.startsTomorrow') : t('course.startsIn', { count: 1 - day });
}

export type DoseStatus<D> =
  | { state: 'given'; dose: D; at: number }
  | { state: 'skipped'; dose: D; at: number }
  | { state: 'due'; at: number }
  | { state: 'missed'; at: number };

/** Whether a slot is handled: given, or skipped on purpose. Either way nothing more is due for it. */
export const isHandled = (s: { state: string }) => s.state === 'given' || s.state === 'skipped';

/** The id of the medicine dose a to-do's Given or Skip logs: one per course, day and slot. */
export const todoMedDoseId = (courseId: string, day: string, slot: number) => `todo-${courseId}-${day}-${slot}`;

/** The moment of a dose time ('HH:MM') on a day. */
export function slotAt(time: string, day: Ymd): number {
  return mealAt(time, ymdToTime(day));
}

/**
 * One day's doses of a course, one per time; empty on a day outside the course. A dose given that
 * day (the latest, if several) is given; else one skipped that day is skipped; one neither is due
 * until its time and missed after it.
 */
export function dosesOn<C extends CourseLike, D extends DoseLike>(c: C, doses: D[], day: Ymd, now: number): { slot: number; time: string; status: DoseStatus<D> }[] {
  const n = courseDay(c, ymdToTime(day));
  if (n < 1 || n > c.days) return [];
  const mine = doses.filter((d) => d.courseId === c.id && toYmd(d.at) === day);
  return c.times.map((time, slot) => {
    const logged = mine.filter((d) => d.slot === slot).sort((a, b) => b.at - a.at);
    const dose = logged.find((d) => !d.skipped);
    if (dose) return { slot, time, status: { state: 'given', dose, at: dose.at } };
    const skip = logged[0];
    if (skip) return { slot, time, status: { state: 'skipped', dose: skip, at: skip.at } };
    const at = slotAt(time, day);
    return { slot, time, status: { state: now > at ? 'missed' : 'due', at } };
  });
}

/** Today's doses of a running course (see `dosesOn`). */
export function todaysDoses<C extends CourseLike, D extends DoseLike>(c: C, doses: D[], now: number): { slot: number; time: string; status: DoseStatus<D> }[] {
  return dosesOn(c, doses, toYmd(now), now);
}

/** One slot's logged doses (given or skipped) on a day: what un-ticking it removes. */
export function givenOnFor<D extends DoseLike>(doses: D[], courseId: string, slot: number, day: Ymd): D[] {
  return doses.filter((d) => d.courseId === courseId && d.slot === slot && toYmd(d.at) === day);
}

/** Today's logged doses for one slot. */
export function givenTodayFor<D extends DoseLike>(doses: D[], courseId: string, slot: number, now: number): D[] {
  return givenOnFor(doses, courseId, slot, toYmd(now));
}

/**
 * The course day by day, from its first day through today (or its last day, once finished): each
 * day's number, its doses, and whether every dose that day was given. Empty before it starts.
 */
export function courseHistory<C extends CourseLike, D extends DoseLike>(c: C, doses: D[], now: number): { day: Ymd; n: number; doses: ReturnType<typeof dosesOn<C, D>>; complete: boolean }[] {
  const start = parseYmd(c.startDate);
  if (start === null) return [];
  const through = Math.min(courseDay(c, now), c.days);
  return Array.from({ length: Math.max(0, through) }, (_, i) => {
    const day = toYmd(addDays(start, i));
    const list = dosesOn(c, doses, day, now);
    return { day, n: i + 1, doses: list, complete: list.every((d) => d.status.state === 'given') };
  });
}

/**
 * Doses given over the whole course, out of how many it has, and the days on which every dose was
 * given: "9 of 14 doses · 4 of 7 days complete". Only doses on the course's days and times count;
 * skipped ones don't.
 */
export function progress(c: CourseLike, doses: DoseLike[]): { given: number; total: number; daysComplete: number; days: number } {
  const start = parseYmd(c.startDate);
  const perDay = new Map<string, Set<number>>();
  for (const d of doses) {
    if (d.skipped || d.courseId !== c.id || d.slot < 0 || d.slot >= c.times.length || start === null) continue;
    const n = daysBetween(start, d.at) + 1;
    if (n < 1 || n > c.days) continue;
    const day = toYmd(d.at);
    perDay.set(day, (perDay.get(day) ?? new Set()).add(d.slot));
  }
  let given = 0;
  let daysComplete = 0;
  for (const slots of perDay.values()) {
    given += slots.size;
    if (slots.size === c.times.length) daysComplete++;
  }
  return { given, total: c.days * c.times.length, daysComplete, days: c.days };
}

/**
 * Dose times for a new course: twice a day follows the pet's meals (AM and PM), once a day the first
 * meal; otherwise spread evenly from 08:00 to 20:00.
 */
export function defaultTimes(timesPerDay: number, mealTimes: string[]): string[] {
  const n = Math.min(Math.max(1, Math.round(timesPerDay)), MAX_TIMES_PER_DAY);
  const meals = mealTimes.filter(isHhmm).sort();
  if (n === meals.length || (n === 1 && meals.length > 0)) return meals.slice(0, n);
  if (n === 1) return ['08:00'];
  const step = (12 * 60) / (n - 1);
  return Array.from({ length: n }, (_, i) => {
    const minutes = Math.round((8 * 60 + i * step) / 15) * 15;
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  });
}

/** How many days from `startDate` through `until`, both included; null when `until` is earlier. */
export function daysUntil(startDate: string, until: string): number | null {
  const a = parseYmd(startDate);
  const b = parseYmd(until);
  if (a === null || b === null) return null;
  const n = daysBetween(a, b) + 1;
  return n >= 1 ? n : null;
}

/** "Twice a day", "3 times a day". */
export function timesText(n: number): string {
  return t('course.timesADay', { count: n });
}

/** A label for a dose slot: the meal at the same time ("AM"), else null for the caller to show the time. */
export function slotMealName(time: string, meals: { time: string; name: string }[]): string | null {
  return meals.find((m) => m.time === time)?.name ?? null;
}
