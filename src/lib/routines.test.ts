import { describe, expect, test } from 'bun:test';
import { reminderDoc } from '@huishouden/pwa-kit/reminders';
import { readSource, sourceAllowed, stillDue, type SourceDocs } from '@huishouden/pwa-kit/reminder-source';
import { applyOps as applyKitOps, withoutId } from '@huishouden/pwa-kit/store';
import { canDo, resolveOps, todoDoc, todoOpsAllowed, type TodoInput, type TodoItem } from '@huishouden/pwa-kit/todos';
import { toYmd } from '@huishouden/pwa-kit/time';
import { applyOps, createActions, type Op } from '../data/actions';
import { COLLECTIONS, type DataKey } from '../data/types';
import { DEMO_NOW, demoData, type PetHouseholdData } from './demo';
import { FIELDS } from './model';
import { routineDoc, routineLogDoc } from './build';
import { routineReminders, routineSource, routinesRef } from './notify';
import { logWindowStart, MAX_LOG_DAYS, petsLabel, presetsFor, routinesOfPet, routinesToday, scheduleText, statusOf } from './routines';
import { routineOps, routineTodos } from './todos';

// The sample household on its fixed day (Wednesday 14 May 2031, 10:30): Miso's litter box is
// scooped every evening (today's still to do), her litter was changed on the 5th (a week later is
// two days ago), and Biscuit is brushed on Sundays and Wednesdays.
const ORIGIN = 'https://example-pet.web.app';
const TODAY = toYmd(DEMO_NOW);
const ME = 'jo@example.com';
const d = demoData();
const routine = (id: string) => d.routines.find((r) => r.id === `demo-routine-${id}`)!;
const miso = d.pets.find((p) => p.name === 'Miso')!;

describe('where the sample routines stand', () => {
  test('the scoop is due, the litter two days overdue, the brush due, the fountain later', () => {
    expect(statusOf(routine('scoop'), d.routineLogs, DEMO_NOW)).toMatchObject({ state: 'due', due: TODAY });
    expect(statusOf(routine('litter'), d.routineLogs, DEMO_NOW)).toMatchObject({ state: 'overdue', due: '2031-05-12', late: 2 });
    expect(statusOf(routine('brush'), d.routineLogs, DEMO_NOW)).toMatchObject({ state: 'due', due: TODAY });
    expect(statusOf(routine('fountain'), d.routineLogs, DEMO_NOW)).toMatchObject({ state: 'later', due: '2031-05-17' });
  });

  test('Today lists the overdue one first, then the rest by name; nothing is done yet', () => {
    const { open, done } = routinesToday(d.routines, d.routineLogs, DEMO_NOW);
    expect(open.map((x) => x.routine.name)).toEqual(['Change litter', 'Brush Biscuit', 'Scoop litter box']);
    expect(done).toEqual([]);
  });

  test('words: pets of a shared routine, how each repeats, and which presets a cat is offered first', () => {
    expect(petsLabel(routine('fountain'), d.pets)).toBe('Miso and Biscuit');
    expect(scheduleText(routine('scoop'))).toBe('Every day');
    expect(scheduleText(routine('litter'))).toContain('counted from when it was last done');
    expect(scheduleText(routine('brush'))).toMatch(/Sunday.*Wednesday/);
    expect(presetsFor('cat').slice(0, 2)).toEqual(['scoop', 'litter']);
    expect(routinesOfPet(d.routines, miso.id).map((r) => r.name)).toEqual(['Change litter', 'Clean water fountain', 'Scoop litter box']);
  });
});

