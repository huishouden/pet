// Feeding: today's meals per pet as fed / due / not fed yet, time since the last feed, and the daily
// count for the history. Pure: every function takes `now`.

import { MINUTE, addDays, startOfDay, toYmd } from '@huishouden/pwa-kit/time';

export interface MealLike {
  id: string;
  petId: string;
  name: string;
  /** 'HH:MM', 24-hour local time. */
  time: string;
}

export interface FeedingLike {
  id: string;
  petId: string;
  mealId?: string;
  at: number;
  by: string;
}

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const isMealTime = (s: unknown): s is string => typeof s === 'string' && TIME.test(s);

/** Today's (the day of `now`) moment for a meal time. */
export function mealAt(time: string, now: number): number {
  const m = TIME.exec(time);
  const d = new Date(startOfDay(now));
  if (m) d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d.getTime();
}

export type MealStatus<F> = { state: 'fed'; feeding: F; at: number } | { state: 'due'; at: number } | { state: 'late'; at: number };

/** Meals of one pet, earliest first. */
export function mealsOf<M extends MealLike>(meals: M[], petId: string): M[] {
  return meals.filter((m) => m.petId === petId).sort((a, b) => a.time.localeCompare(b.time) || a.name.localeCompare(b.name));
}

/**
 * Each of the pet's meals today: fed (a feeding for that meal logged today, the latest if several),
 * not yet due, or late (its time has passed and nobody has logged it).
 */
export function todaysMeals<M extends MealLike, F extends FeedingLike>(meals: M[], feedings: F[], petId: string, now: number): { meal: M; status: MealStatus<F> }[] {
  const today = startOfDay(now);
  const fedToday = feedings.filter((f) => f.petId === petId && f.mealId && startOfDay(f.at) === today);
  return mealsOf(meals, petId).map((meal) => {
    const feeding = fedToday.filter((f) => f.mealId === meal.id).sort((a, b) => b.at - a.at)[0];
    const at = mealAt(meal.time, now);
    if (feeding) return { meal, status: { state: 'fed', feeding, at: feeding.at } };
    return { meal, status: { state: now > at ? 'late' : 'due', at } };
  });
}

/** The pet's most recent feeding up to now, any meal or none. */
export function lastFed<F extends FeedingLike>(feedings: F[], petId: string, now: number): F | null {
  return feedings.filter((f) => f.petId === petId && f.at <= now).reduce<F | null>((best, f) => (!best || f.at > best.at ? f : best), null);
}

/** "35m", "1h", "2h 10m", "1d 3h". Rounds down to the minute. */
export function formatDuration(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / MINUTE));
  const d = Math.floor(totalMin / (24 * 60));
  const h = Math.floor((totalMin % (24 * 60)) / 60);
  const m = totalMin % 60;
  if (d > 0) return h ? `${d}d ${h}h` : `${d}d`;
  if (h > 0) return m ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}

/** "just now" under a minute, otherwise "2h 10m ago". */
export function formatAgo(at: number, now: number): string {
  if (now - at < MINUTE) return 'just now';
  return `${formatDuration(now - at)} ago`;
}

/** Feedings per calendar day for the last `days` days including today, oldest first. */
export function dailyCounts(feedings: FeedingLike[], petId: string, now: number, days = 14): { day: string; count: number }[] {
  const first = addDays(now, -(days - 1));
  const counts = new Map<string, number>();
  for (const f of feedings) if (f.petId === petId && f.at >= first && f.at < addDays(now, 1)) counts.set(toYmd(f.at), (counts.get(toYmd(f.at)) ?? 0) + 1);
  return Array.from({ length: days }, (_, i) => {
    const day = toYmd(addDays(first, i));
    return { day, count: counts.get(day) ?? 0 };
  });
}

/** The pet's feedings in the last `days` days, newest first. */
export function recentFeedings<F extends FeedingLike>(feedings: F[], petId: string, now: number, days = 14): F[] {
  const since = addDays(now, -(days - 1));
  return feedings.filter((f) => f.petId === petId && f.at >= since).sort((a, b) => b.at - a.at);
}

/** 'HH:MM' for a moment, for the meal-time input. */
export const toMealTime = (t: number) => {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/**
 * The board every pet starts with, like the paper one: AM and PM, each with the time after which it
 * shows "Not fed yet". Stable ids per pet, so two devices adding the same pet can't double them.
 */
export function defaultMeals(petId: string): (MealLike & { time: string })[] {
  return [
    { id: `${petId}-am`, petId, name: 'AM', time: '09:00' },
    { id: `${petId}-pm`, petId, name: 'PM', time: '19:00' },
  ];
}

/** Today's feeds for one meal: what un-ticking it removes. */
export function fedTodayFor<F extends FeedingLike>(feedings: F[], mealId: string, now: number): F[] {
  const today = startOfDay(now);
  return feedings.filter((f) => f.mealId === mealId && startOfDay(f.at) === today);
}
