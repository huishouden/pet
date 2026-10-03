// What Pet puts on the household agenda (households/{id}/agenda, read by the portal): appointments,
// each care reminder's next due day, medicine courses (the span, and today's and tomorrow's doses at
// their times), birthdays coming up, and today's and tomorrow's meals.
// Logs of what already happened (doses given, feeds, weights, records) stay in the app.
// Pure: every function takes `now`.

import { AGENDA_LIMITS, allDayStart, inAgendaWindow, type AgendaInput } from '@huishouden/pwa-kit/agenda';
import { addDays, parseYmd, toYmd } from '@huishouden/pwa-kit/time';
import type { Appointment, Course, Feeding, Meal, MedDose, Pet, Reminder } from './model';
import type { PetHouseholdData } from './demo';
import { nextBirthday } from './birthday';
import { dosesOn, lastDay, slotAt, timesText } from './courses';
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
export const doseRef = (courseId: string, day: string, slot: number) => `dose:${courseId}:${day}:${slot}`;

/** How far ahead a birthday is published. */
export const BIRTHDAY_AHEAD_DAYS = 180;

/** A link that opens one tab (Today, where meals and doses are ticked, is the app's home), on one pet when given. */
export function tabUrl(tab: 'today' | 'care' | 'appointments' | 'pets', petId?: string, appUrl = APP_URL): string {
  if (tab === 'today') return `${appUrl}/`;
  const params = new URLSearchParams({ tab });
  if (petId) params.set('pet', petId);
  return `${appUrl}/?${params}`;
}

const nameOf = (pets: Pick<Pet, 'id' | 'name'>[], id: string) => pets.find((p) => p.id === id)?.name.trim() || undefined;
const inWindow = (items: AgendaEntry[], now: number) => items.filter((i) => inAgendaWindow(i, now));

/** "Heartworm prevention for Milo": what to do and for whom, read on its own in the portal. */
export const forPet = (what: string, who: string | undefined) => (who ? `${what.trim()} for ${who}` : what.trim()).slice(0, AGENDA_LIMITS.title);

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
        // A private appointment stays private on the agenda: helpers and kids never read it.
        ...(a.private ? { private: true } : {}),
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
        title: forPet(r.title, who),
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

/**
 * A medicine course as one all-day item from its first day through its last, for the calendar. It
 * has no status, so the portal's Today leaves it out; the doses below are what Today shows.
 */
export function courseAgenda(c: Course, pets: Pick<Pet, 'id' | 'name'>[], now: number, appUrl = APP_URL): AgendaEntry[] {
  if (parseYmd(c.startDate) === null || !c.name.trim()) return [];
  const who = nameOf(pets, c.petId);
  return inWindow(
    [
      {
        kind: 'medicine',
        title: forPet(c.name, who),
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

/**
 * Today's and tomorrow's doses of a course, one timed item per dose time ("Antibiotic for Juniper",
 * the dose as the detail): done once given that day, otherwise upcoming (the kit reads it as overdue
 * once its time has passed). Days outside the course have none.
 */
export function doseAgenda(c: Course, medDoses: MedDose[], pets: Pick<Pet, 'id' | 'name'>[], now: number, appUrl = APP_URL): { ref: string; items: AgendaEntry[] }[] {
  if (!c.name.trim()) return [];
  const who = nameOf(pets, c.petId);
  const dose = c.dose.trim();
  return [toYmd(now), toYmd(addDays(now, 1))].flatMap((day) =>
    dosesOn(c, medDoses, day, now).map(({ slot, time, status }) => ({
      ref: doseRef(c.id, day, slot),
      items: [
        {
          kind: 'medicine' as const,
          title: forPet(c.name, who),
          start: slotAt(time, day),
          allDay: false,
          ...(dose ? { detail: dose } : {}),
          url: tabUrl('today', undefined, appUrl),
          ...(who ? { who } : {}),
          status: status.state === 'given' ? ('done' as const) : ('upcoming' as const),
        },
      ],
    })),
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

/**
 * Today's and tomorrow's meals for one pet, at their times ("Feed Milo · PM", the food and portion as
 * the detail): done once a feed for the meal is logged that day, otherwise upcoming (the kit reads it
 * as overdue once its time has passed). Tomorrow's are out already, so the portal's Today has the
 * morning meals even before anyone opens Pet that day.
 */
export function mealAgenda(pet: Pick<Pet, 'id' | 'name'>, meals: Meal[], feedings: Feeding[], now: number, appUrl = APP_URL): { ref: string; items: AgendaEntry[] }[] {
  const name = pet.name.trim();
  return [now, addDays(now, 1)].flatMap((day) =>
    mealsOf(meals, pet.id).map((meal) => {
      const detail = [meal.food, meal.portion].map((s) => s?.trim()).filter(Boolean).join(', ');
      const item: AgendaEntry = {
        kind: 'feeding',
        title: `Feed ${name} · ${meal.name.trim()}`.slice(0, AGENDA_LIMITS.title),
        start: mealAt(meal.time, day),
        allDay: false,
        ...(detail ? { detail } : {}),
        url: tabUrl('today', undefined, appUrl),
        who: name,
        status: fedTodayFor(feedings, meal.id, day).length ? 'done' : 'upcoming',
      };
      return { ref: mealRef(meal.id, toYmd(day)), items: [item] };
    }),
  );
}

export type AgendaData = Pick<PetHouseholdData, 'pets' | 'appointments' | 'reminders' | 'courses' | 'medDoses' | 'meals' | 'feedings'>;

/** Every record's items by ref, refs with nothing to publish included (empty), for per-ref writes. */
export function agendaByRef(data: AgendaData, now: number, appUrl = APP_URL): Map<string, AgendaEntry[]> {
  const out = new Map<string, AgendaEntry[]>();
  for (const a of data.appointments) out.set(appointmentRef(a.id), appointmentAgenda(a, data.pets, now, appUrl));
  for (const r of data.reminders) out.set(reminderRef(r.id), reminderAgenda(r, data.pets, now, appUrl));
  for (const c of data.courses) {
    out.set(courseAgendaRef(c.id), courseAgenda(c, data.pets, now, appUrl));
    for (const { ref, items } of doseAgenda(c, data.medDoses, data.pets, now, appUrl)) out.set(ref, items);
  }
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

/**
 * What to write after a change, given what was last written (each ref's items as JSON): the refs
 * whose items changed, to replace, and the refs no longer wanted, to remove. A tick on a meal or a
 * dose changes that one ref's status, so only it is rewritten.
 */
export function agendaChanges(written: ReadonlyMap<string, string>, wanted: ReadonlyMap<string, AgendaEntry[]>): { replace: [string, AgendaEntry[], string][]; remove: string[] } {
  const replace: [string, AgendaEntry[], string][] = [];
  for (const [ref, items] of wanted) {
    const signature = JSON.stringify(items);
    if (written.get(ref) !== signature) replace.push([ref, items, signature]);
  }
  return { replace, remove: [...written.keys()].filter((ref) => !wanted.has(ref)) };
}
