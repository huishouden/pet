// Outings: taking a pet out for the bathroom, and walks. Each pet with a plan has scheduled outings
// a day (with its meals, at set times, or every few hours while the household is up), a daily poop
// minimum, and a gentle flag when days end under it. Walks can always be logged; a walk goal is
// optional. Which outings a day has and the id of each one's log come from the kit
// (`@huishouden/pwa-kit/pet-outings`), which the portal's to-do list and the assistant share.
// Pure: every function takes `now`.

import { OUTING_DEFAULTS, everyTimes, outingId, outingSlots } from '@huishouden/pwa-kit/pet-outings';
import { addDays, atTime, startOfDay, toYmd, type Ymd } from '@huishouden/pwa-kit/time';
import type { Meal, Outing, OutingPlan, Pet } from './model';
import { formatClock } from './format';
import { t } from '../i18n';

export { everyTimes, outingId };

export const DEFAULT_FROM = OUTING_DEFAULTS.from;
export const DEFAULT_TO = OUTING_DEFAULTS.to;
export const DEFAULT_EVERY = OUTING_DEFAULTS.every;
export const DEFAULT_FLAG_DAYS = OUTING_DEFAULTS.flagDays;
/** The history strip's length. */
export const HISTORY_DAYS = 14;
/** Quick picks for a walk's length, in minutes. */
export const WALK_PICKS = [10, 20, 30, 45] as const;

/** One scheduled outing of a day: "Breakfast" at its meal's time, or "7:00 AM". */
export interface OutingSlot {
  /** `meal-<mealId>` or `t-HHMM`: what an outing logged for it carries as `slot`. */
  key: string;
  time: string;
  label: string;
}

type PlanLike = Pick<OutingPlan, 'id' | 'on' | 'mode' | 'times' | 'every' | 'from' | 'to'>;
type OutingLike = Pick<Outing, 'id' | 'petId' | 'slot' | 'at' | 'pee' | 'poop' | 'walkMin' | 'by'>;

/** A pet's scheduled outings, earliest first, named after the meal or by the time; none while its plan is off. */
export function slotsOf(plan: PlanLike | undefined, meals: Pick<Meal, 'id' | 'petId' | 'name' | 'time'>[]): OutingSlot[] {
  if (!plan?.on) return [];
  return outingSlots({ ...plan, petId: plan.id }, meals).map((s) => ({ key: s.key, time: s.time, label: s.meal ?? formatClock(s.time) }));
}

export type SlotStatus<O> = { state: 'done'; outing: O; at: number } | { state: 'due' | 'late'; at: number };

/** The outing logged for a slot on a day: its own id, or one naming the slot that day. A walk never counts. */
export function outingFor<O extends OutingLike>(outings: O[], petId: string, slot: string, day: Ymd): O | undefined {
  const id = outingId(petId, day, slot);
  return outings.find((o) => o.id === id) ?? outings.filter((o) => o.petId === petId && o.slot === slot && toYmd(o.at) === day).sort((a, b) => b.at - a.at)[0];
}

/** Each scheduled outing of the day of `day`: done (and how), not yet due, or late (its time passed). */
export function slotsOn<O extends OutingLike>(plan: PlanLike | undefined, meals: Pick<Meal, 'id' | 'petId' | 'name' | 'time'>[], outings: O[], day: number, now: number): { slot: OutingSlot; status: SlotStatus<O> }[] {
  if (!plan) return [];
  const ymd = toYmd(day);
  return slotsOf(plan, meals).map((slot) => {
    const outing = outingFor(outings, plan.id, slot.key, ymd);
    const at = atTime(ymd, slot.time);
    if (outing) return { slot, status: { state: 'done', outing, at: outing.at } };
    return { slot, status: { state: now > at ? 'late' : 'due', at } };
  });
}

export interface OutingDay {
  day: Ymd;
  /** Outings logged that day (walks included). */
  outings: number;
  poops: number;
  walkMin: number;
}

/** One day's counts for a pet. */
export function dayCounts(outings: OutingLike[], petId: string, day: number): OutingDay {
  const start = startOfDay(day);
  const list = outings.filter((o) => o.petId === petId && startOfDay(o.at) === start);
  return { day: toYmd(day), outings: list.length, poops: list.filter((o) => o.poop === true).length, walkMin: list.reduce((n, o) => n + (o.walkMin ?? 0), 0) };
}

/** The last `days` days, oldest first, today last. */
export function history(outings: OutingLike[], petId: string, now: number, days = HISTORY_DAYS): OutingDay[] {
  return Array.from({ length: days }, (_, i) => dayCounts(outings, petId, addDays(now, i - days + 1)));
}