describe('marking a routine done', () => {
  function app(data: PetHouseholdData = demoData()) {
    let state = data;
    const writes: Op[][] = [];
    let seq = 0;
    const actions = createActions({
      me: ME,
      now: () => DEMO_NOW,
      read: () => state,
      newId: (key) => `${key}-${seq++}`,
      write: (ops) => {
        writes.push(ops);
        state = applyOps(state, ops);
      },
      contacts: { save: () => {}, remove: () => {}, restore: () => {} },
    });
    return { actions, writes, get data() { return state; } };
  }
  const keysOk = (writes: Op[][]) => {
    for (const op of writes.flat()) {
      if (!op.data) continue;
      const allowed = FIELDS[COLLECTIONS[op.col]] as readonly string[];
      for (const k of Object.keys(op.data)) expect(allowed).toContain(k);
      for (const v of Object.values(op.data)) expect(v).not.toBeUndefined();
    }
  };

  test('writes the log under the kit’s id, by me today; the next due day counts from today; Undo takes it back', () => {
    const h = app();
    const litter = routine('litter');
    const log = h.actions.markRoutineDone(litter, '2031-05-12', '  Fresh bag  ');
    expect(log).toMatchObject({ id: 'rtn-demo-routine-litter-2031-05-12', routineId: litter.id, due: '2031-05-12', on: TODAY, at: DEMO_NOW, note: 'Fresh bag', by: ME });
    keysOk(h.writes);
    expect(statusOf(litter, h.data.routineLogs, DEMO_NOW)).toMatchObject({ state: 'done', next: '2031-05-21', log: { id: log.id } });
    h.actions.deleteRoutineLogs([log]);
    expect(statusOf(litter, h.data.routineLogs, DEMO_NOW).state).toBe('overdue');
    h.actions.restoreRoutineLogs([log]);
    expect(statusOf(litter, h.data.routineLogs, DEMO_NOW).state).toBe('done');
  });

  test('saving a routine builds only what the rules take, and refuses what they would', () => {
    const h = app();
    const id = h.actions.saveRoutine(null, { name: '  Brush Miso ', kind: 'brush', petIds: [miso.id, miso.id], mode: 'weekdays', days: [4, 1, 4], every: 3, unit: 'week', since: TODAY, remind: true, time: '18:30' });
    keysOk(h.writes);
    expect(h.data.routines.find((r) => r.id === id)).toEqual({ id, name: 'Brush Miso', kind: 'brush', petIds: [miso.id], mode: 'weekdays', days: [1, 4], since: TODAY, remind: true, time: '18:30', createdAt: DEMO_NOW, by: ME });
    expect(() => routineDoc({ name: '', petIds: [miso.id], mode: 'fixed', every: 1, unit: 'day', since: TODAY }, ME, 1)).toThrow();
    expect(() => routineDoc({ name: 'x', petIds: [], mode: 'fixed', every: 1, unit: 'day', since: TODAY }, ME, 1)).toThrow();
    expect(() => routineDoc({ name: 'x', petIds: ['p'], mode: 'weekdays', days: [], since: TODAY }, ME, 1)).toThrow();
    expect(routineLogDoc({ routineId: 'r', due: TODAY, on: TODAY, at: 1.4, note: '  ' }, ME, 1)).toEqual({ routineId: 'r', due: TODAY, on: TODAY, at: 1, by: ME, createdAt: 1 });
  });

  test('deleting a routine takes its history; Undo brings both back', () => {
    const h = app();
    const scoop = routine('scoop');
    const before = h.data.routineLogs.filter((l) => l.routineId === scoop.id).length;
    expect(before).toBeGreaterThan(0);
    const bundle = h.actions.deleteRoutine(scoop);
    expect(h.data.routines.some((r) => r.id === scoop.id)).toBe(false);
    expect(h.data.routineLogs.some((l) => l.routineId === scoop.id)).toBe(false);
    h.actions.restoreRoutine(bundle);
    expect(h.data.routineLogs.filter((l) => l.routineId === scoop.id)).toHaveLength(before);
  });

  test('removing a pet drops the routines only it had and takes it off shared ones; restoring puts them back', () => {
    const h = app();
    const bundle = h.actions.removePet(miso);
    expect(h.data.routines.map((r) => r.id).sort()).toEqual(['demo-routine-brush', 'demo-routine-fountain']);
    expect(h.data.routines.find((r) => r.id === 'demo-routine-fountain')!.petIds).toEqual(['demo-pet-biscuit']);
    expect(h.data.routineLogs.some((l) => l.routineId === 'demo-routine-scoop')).toBe(false);
    keysOk(h.writes);
    h.actions.restorePet(bundle);
    expect(h.data.routines).toHaveLength(4);
    expect(h.data.routines.find((r) => r.id === 'demo-routine-fountain')!.petIds).toEqual([miso.id, 'demo-pet-biscuit']);
    expect(h.data.routineLogs.filter((l) => l.routineId === 'demo-routine-scoop').length).toBeGreaterThan(0);
  });
});

