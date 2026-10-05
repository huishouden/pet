// What Pet asks the shared sender to notify, as data (@huishouden/pwa-kit/reminders): one reminder
// per remaining dose of a medicine course, and one per meal cut-off that nobody has ticked yet.
// Pure: the live store writes these with replaceReminders; the sample never does.

import { appUrl, SUITE_ORIGIN } from '@huishouden/pwa-kit/site';
import { remindersForCourse, type ReminderInput, type ReminderSource } from '@huishouden/pwa-kit/reminders';
import type { Course, Feeding, Meal, MedDose, Pet } from './model';
import { courseState, slotAt, todoMedDoseId } from './courses';
import { fedTodayFor, mealAt, mealsOf } from './feeding';
import { addDays, startOfDay, toYmd } from '@huishouden/pwa-kit/time';
import { birthdayReminder } from './birthday';
import { t } from '../i18n';

export const APP = 'pet';
/** Pet's path on the suite's one site (pwa-kit docs/one-site.md); bun tests have no Vite env. */
export const APP_BASE = import.meta.env.BASE_URL ?? '/pet/';
/** The page's origin, so staging links to staging; tests run without a page. */
export const APP_ORIGIN = globalThis.location?.origin ?? SUITE_ORIGIN;
/** The app's own address: Today, its home. */
export const APP_URL = appUrl(APP_BASE, '', APP_ORIGIN);

export const courseRef = (courseId: string) => `${APP}:course:${courseId}`;
export const mealsRef = (petId: string) => `${APP}:meals:${petId}`;
export const birthdayRef = (petId: string) => `${APP}:birthday:${petId}`;

/** A link that opens Pet on one pet's page. */
export const petUrl = (petId: string) => appUrl(APP_BASE, `?tab=pets&pet=${encodeURIComponent(petId)}`, APP_ORIGIN);

/**
 * What a dose reminder is about, for the shared sender to check before sending: the course, still
 * there, and the dose the portal's To-do list logs for that slot (`todoMedDoseId`), not yet written.
 * Given or skipped from the portal, or the course removed, the reminder is deleted unsent.
 */
export function doseSource(course: Pick<Course, 'id' | 'times'>, at: number): ReminderSource {
  const day = toYmd(at);
  const slot = course.times.findIndex((time) => slotAt(time, day) === at);
  return {
    checks: [{ doc: `petMedCourses/${course.id}` }, ...(slot >= 0 ? [{ doc: `petMedDoses/${todoMedDoseId(course.id, day, slot)}`, absent: true as const }] : [])],
  };
}

/** What a meal reminder is about: the meal, still on the pet's schedule. */
export const mealSource = (mealId: string): ReminderSource => ({ checks: [{ doc: `petMeals/${mealId}` }] });

/** What a birthday reminder is about: the pet, with that exact birth date. */
export const birthdaySource = (pet: Pick<Pet, 'id' | 'birthDate'>): ReminderSource => ({
  checks: [{ doc: `petProfiles/${pet.id}`, due: [{ field: 'birthDate', in: [pet.birthDate ?? null] }, { field: 'birthDateApprox', notIn: [true] }] }],
});

/**
 * Every remaining dose of a running or upcoming course, except doses already ticked today (given
 * early, so nobody needs the nudge). Finished courses have none. Each names its course and dose as
 * `source` (`doseSource`).
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
  )
    .filter((r) => !ticked.has(r.at))
    .map((r) => ({ ...r, source: doseSource(course, r.at) }));
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
        title: t('notify.mealTitle', { pet: pet.name, meal: meal.name }),
        body: t('notify.mealBody'),
        at,
        url: APP_URL,
        ref: mealsRef(pet.id),
        source: mealSource(meal.id),
      });
    }
  }
  return out;
}

/** The pet's next birthday, at 9:00 on the day; none without a birth date or when it is approximate. */
export function birthdayReminders(pet: Pick<Pet, 'id' | 'name' | 'birthDate' | 'birthDateApprox'>, now: number): ReminderInput[] {
  const r = birthdayReminder(pet, now, { app: APP, url: petUrl(pet.id), ref: birthdayRef(pet.id) });
  return r ? [{ ...r, source: birthdaySource(pet) }] : [];
}
