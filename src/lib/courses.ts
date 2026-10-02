// Short medicine courses ("1 tablet twice daily for 7 days with food"): which day of the course it is,
// today's doses as given / not yet / missed, and default dose times from the pet's meals. Pure.

import { doseSlots, doseState, type MedCourse } from '@huishouden/pwa-kit/dose';
import { isMealTime } from './feeding';
import { addDays, daysBetween, parseYmd, startOfDay, toYmd } from '@huishouden/pwa-kit/time';

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
  if (day > c.days) return 'Finished';
  if (day >= 1) return `Day ${day} of ${c.days}`;
  return day === 0 ? 'Starts tomorrow' : `Starts in ${1 - day} days`;
}

export type DoseStatus<D> = { state: 'given'; dose: D; at: number } | { state: 'due'; at: number } | { state: 'missed'; at: number };

/**
 * Today's doses of an active course, one per time; empty when the course isn't running today. The
 * slots are the kit's (`doseSlots`); a dose is due until its time and missed after it.
 */
export function todaysDoses<C extends CourseLike, D extends DoseLike>(c: C, doses: D[], now: number): { slot: number; time: string; status: DoseStatus<D> }[] {
  if (courseState(c, now) !== 'active') return [];
  const today = startOfDay(now);
  const mine = doses.filter((d) => d.courseId === c.id && startOfDay(d.at) === today);
  const slots = doseSlots({ startDate: toYmd(today), days: 1, times: c.times }, today, addDays(today, 1) - 1);
  return c.times.map((time, slot) => {
    const dose = mine.filter((d) => d.slot === slot).sort((a, b) => b.at - a.at)[0];
    if (dose) return { slot, time, status: { state: 'given', dose, at: dose.at } };
    const due = slots.find((s) => s.time === time)!;
    const state = doseState(due, [], now, { earlyMinutes: Number.POSITIVE_INFINITY, graceMinutes: 0 });
    return { slot, time, status: { state: state === 'missed' ? 'missed' : 'due', at: due.at } };
  });
}

/** Today's logged doses for one slot: what un-ticking it removes. */
export function givenTodayFor<D extends DoseLike>(doses: D[], courseId: string, slot: number, now: number): D[] {
  const today = startOfDay(now);
  return doses.filter((d) => d.courseId === courseId && d.slot === slot && startOfDay(d.at) === today);
}

/** Doses given over the whole course and how many it has in all: "9 of 14 doses". */
export function progress(c: CourseLike, doses: DoseLike[]): { given: number; total: number } {
  const slots = new Set(doses.filter((d) => d.courseId === c.id).map((d) => `${toYmd(d.at)}#${d.slot}`));
  return { given: slots.size, total: c.days * c.times.length };
}

/**
 * Dose times for a new course: twice a day follows the pet's meals (AM and PM), once a day the first
 * meal; otherwise spread evenly from 08:00 to 20:00.
 */
export function defaultTimes(timesPerDay: number, mealTimes: string[]): string[] {
  const n = Math.min(Math.max(1, Math.round(timesPerDay)), MAX_TIMES_PER_DAY);
  const meals = mealTimes.filter(isMealTime).sort();
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
  if (n === 1) return 'Once a day';
  if (n === 2) return 'Twice a day';
  return `${n} times a day`;
}

/** A label for a dose slot: the meal at the same time ("AM"), else null for the caller to show the time. */
export function slotMealName(time: string, meals: { time: string; name: string }[]): string | null {
  return meals.find((m) => m.time === time)?.name ?? null;
}
