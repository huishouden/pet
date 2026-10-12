import type { Firestore } from 'firebase/firestore';
import { localizeAgenda, removeAgenda, replaceAgenda, syncAgenda } from '@huishouden/pwa-kit/agenda';
import { localizeTodos, syncTodos } from '@huishouden/pwa-kit/todos';
import { localizeReminders, syncReminders, type ReminderInput } from '@huishouden/pwa-kit/reminders';
import { AGENDA_APP, agendaByRef, agendaChanges, type AgendaData } from '../lib/agenda';
import { todoItems } from '../lib/todos';
import { APP, birthdayReminders, courseReminders, mealReminders, outingReminders, routineReminders } from '../lib/notify';
import type { PetHouseholdData } from '../lib/demo';

type Published = NonNullable<Parameters<typeof syncAgenda>[4]['published']>;

export interface PublishOptions {
  /** A helper's or kid's device: only what isn't private. */
  restricted?: boolean;
  /** Where this device notes what it last published (default localStorage; null reads every time). */
  published?: Published | null;
}

const pub = (published: Published | null | undefined) => (published === undefined ? {} : { published });

/**
 * Pet's push reminders for the household: each course's remaining doses, each pet's untaken meal
 * cut-offs, next birthday and outings, and each care routine's due days. `outers` are the members
 * who may take a pet out (everyone but kids).
 */
export function reminderInputs(data: PetHouseholdData, now: number, outers: string[]): ReminderInput[] {
  return [
    ...data.courses.flatMap((c) => courseReminders(c, data.pets.find((p) => p.id === c.petId), data.medDoses, now)),
    ...data.pets.flatMap((p) => mealReminders(p, data.meals, data.feedings, now)),
    ...data.pets.flatMap((p) => birthdayReminders(p, now)),
    ...(outers.length ? data.pets.flatMap((p) => outingReminders(p, data.outingPlans.find((x) => x.id === p.id), data.meals, data.outings, now, outers)) : []),
    ...(outers.length ? data.routines.flatMap((r) => routineReminders(r, data.pets, data.routineLogs, now, outers)) : []),
  ];
}

/**
 * Makes Pet's reminders exactly what its data asks for: one query of the app's reminders (none
 * when this device published the same a short while ago), then only what changed is written. In
 * every member's language (`localizeReminders`).
 */
export async function publishReminders(db: Firestore, householdId: string, me: string, data: PetHouseholdData, now: number, outers: string[], { restricted = false, published }: PublishOptions = {}) {
  return syncReminders(db, householdId, APP, await localizeReminders(() => reminderInputs(data, now, outers)), me, now, { restricted, ...pub(published) });
}

/** The household to-do list's Pet items: one query of what Pet published (none when unchanged). */
export async function publishTodos(db: Firestore, householdId: string, me: string, data: AgendaData, now: number, { restricted = false, published }: PublishOptions = {}) {
  return syncTodos(db, householdId, AGENDA_APP, await localizeTodos(() => todoItems(data, now)), { by: me, now, restricted, ...pub(published) });
}

/** Every agenda item Pet publishes, repairing what another device left: one query (none when unchanged). */
export async function publishAgenda(db: Firestore, householdId: string, me: string, data: AgendaData, now: number, { restricted = false, published }: PublishOptions = {}) {
  const all = () => [...agendaByRef(data, now)].flatMap(([ref, list]) => list.map((i) => ({ ...i, ref })));
  return syncAgenda(db, householdId, AGENDA_APP, await localizeAgenda(all), { by: me, now, restricted, ...pub(published) });
}

/**
 * After a change: the agenda items of each record whose items changed since `written` (what this
 * device last wrote, by ref), replaced, and those of each record that is gone, removed; one query
 * each. `written` follows what was written; a failed ref leaves it, so the next change retries.
 */
export async function publishAgendaChanges(
  db: Firestore,
  householdId: string,
  me: string,
  written: Map<string, string>,
  data: AgendaData,
  now: number,
  { restricted = false, onError }: { restricted?: boolean; onError?: (e: unknown) => void } = {},
) {
  const wanted = agendaByRef(data, now);
  const { replace, remove } = agendaChanges(written, wanted);
  await Promise.all([
    ...replace.map(async ([ref, , signature]) => {
      written.set(ref, signature);
      try {
        await replaceAgenda(db, householdId, AGENDA_APP, ref, await localizeAgenda(() => agendaByRef(data, now).get(ref) ?? []), { by: me, now, restricted });
      } catch (e) {
        written.delete(ref);
        onError?.(e);
      }
    }),
    ...remove.map(async (ref) => {
      written.delete(ref);
      try {
        await removeAgenda(db, householdId, AGENDA_APP, ref, { restricted });
      } catch (e) {
        onError?.(e);
      }
    }),
  ]);
  return { replaced: replace.length, removed: remove.length };
}