/** A day under the minimum: something was logged that day (so it was tracked) and too few poops. */
export const underMinimum = (d: OutingDay, min: number | undefined) => !!min && d.outings > 0 && d.poops < min;

/**
 * Days in a row, ending yesterday, that ended under the minimum. A day with nothing logged ends the
 * run: nobody tracked it, which says nothing about the pet.
 */
export function underStreak(plan: Pick<OutingPlan, 'id' | 'poopMin'> | undefined, outings: OutingLike[], now: number): number {
  if (!plan?.poopMin) return 0;
  let n = 0;
  for (let i = 1; i <= HISTORY_DAYS; i++) {
    if (!underMinimum(dayCounts(outings, plan.id, addDays(now, -i)), plan.poopMin)) break;
    n++;
  }
  return n;
}

export interface OutingFlag {
  /** `vet` once `flagDays` days in a row ended under the minimum; `yesterday` for a short day before that. */
  level: 'yesterday' | 'vet';
  text: string;
}

/** The gentle flag for a pet: yesterday ended under its minimum, or several days in a row did. */
export function outingFlag(pet: Pick<Pet, 'name'>, plan: OutingPlan | undefined, outings: OutingLike[], now: number): OutingFlag | null {
  if (!plan?.on || !plan.poopMin) return null;
  const streak = underStreak(plan, outings, now);
  if (streak === 0) return null;
  if (streak >= (plan.flagDays ?? DEFAULT_FLAG_DAYS)) return { level: 'vet', text: t('outings.flagVet', { name: pet.name, count: streak, min: plan.poopMin }) };
  const y = dayCounts(outings, plan.id, addDays(now, -1));
  return { level: 'yesterday', text: t('outings.flagYesterday', { name: pet.name, poops: y.poops, min: plan.poopMin }) };
}

/** "1 of 2 poops today", "1 poop today" without a minimum. */
export function poopLine(poops: number, min: number | undefined): string {
  return min ? t('outings.poopsOf', { count: poops, min }) : t('outings.poops', { count: poops });
}

/** "20 of 30 min walked" with a goal; "20 min walked" without one; null with neither. */
export function walkLine(minutes: number, goal: number | undefined): string | null {
  if (goal) return t('outings.walkOf', { minutes, goal });
  return minutes ? t('outings.walked', { minutes }) : null;
}

/** What an outing was: "Pooped", "Pee only", "Walk · 20 min", "Pooped · walk 20 min". */
export function outingWhat(o: Pick<Outing, 'pee' | 'poop' | 'walkMin'>): string {
  const bathroom = o.poop ? t('outings.pooped') : o.pee ? t('outings.peeOnly') : o.pee === false ? t('outings.nothing') : '';
  if (!o.walkMin) return bathroom || t('outings.out');
  return bathroom ? t('outings.withWalk', { what: bathroom, minutes: o.walkMin }) : t('outings.walkOnly', { minutes: o.walkMin });
}

/** "Take Theo out · Breakfast": the scheduled outing, read on its own in the portal or a notification. */
export const takeOut = (name: string, slot: OutingSlot) => t('outings.takeOut', { name: name.trim(), slot: slot.label });

/** A new plan's starting point: out with the meals; a dog at least one poop a day; no walk goal. */
export function defaultPlan(pet: Pick<Pet, 'species'>) {
  return { on: true, mode: 'meals' as const, every: DEFAULT_EVERY, from: DEFAULT_FROM, to: DEFAULT_TO, poopMin: pet.species === 'dog' ? 1 : 0, flagDays: DEFAULT_FLAG_DAYS, remind: false, walkGoal: 0 };
}

/** "With meals: AM 9:00 AM, PM 7:00 PM", "7:00 AM, 6:00 PM", "Every 4 h, 7:00 AM to 9:00 PM". */
export function scheduleText(plan: OutingPlan, slots: OutingSlot[]): string {
  if (plan.mode === 'every') return t('outings.everyText', { hours: plan.every ?? DEFAULT_EVERY, from: formatClock(plan.from ?? DEFAULT_FROM), to: formatClock(plan.to ?? DEFAULT_TO) });
  if (plan.mode === 'meals') return slots.length ? t('outings.withMealsText', { list: slots.map((s) => `${s.label} ${formatClock(s.time)}`).join(', ') }) : t('outings.noMeals');
  return slots.map((s) => s.label).join(', ') || t('outings.noTimes');
}
