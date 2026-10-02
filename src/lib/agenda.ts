// What Pet puts on the household agenda (households/{id}/agenda, read by the portal): appointments,
// each care reminder's next due day, medicine courses, birthdays coming up, and today's meals.
// Logs of what already happened (doses given, feeds, weights, records) stay in the app.
// Pure: every function takes `now`.

import { allDayStart, inAgendaWindow, type AgendaInput } from '@huishouden/pwa-kit/agenda';
import { addDays, parseYmd, toYmd } from '@huishouden/pwa-kit/time';
import type { Appointment, Course, Feeding, Meal, Pet, Reminder } from './model';
import type { PetHouseholdData } from './demo';
import { nextBirthday } from './birthday';
import { lastDay, timesText } from './courses';
import { fedTodayFor, mealAt, mealsOf } from './feeding';
import { describeRecurrence, dueState } from './schedule';
import { APP, APP_URL } from './notify';

/** The repo short name the agenda files Pet's items under. */
export const AGENDA_APP = APP;

export type AgendaEntry = Omit<AgendaInput, 'ref'>;

export const appointmentRef = (id: string) => `appointment:${id}`;
export const reminderRef = (id: string) => `reminder:${id}`;
export const courseAgendaRef = (id: string) => `course:${id}`;
export const birthdayAgendaRef = (petId: string) => `birthday:${petId}`;
export const mealRef = (mealId: string, day: string) => `meal:${mealId}:${day}`;

/** How far ahead a birthday is published. */
export const BIRTHDAY_AHEAD_DAYS = 180;

/** A link that opens one tab, on one pet when given. */
export function tabUrl(tab: 'care' | 'appointments' | 'pets', petId?: string, appUrl = APP_URL): string {
  const params = new URLSearchParams({ tab });
  if (petId) params.set('pet', petId);
  return `${appUrl}/?${params}`;
}

const nameOf = (pets: Pick<Pet, 'id' | 'name'>[], id: string) => pets.find((p) => p.id === id)?.name.trim() || undefined;
const inWindow = (items: AgendaEntry[], now: number) => items.filter((i) => inAgendaWindow(i, now));

/** An appointment at its time, at its place, for the pets it is for. */
export function appointmentAgenda(a: Appointment, pets: Pick<Pet, 'id' | 'name'>[], now: number, appUrl = APP_URL): AgendaEntry[] {
  if (!a.title.trim() || !Number.isFinite(a.at)) return [];
  const who = a.petIds.map((id) => nameOf(pets, id)).filter(Boolean).join(', ');
  const location = a.location?.trim();
  return inWindow(
    [
      {
        kind: 'appointment',
        title: a.title,
        start: a.at,
        allDay: false,
        ...(location ? { detail: location } : {}),
        url: tabUrl('appointments', a.petIds.length === 1 ? a.petIds[0] : undefined, appUrl),
        ...(who ? { who } : {}),
      },
    ],
    now,
  );
}

/** A care reminder's next due day only, overdue once that day has passed. A given one-off has none. */
export function reminderAgenda(r: Reminder, pets: Pick<Pet, 'id' | 'name'>[], now: number, appUrl = APP_URL): AgendaEntry[] {
  const state = dueState(r, now);
  if (state === 'done' || parseYmd(r.due) === null || !r.title.trim()) return [];
  const who = nameOf(pets, r.petId);
  return inWindow(
    [
      {
        kind: 'due',
        title: r.title,
        start: allDayStart(r.due),
        allDay: true,
        detail: describeRecurrence(r),
        url: tabUrl('care', undefined, appUrl),
        ...(who ? { who } : {}),
        status: state === 'overdue' ? 'overdue' : 'upcoming',
      },
    ],
    now,
  );
}

/** "1 tablet, twice a day, with food". */
export function courseDetail(c: Pick<Course, 'dose' | 'times' | 'timesPerDay' | 'withFood'>): string {
  return [c.dose.trim(), timesText(c.times.length || c.timesPerDay).toLowerCase(), c.withFood ? 'with food' : ''].filter(Boolean).join(', ');
}

