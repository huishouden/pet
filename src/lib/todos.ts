// What Pet puts on the household's to-do list (households/{id}/todos, the portal's To-do tab): care
// reminders due today or overdue, and each of today's medicine doses not yet given or skipped. Each
// carries the writes Pet's own Given / Dismiss / Skip make, so the portal can do them without Pet.
// Pure: every function takes `now`.

import { allDayStart } from '@huishouden/pwa-kit/agenda';
import type { Role } from '@huishouden/pwa-kit/roles';
import type { Op } from '@huishouden/pwa-kit/store';
import type { TodoAction, TodoInput } from '@huishouden/pwa-kit/todos';
import { formatTime, parseYmd, toYmd } from '@huishouden/pwa-kit/time';
import type { Course, MedDose, Pet, Reminder } from './model';
import { LIMITS } from './model';
import { dosesOn, slotAt } from './courses';
import { dueState, isRecurring, type Unit } from './schedule';
import { forPet, reminderRef, doseRef, tabUrl, type AgendaData } from './agenda';
import { APP_ORIGIN } from './notify';
import { COLLECTIONS } from '../data/types';

export type TodoData = Pick<AgendaData, 'pets' | 'reminders' | 'courses' | 'medDoses'>;

const STAFF: Role[] = ['admin', 'member'];
// Given logs a dose in petDoses, which the rules never let a kid write, whatever the reminder's kind
// (Pet's own Given is the same: `givesCare`).
const GIVERS: Role[] = ['admin', 'member', 'helper'];
const UNIT_LETTER: Record<Unit, string> = { day: 'd', week: 'w', month: 'm', year: 'y' };

/** The id of the dose a to-do's Given logs: one per reminder and due day, so running it twice writes one dose. */
export const todoDoseId = (reminderId: string, due: string) => `todo-${reminderId}-${due}`;
/** The id of the medicine dose a to-do's Given or Skip logs: one per course, day and slot. */
export const todoMedDoseId = (courseId: string, day: string, slot: number) => `todo-${courseId}-${day}-${slot}`;

/**
 * Given on a care reminder, as `giveDose` writes it: a dose logged now by whoever taps, and the
 * reminder's `lastDoneAt` now and (repeating) its next due day counted from today, as `markGiven`.
 * A one-off keeps its due day and is finished.
 */
export function reminderDoneOps(r: Reminder): Op[] {
  const next = isRecurring(r) ? { due: `$today+${r.every}${UNIT_LETTER[r.unit]}` } : {};
  return [
    {
      col: COLLECTIONS.doses,
      id: todoDoseId(r.id, r.due),
      data: { petId: r.petId, reminderId: r.id, title: r.title.trim().slice(0, LIMITS.reminderTitle), at: '$now', by: '$me', createdAt: '$now' },
    },
    { col: COLLECTIONS.reminders, id: r.id, data: { lastDoneAt: '$now', ...next, updatedAt: '$now' }, merge: true },
  ];
}

/** Dismiss on a care reminder, as Pet's own Dismiss. */
export const reminderDismissOps = (r: Reminder): Op[] => [{ col: COLLECTIONS.reminders, id: r.id, data: { dismissedAt: '$now', updatedAt: '$now' }, merge: true }];

/**
 * Given (or Skip, `skipped`) on one dose of a course, logged at the slot's own time on its own day,
 * as Pet's tick on an earlier day. Not '$now': an item still listed the next morning (before any
 * device has opened Pet that day) must log the dose it was for, never mark today's as given.
 */
export function medDoseOps(c: Course, day: string, slot: number, skipped = false): Op[] {
  const at = slotAt(c.times[slot], day);
  return [
    {
      col: COLLECTIONS.medDoses,
      id: todoMedDoseId(c.id, day, slot),
      data: { petId: c.petId, courseId: c.id, slot, at, ...(skipped ? { skipped: true } : {}), by: '$me', createdAt: at },
    },
  ];
}

/** Who may give a course's doses, as the rules' `mayGive`: helpers only when it allows them all, else the approved ones by name. Never kids. */
function courseRights(c: Course): Pick<TodoAction, 'roles' | 'emails'> {
  if (c.givers === 'approved') return { roles: STAFF, ...(c.approvedHelpers?.length ? { emails: c.approvedHelpers } : {}) };
  return { roles: GIVERS };
}

/** A care reminder due today or overdue, as Today's "Needs doing" shows it; none when dismissed, given or for no pet. */
export function reminderTodo(r: Reminder, pets: Pick<Pet, 'id' | 'name'>[], now: number, origin = APP_ORIGIN): TodoInput | null {
  const state = dueState(r, now);
  const pet = pets.find((p) => p.id === r.petId);
  const due = parseYmd(r.due);
  if ((state !== 'overdue' && state !== 'today') || !pet || due === null || !r.title.trim()) return null;
  return {
    ref: reminderRef(r.id),
    title: r.title.trim(),
    createdAt: r.createdAt,
    due: allDayStart(r.due),
    who: pet.name.trim(),
    url: tabUrl('care', r.petId, origin),
    owner: r.by,
    done: { label: r.kind === 'other' ? 'Done' : 'Given', ops: reminderDoneOps(r), roles: GIVERS },
    cancel: { label: 'Dismiss', ops: reminderDismissOps(r), roles: STAFF, owner: true },
  };
}

/** Today's doses of a course not yet given or skipped, one item per dose time. */
export function doseTodos(c: Course, medDoses: MedDose[], pets: Pick<Pet, 'id' | 'name'>[], now: number, origin = APP_ORIGIN): TodoInput[] {
  const pet = pets.find((p) => p.id === c.petId);
  if (!pet || !c.name.trim()) return [];
  const day = toYmd(now);
  const rights = courseRights(c);
  return dosesOn(c, medDoses, day, now)
    .filter(({ status }) => status.state === 'due' || status.state === 'missed')
    .map(({ slot, time }) => {
      const at = slotAt(time, day);
      return {
        ref: doseRef(c.id, day, slot),
        title: forPet(c.name, pet.name.trim()),
        detail: [c.dose.trim(), formatTime(at)].filter(Boolean).join(' · '),
        createdAt: c.createdAt,
        due: at,
        who: pet.name.trim(),
        url: tabUrl('today', undefined, origin),
        owner: c.by,
        done: { label: 'Given', ops: medDoseOps(c, day, slot), ...rights },
        cancel: { label: 'Skip', ops: medDoseOps(c, day, slot, true), ...rights },
      };
    });
}

/** Everything Pet publishes to the to-do list, for `syncTodos`. */
export function todoItems(data: TodoData, now: number, origin = APP_ORIGIN): TodoInput[] {
  const out: TodoInput[] = [];
  for (const r of data.reminders) {
    const item = reminderTodo(r, data.pets, now, origin);
    if (item) out.push(item);
  }
  for (const c of data.courses) out.push(...doseTodos(c, data.medDoses, data.pets, now, origin));
  return out;
}
