import { describe, expect, test } from 'bun:test';
import { allDayStart } from '@huishouden/pwa-kit/agenda';
import { applyOps as applyKitOps, withoutId, type Op } from '@huishouden/pwa-kit/store';
import { canDo, resolveOps, todoDoc, todoOpsAllowed, type TodoItem, type TodoInput } from '@huishouden/pwa-kit/todos';
import { toYmd } from '@huishouden/pwa-kit/time';
import { createActions, applyOps } from '../data/actions';
import { COLLECTIONS, type DataKey } from '../data/types';
import { DEMO_NOW, demoData, type PetHouseholdData } from './demo';
import { FIELDS, type Course, type Reminder } from './model';
import { dosesOn, slotAt } from './courses';
import { dueState } from './schedule';
import { doseTodos, reminderTodo, todoDoseId, todoItems, todoMedDoseId } from './todos';

// The sample household on its fixed day (May 14, 2031, 10:30): Biscuit's flea and tick is overdue,
// Miso's kidney supplement is due today, and Biscuit is on day 3 of an antibiotic for approved helpers only.
const ORIGIN = 'https://example-pet.web.app';
const ME = 'jo@example.com';
const TODAY = toYmd(DEMO_NOW);

const byRef = (items: TodoInput[]) => new Map(items.map((i) => [i.ref, i]));
const col = Object.fromEntries(Object.entries(COLLECTIONS).map(([k, v]) => [v, k])) as Record<string, DataKey>;
/** The data as the portal's batch leaves it: the todo ops resolved as `ME` at `now` and applied. */
const applyTodoOps = (data: PetHouseholdData, ops: Op[], now: number) =>
  applyKitOps(data, resolveOps(ops, { now, me: ME }), (c: string) => col[c]);
/** As the portal reads it back, to ask who may run it. */
const stored = (input: TodoInput): TodoItem => ({ id: input.ref, ...todoDoc('pet', input, 'sam@example.com', DEMO_NOW) });

/** Pet's own actions over the same data, run as `ME`. */
function app(data: PetHouseholdData, now: number) {
  let d = data;
  let seq = 0;
  const actions = createActions({
    me: ME,
    now: () => now,
    read: () => d,
    newId: (key) => `${key}-${seq++}`,
    write: (ops) => {
      d = applyOps(d, ops);
    },
    contacts: { save: () => {}, remove: () => {}, restore: () => {} },
  });
  return { actions, get data() { return d; } };
}