/** A medicine course as one all-day item from its first day through its last; doses stay in the app. */
export function courseAgenda(c: Course, pets: Pick<Pet, 'id' | 'name'>[], now: number, appUrl = APP_URL): AgendaEntry[] {
  if (parseYmd(c.startDate) === null || !c.name.trim()) return [];
  const who = nameOf(pets, c.petId);
  return inWindow(
    [
      {
        kind: 'medicine',
        title: c.name,
        start: allDayStart(c.startDate),
        end: allDayStart(addDays(lastDay(c), 1)),
        allDay: true,
        detail: courseDetail(c),
        url: tabUrl('pets', c.petId, appUrl),
        ...(who ? { who } : {}),
      },
    ],
    now,
  );
}

/** The pet's next birthday when it is within `BIRTHDAY_AHEAD_DAYS`; none for an approximate birth date. */
export function birthdayAgenda(pet: Pick<Pet, 'id' | 'name' | 'birthDate' | 'birthDateApprox'>, now: number, appUrl = APP_URL): AgendaEntry[] {
  if (!pet.birthDate || pet.birthDateApprox) return [];
  const next = nextBirthday(pet.birthDate, now);
  if (!next || next.days > BIRTHDAY_AHEAD_DAYS) return [];
  const name = pet.name.trim();
  return [
    {
      kind: 'birthday',
      title: `${name} turns ${next.turns}`,
      start: allDayStart(next.date),
      allDay: true,
      url: tabUrl('pets', pet.id, appUrl),
      who: name,
    },
  ];
}

/** Today's meals for one pet, at their times: done once a feed for the meal is logged today. */
export function mealAgenda(pet: Pick<Pet, 'id' | 'name'>, meals: Meal[], feedings: Feeding[], now: number, appUrl = APP_URL): { ref: string; items: AgendaEntry[] }[] {
  const today = toYmd(now);
  const name = pet.name.trim();
  return mealsOf(meals, pet.id).map((meal) => {
    const detail = [meal.food, meal.portion].map((s) => s?.trim()).filter(Boolean).join(', ');
    const item: AgendaEntry = {
      kind: 'feeding',
      title: `${name}: ${meal.name}`,
      start: mealAt(meal.time, now),
      allDay: false,
      ...(detail ? { detail } : {}),
      url: tabUrl('pets', pet.id, appUrl),
      who: name,
      status: fedTodayFor(feedings, meal.id, now).length ? 'done' : 'upcoming',
    };
    return { ref: mealRef(meal.id, today), items: [item] };
  });
}

export type AgendaData = Pick<PetHouseholdData, 'pets' | 'appointments' | 'reminders' | 'courses' | 'meals' | 'feedings'>;

/** Every record's items by ref, refs with nothing to publish included (empty), for per-ref writes. */
export function agendaByRef(data: AgendaData, now: number, appUrl = APP_URL): Map<string, AgendaEntry[]> {
  const out = new Map<string, AgendaEntry[]>();
  for (const a of data.appointments) out.set(appointmentRef(a.id), appointmentAgenda(a, data.pets, now, appUrl));
  for (const r of data.reminders) out.set(reminderRef(r.id), reminderAgenda(r, data.pets, now, appUrl));
  for (const c of data.courses) out.set(courseAgendaRef(c.id), courseAgenda(c, data.pets, now, appUrl));
  for (const p of data.pets) {
    out.set(birthdayAgendaRef(p.id), birthdayAgenda(p, now, appUrl));
    for (const { ref, items } of mealAgenda(p, data.meals, data.feedings, now, appUrl)) out.set(ref, items);
  }
  return out;
}

/** Everything Pet publishes, for `syncAgenda`. */
export function agendaItems(data: AgendaData, now: number, appUrl = APP_URL): AgendaInput[] {
  return [...agendaByRef(data, now, appUrl)].flatMap(([ref, items]) => items.map((i) => ({ ...i, ref })));
}
