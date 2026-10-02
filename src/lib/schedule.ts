// Recurring care: when the next dose is due, how urgent it is, and how to say so from across a room.
// Pure: dates are local calendar days ('YYYY-MM-DD'), and every function takes `now`.

import { daysBetween, parseYmd, startOfDay, toYmd } from '@huishouden/pwa-kit/time';

import { addInterval, type Unit } from '@huishouden/pwa-kit/schedule';

export { addInterval, UNITS, type Unit } from '@huishouden/pwa-kit/schedule';

export interface Recurrence {
  every: number;
  unit: Unit;
}

/** What the schedule logic needs from a reminder. */
export interface Scheduled {
  due: string;
  every?: number;
  unit?: Unit;
  lastDoneAt?: number;
}

export const isRecurring = (s: { every?: number; unit?: Unit }): s is Recurrence => !!s.unit && typeof s.every === 'number' && s.every >= 1;

/**
 * Fields to write when a dose is given at `at`: the next due date counts from the day it was given
 * (a late flea treatment moves the next one too). A one-off keeps its due date and is done.
 */
export function markGiven(s: Scheduled, at: number): { lastDoneAt: number; due: string } {
  const lastDoneAt = Math.round(at);
  if (!isRecurring(s)) return { lastDoneAt, due: s.due };
  return { lastDoneAt, due: addInterval(toYmd(at), s.every, s.unit) };
}

/** A one-off that has been given; nothing further is due. */
export const isFinished = (s: Scheduled) => !isRecurring(s) && typeof s.lastDoneAt === 'number';

export type DueState = 'overdue' | 'today' | 'soon' | 'later' | 'done';

/** How many days ahead a reminder starts showing as "soon": a month for yearly ones, a week otherwise. */
export function leadDays(s: { every?: number; unit?: Unit }): number {
  if (s.unit === 'year') return 30;
  if (s.unit === 'day' || (s.unit === 'week' && (s.every ?? 1) === 1)) return 2;
  return 7;
}

export function daysUntil(due: string, now: number): number {
  const t = parseYmd(due);
  if (t === null) return 0;
  return daysBetween(now, t);
}

export function dueState(s: Scheduled, now: number): DueState {
  if (isFinished(s)) return 'done';
  const days = daysUntil(s.due, now);
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days <= leadDays(s)) return 'soon';
  return 'later';
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** "in 3 days", "in 5 weeks", "in 4 months": the distance to a due day, rounded down to a unit people use. */
export function inWords(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days < 21) return `in ${plural(days, 'day')}`;
  if (days < 60) return `in ${plural(Math.floor(days / 7), 'week')}`;
  return `in ${plural(Math.floor(days / 30.44), 'month')}`;
}

/** "Due today", "Due tomorrow", "Due in 3 days", "2 days overdue", "Given". */
export function dueText(s: Scheduled, now: number): string {
  const state = dueState(s, now);
  if (state === 'done') return 'Given';
  const days = daysUntil(s.due, now);
  if (days < 0) return `${plural(-days, 'day')} overdue`;
  return `Due ${inWords(days)}`;
}

/**
 * The line read from across the room: "Overdue: flea and tick", "Heartworm due today",
 * "Heartworm due in 3 days". Titles keep their own capitals after the colon only when they are names.
 */
export function headline(s: Scheduled & { title: string }, now: number): string {
  const state = dueState(s, now);
  const title = s.title.trim();
  if (state === 'overdue') return `Overdue: ${lowerFirst(title)}`;
  if (state === 'done') return `${title} given`;
  return `${title} due ${inWords(daysUntil(s.due, now))}`;
}

/** Lower-cases the first letter of a common noun ("Flea and tick" → "flea and tick"), not of an acronym ("FVRCP"). */
export function lowerFirst(text: string): string {
  if (/^[A-Z]{2}/.test(text)) return text;
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** "Every month", "Every 3 months", "Every year", "Once". */
export function describeRecurrence(s: { every?: number; unit?: Unit }): string {
  if (!isRecurring(s)) return 'Once';
  return s.every === 1 ? `Every ${s.unit}` : `Every ${s.every} ${s.unit}s`;
}

const RANK: Record<DueState, number> = { overdue: 0, today: 1, soon: 2, later: 3, done: 4 };

/** Most urgent first: overdue (oldest first), then by due date; finished one-offs last. */
export function byUrgency<T extends Scheduled & { title: string }>(items: T[], now: number): T[] {
  return [...items].sort(
    (a, b) => RANK[dueState(a, now)] - RANK[dueState(b, now)] || (a.due < b.due ? -1 : a.due > b.due ? 1 : 0) || a.title.localeCompare(b.title),
  );
}

/** Overdue, due today and due soon, most urgent first: what the Today screen leads with. */
export function needsAttention<T extends Scheduled & { title: string }>(items: T[], now: number): T[] {
  return byUrgency(
    items.filter((s) => ['overdue', 'today', 'soon'].includes(dueState(s, now))),
    now,
  );
}

export interface DueGroup<T> {
  label: 'Overdue' | 'Due this week' | 'Later' | 'Given';
  items: T[];
}

/** Groups for the Care screen: Overdue, Due this week (today through 7 days), Later, Given (finished one-offs). */
export function groupByDue<T extends Scheduled & { title: string }>(items: T[], now: number): DueGroup<T>[] {
  const groups: DueGroup<T>[] = [
    { label: 'Overdue', items: [] },
    { label: 'Due this week', items: [] },
    { label: 'Later', items: [] },
    { label: 'Given', items: [] },
  ];
  for (const s of byUrgency(items, now)) {
    const state = dueState(s, now);
    const days = daysUntil(s.due, now);
    if (state === 'done') groups[3].items.push(s);
    else if (state === 'overdue') groups[0].items.push(s);
    else if (days <= 7) groups[1].items.push(s);
    else groups[2].items.push(s);
  }
  return groups.filter((g) => g.items.length > 0);
}

/** A sensible first due date for a new reminder: today. */
export const todayYmd = (now: number) => toYmd(startOfDay(now));