describe('what Pet publishes', () => {
  const data = demoData();
  const items = todoItems(data, DEMO_NOW, ORIGIN);
  const refs = byRef(items);

  test('care due today or overdue, and today’s doses not yet given; nothing coming up later, given, finished or dismissed', () => {
    expect([...refs.keys()].sort()).toEqual(
      ['dose:demo-course-1:' + TODAY + ':0', 'dose:demo-course-1:' + TODAY + ':1', 'reminder:demo-rem-1', 'reminder:demo-rem-3'].sort(),
    );
    // Heartworm is due in 3 days, the ear drops (a one-off) were given, brushing was dismissed.
    for (const id of ['demo-rem-2', 'demo-rem-9', 'demo-rem-10']) expect(refs.has(`reminder:${id}`)).toBe(false);
    expect(dueState(data.reminders.find((r) => r.id === 'demo-rem-10')!, DEMO_NOW)).toBe('dismissed');
    // Every item would be accepted as stored, and every action writes only Pet's collections.
    for (const i of items) {
      expect(() => todoDoc('pet', i, 'sam@example.com', DEMO_NOW)).not.toThrow();
      expect(todoOpsAllowed('pet', i.done!.ops)).toBe(true);
      expect(todoOpsAllowed('pet', i.cancel!.ops)).toBe(true);
    }
  });

  test('a care reminder: its title, the pet, when it was added and its due day, a link to Care', () => {
    const flea = data.reminders.find((r) => r.id === 'demo-rem-1')!;
    expect(refs.get('reminder:demo-rem-1')).toMatchObject({
      title: 'Flea and tick',
      who: 'Biscuit',
      createdAt: flea.createdAt,
      due: allDayStart(flea.due),
      owner: flea.by,
      url: `${ORIGIN}/pet/?tab=care&pet=${flea.petId}`,
    });
  });

  test('Given for admins, members and helpers; never kids (a dose log). Dismiss for admins, members and whoever added it', () => {
    const flea = refs.get('reminder:demo-rem-1')!;
    expect(flea.done).toMatchObject({ label: 'Given', roles: ['admin', 'member', 'helper'] });
    expect(flea.cancel).toMatchObject({ label: 'Dismiss', roles: ['admin', 'member'], owner: true });
    const item = stored(flea);
    expect(canDo(item, 'done', 'helper', ME)).toBe(true);
    expect(canDo(item, 'done', 'kid', ME)).toBe(false);
    expect(canDo(item, 'cancel', 'helper', ME)).toBe(false);
    expect(canDo(item, 'cancel', 'helper', flea.owner)).toBe(true);
    expect(canDo(item, 'cancel', 'member', ME)).toBe(true);
  });

  test('an "Other" reminder says Done', () => {
    const r: Reminder = { ...data.reminders[0], id: 'r-walk', kind: 'other', title: 'Nail trim', due: TODAY };
    expect(reminderTodo(r, data.pets, DEMO_NOW, ORIGIN)?.done?.label).toBe('Done');
  });

  test('a dose: "Antibiotic for Biscuit", the dose and its time, due at its time, added with the course', () => {
    const course = data.courses.find((c) => c.id === 'demo-course-1')!;
    const morning = refs.get(`dose:demo-course-1:${TODAY}:0`)!;
    expect(morning).toMatchObject({ title: 'Antibiotic for Biscuit', detail: '1 tablet · 9:00 AM', who: 'Biscuit', createdAt: course.createdAt, due: slotAt('09:00', TODAY) });
    expect(morning.done?.label).toBe('Given');
    expect(morning.cancel?.label).toBe('Skip');
  });

  test('a course only approved helpers give: admins, members and those helpers by name; every helper when it allows all; never kids', () => {
    const course = data.courses.find((c) => c.id === 'demo-course-1')!;
    const approved = { ...course, approvedHelpers: [ME] };
    const [item] = doseTodos(approved, data.medDoses, data.pets, DEMO_NOW, ORIGIN);
    expect(item.done).toMatchObject({ roles: ['admin', 'member'], emails: [ME] });
    expect(item.cancel).toMatchObject({ roles: ['admin', 'member'], emails: [ME] });
    expect(canDo(stored(item), 'done', 'helper', ME)).toBe(true);
    expect(canDo(stored(item), 'done', 'helper', 'other-helper@example.com')).toBe(false);
    const [open] = doseTodos({ ...course, givers: 'all' }, data.medDoses, data.pets, DEMO_NOW, ORIGIN);
    expect(open.done?.roles).toEqual(['admin', 'member', 'helper']);
    expect(canDo(stored(open), 'done', 'kid', ME)).toBe(false);
  });

  test('a dose given or skipped in Pet, and one for a pet that is gone, is not published', () => {
    const course = data.courses.find((c) => c.id === 'demo-course-1')!;
    const at = DEMO_NOW - 60_000;
    const given = { id: 'm1', petId: course.petId, courseId: course.id, slot: 0, at, by: ME, createdAt: at };
    const skipped = { ...given, id: 'm2', slot: 1, skipped: true };
    expect(doseTodos(course, [...data.medDoses, given, skipped], data.pets, DEMO_NOW, ORIGIN)).toEqual([]);
    expect(doseTodos(course, data.medDoses, [], DEMO_NOW, ORIGIN)).toEqual([]);
  });
});