describe('the to-do list', () => {
  const items = routineTodos(d.routines, d.pets, d.routineLogs, DEMO_NOW, ORIGIN);
  const stored = (i: TodoInput): TodoItem => ({ id: i.ref, ...todoDoc('pet', i, 'sam@example.com', DEMO_NOW) });

  test('each open routine, once per due day, with Done for the whole household and no second button', () => {
    expect(items.map((i) => i.ref).sort()).toEqual(['routine:demo-routine-brush:' + TODAY, 'routine:demo-routine-litter:2031-05-12', 'routine:demo-routine-scoop:' + TODAY]);
    const scoop = items.find((i) => i.title === 'Scoop litter box')!;
    expect(scoop).toMatchObject({ who: 'Miso', url: `${ORIGIN}/pet/` });
    expect(scoop.cancel).toBeUndefined();
    for (const i of items) {
      expect(() => todoDoc('pet', i, 'sam@example.com', DEMO_NOW)).not.toThrow();
      expect(todoOpsAllowed('pet', i.done!.ops)).toBe(true);
      for (const role of ['admin', 'member', 'helper', 'kid'] as const) expect(canDo(stored(i), 'done', role, ME)).toBe(true);
    }
  });

  test('Done writes the same log Pet’s Mark done does, by whoever taps; the item leaves once done', () => {
    const scoop = routine('scoop');
    const col = Object.fromEntries(Object.entries(COLLECTIONS).map(([k, v]) => [v, k])) as Record<string, DataKey>;
    const after = applyKitOps(d, resolveOps(routineOps(scoop, TODAY), { now: DEMO_NOW, me: ME }), (c: string) => col[c]);
    const log = after.routineLogs.find((l) => l.id === `rtn-${scoop.id}-${TODAY}`)!;
    expect(withoutId(log)).toEqual({ routineId: scoop.id, due: TODAY, on: TODAY, at: DEMO_NOW, by: ME, createdAt: DEMO_NOW });
    expect(statusOf(scoop, after.routineLogs, DEMO_NOW).state).toBe('done');
    expect(routineTodos(after.routines, after.pets, after.routineLogs, DEMO_NOW, ORIGIN).some((i) => i.title === 'Scoop litter box')).toBe(false);
  });
});

describe('reminders', () => {
  const scoop = routine('scoop');
  const people = ['sam@example.com', 'jo@example.com'];

  test('none until reminders are on; then one per unlogged due day still to come, at the routine’s time, to the people given', () => {
    expect(routineReminders(routine('litter'), d.pets, d.routineLogs, DEMO_NOW, people)).toEqual([]);
    const list = routineReminders(scoop, d.pets, d.routineLogs, DEMO_NOW, people);
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ app: 'pet', title: 'Scoop litter box · Miso', at: new Date(2031, 4, 14, 19, 0).getTime(), recipients: people, ref: routinesRef(scoop.id) });
    expect(list[1].at).toBe(new Date(2031, 4, 15, 19, 0).getTime());
    for (const r of list) expect(() => reminderDoc(r, 'sam@example.com', DEMO_NOW)).not.toThrow();
  });

  test('past the reminder’s time, or once the day is done, there is none for it', () => {
    expect(routineReminders(scoop, d.pets, d.routineLogs, new Date(2031, 4, 14, 20, 0).getTime(), people)).toHaveLength(1);
    const done = { id: 'l', routineId: scoop.id, due: TODAY, on: TODAY, at: DEMO_NOW, by: ME, createdAt: DEMO_NOW };
    expect(routineReminders(scoop, d.pets, [...d.routineLogs, done], DEMO_NOW, people)).toHaveLength(1);
  });

  test('the sender drops it once the routine is done anywhere, or the routine is gone', () => {
    const source = routineSource(scoop.id, TODAY);
    expect(sourceAllowed('pet', source, 'helen@example.com', 'helper', new Map())).toBe(true);
    expect(readSource('pet', source)).toEqual(source);
    const docs = (entries: Record<string, Record<string, unknown> | null>): SourceDocs => new Map(Object.entries(entries));
    const log = `petRoutineLogs/rtn-${scoop.id}-${TODAY}`;
    expect(stillDue(source, docs({ [`petRoutines/${scoop.id}`]: { name: 'x' }, [log]: null }))).toBe(true);
    expect(stillDue(source, docs({ [`petRoutines/${scoop.id}`]: { name: 'x' }, [log]: { by: ME } }))).toBe(false);
    expect(stillDue(source, docs({ [`petRoutines/${scoop.id}`]: null, [log]: null }))).toBe(false);
  });
});

describe('which routine logs are read', () => {
  const NOW = new Date(2031, 4, 14, 10, 30).getTime();
  const daysBack = (n: number) => new Date(2031, 4, 14 - n).getTime();
  test('two weeks with no routines or a daily one; the slowest routine\'s history otherwise', () => {
    expect(logWindowStart([], NOW)).toBe(daysBack(15));
    expect(logWindowStart([{ mode: 'fixed', every: 1, unit: 'day' }], NOW)).toBe(daysBack(15));
    expect(logWindowStart([{ mode: 'fixed', every: 1, unit: 'day' }, { mode: 'after-done', every: 1, unit: 'week' }], NOW)).toBe(daysBack(98));
    expect(logWindowStart([{ mode: 'weekdays' }], NOW)).toBe(daysBack(98));
  });
  test(`never more than ${MAX_LOG_DAYS} days`, () => {
    expect(logWindowStart([{ mode: 'after-done', every: 3, unit: 'month' }], NOW)).toBe(daysBack(MAX_LOG_DAYS));
  });
});
