import type { Firestore } from 'firebase/firestore';
import { localizeAgenda, removeAgenda, replaceAgenda, syncAgenda } from '@huishouden/pwa-kit/agenda';
import { localizeTodos, syncTodos } from '@huishouden/pwa-kit/todos';
import { cancelReminders, localizeReminders, replaceReminders, syncReminders } from '@huishouden/pwa-kit/reminders';
import { AGENDA_APP, agendaByRef, agendaChanges, type AgendaData } from '../lib/agenda';
import { todoItems } from '../lib/todos';
import { APP, reminderChanges, reminderInputs, remindersByRef, type ReminderSourceData } from '../lib/notify';

type Published = NonNullable<Parameters<typeof syncAgenda>[4]['published']>;

export interface PublishOptions {
  /** A helper's or kid's device: only what isn't private. */
  restricted?: boolean;
  /** Where this device notes what it last published (default localStorage; null reads every time). */
  published?: Published | null;
}

const pub = (published: Published | null | undefined) => (published === undefined ? {} : { published });

/**
 * Makes Pet's reminders exactly what its data asks for, on open and when the day turns: one query
 * of the app's reminders (none when this device published the same a short while ago), then only
 * what changed is written. In every member's language (`localizeReminders`).
 */
export async function publishReminders(db: Firestore, householdId: string, me: string, data: ReminderSourceData, now: number, outers: string[], { restricted = false, published }: PublishOptions = {}) {
  return syncReminders(db, householdId, APP, await localizeReminders(() => reminderInputs(data, now, outers)), me, now, { restricted, ...pub(published) });
}

/**
 * After a change: the reminders of each record whose reminders changed since `written` (what this
 * device last wrote, by ref), replaced, and those of each record that is gone, cancelled; one query
 * each, so a meal fed costs that pet's meal reminders, not all of Pet's. A failed ref is left as it
 * was in `written`, so the next change retries it. Returns how many failed.
 */
export async function publishReminderChanges(
  db: Firestore,
  householdId: string,
  me: string,
  written: Map<string, string>,
  data: ReminderSourceData,
  now: number,
  outers: string[],
  { restricted = false }: { restricted?: boolean } = {},
) {
  const { replace, remove } = reminderChanges(written, remindersByRef(data, now, outers));
  let failed = 0;
  await Promise.all([
    ...replace.map(async ([ref, build, signature]) => {
      written.set(ref, signature);
      try {
        await replaceReminders(db, householdId, ref, await localizeReminders(build), me, now, { restricted });
      } catch {
        written.delete(ref);
        failed++;
      }
    }),
    ...remove.map(async (ref) => {
      try {
        await cancelReminders(db, householdId, ref, { restricted });
        written.delete(ref);
      } catch {
        failed++;
      }
    }),
  ]);
  return { replaced: replace.length, removed: remove.length, failed };
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
 * each. `written` follows what was written; a failed ref (replaced or removed) is left as it was,
 * so the next change retries it.
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
      try {
        await removeAgenda(db, householdId, AGENDA_APP, ref, { restricted });
        written.delete(ref);
      } catch (e) {
        onError?.(e);
      }
    }),
  ]);
  return { replaced: replace.length, removed: remove.length };
}