describe('running an item does what Pet does', () => {
  const later = DEMO_NOW + 5 * 60_000;

  test('Given on a monthly reminder: a dose logged now by the member, next due a month from today, as giveDose', () => {
    const data = demoData();
    const flea = data.reminders.find((r) => r.id === 'demo-rem-1')!;
    const item = reminderTodo(flea, data.pets, DEMO_NOW, ORIGIN)!;
    expect(item.done!.ops).toEqual([
      { col: 'petDoses', id: todoDoseId(flea.id, flea.due), data: { petId: flea.petId, reminderId: flea.id, title: flea.title, at: '$now', by: '$me', createdAt: '$now' } },
      { col: 'petReminders', id: flea.id, data: { lastDoneAt: '$now', due: '$today+1m', updatedAt: '$now' }, merge: true },
    ]);

    const viaTodo = applyTodoOps(data, item.done!.ops, later);
    const inApp = app(data, later);
    const dose = inApp.actions.giveDose(flea, later);
    expect(viaTodo.reminders.find((r) => r.id === flea.id)).toEqual(inApp.data.reminders.find((r) => r.id === flea.id)!);
    const logged = viaTodo.doses.find((d) => d.id === todoDoseId(flea.id, flea.due))!;
    expect(withoutId(logged)).toEqual(withoutId(inApp.data.doses.find((d) => d.id === dose.id)!));
    for (const k of Object.keys(withoutId(logged))) expect(FIELDS.petDoses as readonly string[]).toContain(k);
  });

  test('Given on a yearly, a weekly and a one-off reminder', () => {
    const data = demoData();
    const base = data.reminders.find((r) => r.id === 'demo-rem-1')!;
    const due = (r: Reminder) => reminderTodo(r, data.pets, DEMO_NOW, ORIGIN)!.done!.ops[1].data;
    expect(due({ ...base, every: 1, unit: 'year' })).toMatchObject({ due: '$today+1y' });
    expect(due({ ...base, every: 2, unit: 'week' })).toMatchObject({ due: '$today+2w' });
    expect(due({ ...base, every: 10, unit: 'day' })).toMatchObject({ due: '$today+10d' });

    // A one-off keeps its due day and is given (finished), as markGiven.
    const { every: _e, unit: _u, lastDoneAt: _l, ...once } = base;
    const ops = reminderTodo(once, data.pets, DEMO_NOW, ORIGIN)!.done!.ops;
    expect(ops[1].data).toEqual({ lastDoneAt: '$now', updatedAt: '$now' });
    const withOnce = { ...data, reminders: data.reminders.map((r) => (r.id === once.id ? once : r)) };
    const viaTodo = applyTodoOps(withOnce, ops, later);
    const inApp = app(withOnce, later);
    inApp.actions.giveDose(once, later);
    const result = viaTodo.reminders.find((r) => r.id === once.id)!;
    expect(result).toEqual(inApp.data.reminders.find((r) => r.id === once.id)!);
    expect(dueState(result, later)).toBe('done');
    expect(reminderTodo(result, data.pets, later, ORIGIN)).toBeNull();
  });

  test('Dismiss: as Pet’s own Dismiss, and the reminder is no longer published', () => {
    const data = demoData();
    const flea = data.reminders.find((r) => r.id === 'demo-rem-1')!;
    const ops = reminderTodo(flea, data.pets, DEMO_NOW, ORIGIN)!.cancel!.ops;
    expect(ops).toEqual([{ col: 'petReminders', id: flea.id, data: { dismissedAt: '$now', updatedAt: '$now' }, merge: true }]);
    const viaTodo = applyTodoOps(data, ops, later);
    const inApp = app(data, later);
    inApp.actions.dismissReminder(flea);
    expect(viaTodo.reminders.find((r) => r.id === flea.id)).toEqual(inApp.data.reminders.find((r) => r.id === flea.id)!);
    expect(todoItems(viaTodo, later, ORIGIN).some((i) => i.ref === 'reminder:demo-rem-1')).toBe(false);
  });

  test('Given and Skip on a dose: the same dose Pet logs (skipped for Skip), under one id per course, day and slot; then not published', () => {
    const data = demoData();
    const course: Course = data.courses.find((c) => c.id === 'demo-course-1')!;
    const ref = `dose:${course.id}:${TODAY}:0`;
    const item = byRef(todoItems(data, DEMO_NOW, ORIGIN)).get(ref)!;
    const id = todoMedDoseId(course.id, TODAY, 0);
    expect(item.done!.ops).toEqual([{ col: 'petMedDoses', id, data: { petId: course.petId, courseId: course.id, slot: 0, at: '$now', by: '$me', createdAt: '$now' } }]);
    expect(item.cancel!.ops).toEqual([{ col: 'petMedDoses', id, data: { petId: course.petId, courseId: course.id, slot: 0, at: '$now', skipped: true, by: '$me', createdAt: '$now' } }]);

    const given = applyTodoOps(data, item.done!.ops, later);
    const inApp = app(data, later);
    const mine = inApp.actions.giveMedDose(course, 0, later);
    expect(withoutId(given.medDoses.find((d) => d.id === id)!)).toEqual(withoutId(mine));
    expect(dosesOn(course, given.medDoses, TODAY, later)[0].status.state).toBe('given');
    expect(todoItems(given, later, ORIGIN).some((i) => i.ref === ref)).toBe(false);

    const skipped = applyTodoOps(data, item.cancel!.ops, later);
    const inApp2 = app(data, later);
    const mySkip = inApp2.actions.skipMedDose(course, 0, later);
    expect(withoutId(skipped.medDoses.find((d) => d.id === id)!)).toEqual(withoutId(mySkip));
    expect(dosesOn(course, skipped.medDoses, TODAY, later)[0].status.state).toBe('skipped');
    expect(todoItems(skipped, later, ORIGIN).some((i) => i.ref === ref)).toBe(false);
    for (const k of Object.keys(withoutId(mySkip))) expect(FIELDS.petMedDoses as readonly string[]).toContain(k);
  });
});
