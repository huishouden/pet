// Feeding: today's meals per pet as fed / due / not fed yet. Time since the last feed and the daily
// counts come from @huishouden/pwa-kit/log. Pure: every function takes `now`.

import { onDay } from '@huishouden/pwa-kit/log';
import { atTime, isHhmm, startOfDay, toYmd } from '@huishouden/pwa-kit/time';

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

/** Today's (the day of `now`) moment for a meal time; midnight for one that isn't a time. */
export const mealAt = (time: string, now: number): number => (isHhmm(time) ? atTime(toYmd(now), time) : startOfDay(now));

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
  return mealsOn(meals, feedings, petId, now, now);
}

/** Each of the pet's meals on the day of `day` (today, or an earlier day being filled in), as `todaysMeals`. */
export function mealsOn<M extends MealLike, F extends FeedingLike>(meals: M[], feedings: F[], petId: string, day: number, now: number): { meal: M; status: MealStatus<F> }[] {
  const start = startOfDay(day);
  const fedThatDay = feedings.filter((f) => f.petId === petId && f.mealId && startOfDay(f.at) === start);
  return mealsOf(meals, petId).map((meal) => {
    const feeding = fedThatDay.filter((f) => f.mealId === meal.id).sort((a, b) => b.at - a.at)[0];
    const at = mealAt(meal.time, day);
    if (feeding) return { meal, status: { state: 'fed', feeding, at: feeding.at } };
    return { meal, status: { state: now > at ? 'late' : 'due', at } };
  });
}

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

/** One meal's feeds on the day of `day` (today's, by default): what un-ticking it removes. */
export const fedTodayFor = <F extends FeedingLike>(feedings: F[], mealId: string, day: number): F[] => onDay(feedings, day, (f) => f.mealId === mealId);
