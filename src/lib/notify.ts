// What Pet asks the shared sender to notify, as data (@huishouden/pwa-kit/reminders): one reminder
// per remaining dose of a medicine course, and one per meal cut-off that nobody has ticked yet.
// Pure: the live store writes these with replaceReminders; the sample never does.

import { remindersForCourse, type ReminderInput } from '@huishouden/pwa-kit/reminders';
import type { Course, Feeding, Meal, MedDose, Pet } from './model';
import { courseState } from './courses';
import { fedTodayFor, mealAt, mealsOf } from './feeding';
import { addDays, startOfDay } from './time';

export const APP = 'pet';
export const APP_URL = 'https://huishouden-pet.web.app';

export const courseRef = (courseId: string) => `${APP}:course:${courseId}`;
export const mealsRef = (petId: string) => `${APP}:meals:${petId}`;

/** A link that opens Pet on one pet's page. */
export const petUrl = (petId: string) => `${APP_URL}/?tab=pets&pet=${encodeURIComponent(petId)}`;

/**
 * Every remaining dose of a running or upcoming course, except doses already ticked today (given
 * early, so nobody needs the nudge). Finished courses have none.
 */
export function courseReminders(course: Course, pet: Pick<Pet, 'name'> | undefined, medDoses: MedDose[], now: number): ReminderInput[] {
  if (courseState(course, now) === 'finished') return [];
  const ticked = new Set(
    medDoses
      .filter((d) => d.courseId === course.id && startOfDay(d.at) === startOfDay(now))
      .map((d) => (course.times[d.slot] ? mealAt(course.times[d.slot], now) : -1)),
  );
  return remindersForCourse(
    { ...course, notes: course.notes ?? '' },
    { app: APP, url: petUrl(course.petId), ref: courseRef(course.id), forWhom: pet?.name, now },
  ).filter((r) => !ticked.has(r.at));
}

/**
 * A nudge at each meal's cut-off for today and the next `days - 1` days, skipping meals already
 * ticked today. Re-written on every tick and when the app opens, so a fed meal never notifies.
 */
export function mealReminders(pet: Pick<Pet, 'id' | 'name'>, meals: Meal[], feedings: Feeding[], now: number, days = 2): ReminderInput[] {
  const out: ReminderInput[] = [];
  for (let d = 0; d < days; d++) {
    const day = addDays(now, d);
    for (const meal of mealsOf(meals, pet.id)) {
      const at = mealAt(meal.time, day);
      if (at <= now) continue;
      if (d === 0 && fedTodayFor(feedings, meal.id, now).length) continue;
      out.push({
        app: APP,
        title: `${pet.name}: ${meal.name} not fed yet`,
        body: 'Nobody has ticked it on the board. Tap to open Pet.',
        at,
        url: `${APP_URL}/`,
        ref: mealsRef(pet.id),
      });
    }
  }
  return out;
}
