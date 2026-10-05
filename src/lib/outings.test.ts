import { describe, expect, test } from 'bun:test';
import { addDays, toYmd } from '@huishouden/pwa-kit/time';
import type { Meal, Outing, OutingPlan, Pet } from './model';
import { FIELDS } from './model';
import { outingDoc, outingPlanDoc } from './build';
import { dayCounts, history, outingFlag, outingId, outingWhat, poopLine, slotsOf, slotsOn, underStreak, walkLine } from './outings';
import { outingReminders, outingSource } from './notify';
import { outingAgenda } from './agenda';
import { outingTodos } from './todos';
import { createActions, applyOps, type Backend } from '../data/actions';
import { emptyData, type PetHouseholdData } from './demo';

const at = (day: number, hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(2031, 4, day, h, m).getTime();
};
const NOW = at(14, '10:30');
const TODAY = toYmd(NOW);
const TOMORROW = toYmd(addDays(NOW, 1));
const theo: Pet = { id: 'theo', name: 'Theo', species: 'dog', weightUnit: 'lb', createdAt: 1, by: 'sam@example.com' };
const meals: Meal[] = [
  { id: 'theo-pm', petId: 'theo', name: 'Dinner', time: '18:00', createdAt: 1, by: 'sam@example.com' },
  { id: 'theo-am', petId: 'theo', name: 'Breakfast', time: '08:00', createdAt: 1, by: 'sam@example.com' },
  { id: 'other-am', petId: 'other', name: 'AM', time: '09:00', createdAt: 1, by: 'sam@example.com' },
];
const plan: OutingPlan = { id: 'theo', on: true, mode: 'meals', poopMin: 2, flagDays: 3, remind: true, createdAt: 1, by: 'sam@example.com' };
let n = 0;
const outing = (when: number, poop: boolean, extra: Partial<Outing> = {}): Outing => ({ id: `o${++n}`, petId: 'theo', at: when, pee: true, poop, by: 'jo@example.com', createdAt: when, ...extra });

describe('scheduled outings', () => {
  test('with meals: one per meal of the pet, earliest first, named after the meal', () => {
    expect(slotsOf(plan, meals).map((s) => [s.key, s.time, s.label])).toEqual([
      ['meal-theo-am', '08:00', 'Breakfast'],
      ['meal-theo-pm', '18:00', 'Dinner'],
    ]);
  });

  test('set times and every few hours come from the kit, named by the time; none while off', () => {
    expect(slotsOf({ ...plan, mode: 'times', times: ['18:00', '07:30', '18:00'] }, meals).map((s) => s.key)).toEqual(['t-0730', 't-1800']);
    expect(slotsOf({ ...plan, mode: 'every', every: 6 }, meals).map((s) => s.time)).toEqual(['07:00', '13:00', '19:00']);
    expect(slotsOf({ ...plan, on: false }, meals)).toEqual([]);
    expect(slotsOf(undefined, meals)).toEqual([]);
  });

  test("today: done by the slot's outing (its own id, or one naming the slot), late once its time passed", () => {
    const am = { ...outing(at(14, '07:40'), true, { slot: 'meal-theo-am' }), id: outingId('theo', TODAY, 'meal-theo-am') };
    expect(slotsOn(plan, meals, [am], NOW, NOW).map((s) => [s.slot.label, s.status.state])).toEqual([['Breakfast', 'done'], ['Dinner', 'due']]);
    expect(slotsOn(plan, meals, [], NOW, at(14, '18:30')).map((s) => s.status.state)).toEqual(['late', 'late']);
    expect(slotsOn(plan, meals, [outing(at(14, '07:45'), false, { slot: 'meal-theo-am' })], NOW, NOW)[0].status.state).toBe('done');
    // Yesterday's outing for the slot doesn't tick today's, and a walk without a slot ticks none.
    expect(slotsOn(plan, meals, [outing(at(13, '07:45'), true, { slot: 'meal-theo-am' }), { ...outing(at(14, '07:50'), false), pee: undefined, poop: undefined, walkMin: 20 }], NOW, NOW)[0].status.state).toBe('late');
  });
});

describe('poops a day, the minimum, walks and the flag', () => {
  const days = (counts: number[]) =>
    counts.flatMap((poops, i) => {
      const day = 13 - i;
      return poops < 0 ? [] : [outing(at(day, '08:00'), poops >= 1), outing(at(day, '18:00'), poops >= 2)];
    });

  test('counts, walk minutes and the 14-day strip', () => {
    const list = [outing(at(14, '07:40'), true), outing(at(14, '12:00'), false, { walkMin: 20 }), { ...outing(at(14, '15:00'), false), pee: undefined, poop: undefined, walkMin: 15 }];
    expect(dayCounts(list, 'theo', NOW)).toEqual({ day: TODAY, outings: 3, poops: 1, walkMin: 35 });
    const strip = history(list, 'theo', NOW);
    expect(strip).toHaveLength(14);
    expect(strip[13].day).toBe(TODAY);
    expect(strip[0].day).toBe(toYmd(addDays(NOW, -13)));
    expect(poopLine(1, 2)).toBe('1 of 2 poops today');
    expect(poopLine(1, undefined)).toBe('1 poop today');
    expect(walkLine(20, 30)).toBe('20 of 30 min walked');
    expect(walkLine(20, undefined)).toBe('20 min walked');
    expect(walkLine(0, undefined)).toBeNull();
  });

  test('a short yesterday is a gentle note; days in a row under the minimum say to call the vet; an untracked day ends the run', () => {
    expect(outingFlag(theo, plan, days([2, 2]), NOW)).toBeNull();
    expect(outingFlag(theo, plan, days([1, 2]), NOW)).toEqual({ level: 'yesterday', text: 'Theo pooped 1 of 2 yesterday. Keep an eye on today.' });
    expect(underStreak(plan, days([1, 1, 0, 2]), NOW)).toBe(3);
    expect(outingFlag(theo, plan, days([1, 1, 0, 2]), NOW)?.level).toBe('vet');
    expect(outingFlag(theo, plan, days([1, 1, 0, 2]), NOW)?.text).toContain('3 days running');
    expect(underStreak(plan, days([1, -1, 1, 1]), NOW)).toBe(1);
    expect(outingFlag(theo, { ...plan, poopMin: undefined }, days([0, 0]), NOW)).toBeNull();
  });

  test('what an outing was', () => {
    expect(outingWhat({ pee: true, poop: true })).toBe('Pooped');
    expect(outingWhat({ pee: true, poop: false })).toBe('Pee only');
    expect(outingWhat({ walkMin: 20 })).toBe('Walk · 20 min');
    expect(outingWhat({ pee: true, poop: true, walkMin: 30 })).toBe('Pooped · walk 30 min');
  });
});

describe('the documents', () => {
  test('a plan keeps exactly the fields the rules accept, clamped; no walk goal unless set', () => {
    const doc = outingPlanDoc({ on: true, mode: 'times', times: ['18:00', 'x', '07:00'], every: 40, poopMin: 99, flagDays: 0, remind: false, walkGoal: 0 }, 'sam@example.com', 5);
    expect(doc).toEqual({ on: true, mode: 'times', times: ['07:00', '18:00'], every: 12, poopMin: 10, flagDays: 1, createdAt: 5, by: 'sam@example.com' });
    for (const k of Object.keys(outingPlanDoc({ on: true, mode: 'every', every: 3, from: '07:00', to: '20:00', poopMin: 2, flagDays: 2, remind: true, walkGoal: 30 }, 'a', 1, 2))) expect(FIELDS.petOutingPlans as readonly string[]).toContain(k);
  });

  test('an outing: a walk on its own has no bathroom fields; the assistant request id is kept', () => {
    expect(outingDoc({ petId: 'theo', at: 10.4, walkMin: 20, note: '  park  ' }, 'jo@example.com', 11)).toEqual({ petId: 'theo', at: 10, walkMin: 20, note: 'park', by: 'jo@example.com', createdAt: 11 });
    const full = outingDoc({ petId: 'theo', slot: 'meal-theo-am', at: 1, pee: true, poop: false, walkMin: 10, note: 'x', req: 'abc' }, 'a', 1, 2);
    for (const k of Object.keys(full)) expect(FIELDS.petOutings as readonly string[]).toContain(k);
  });

  test('logging a scheduled outing writes the id the to-do and the reminder name; an extra one or a walk gets a new id', () => {
    let d: PetHouseholdData = emptyData();
    const b: Backend = { me: 'jo@example.com', now: () => NOW, read: () => d, newId: (k) => `${k}-1`, write: (ops) => { d = applyOps(d, ops); }, contacts: { save: () => {}, remove: () => {}, restore: () => {} } };
    const actions = createActions(b);
    const o = actions.logOuting({ petId: 'theo', slot: 'meal-theo-am', at: at(14, '07:40'), pee: true, poop: true });
    expect(o.id).toBe(`out-theo-${TODAY}-meal-theo-am`);
    expect(actions.logOuting({ petId: 'theo', at: NOW, walkMin: 20 }).id).toBe('outings-1');
    expect(d.outings).toHaveLength(2);
    actions.deleteOutings([o]);
    expect(d.outings.map((x) => x.id)).toEqual(['outings-1']);
    const before = actions.saveOutingPlan('theo', { on: true, mode: 'meals', poopMin: 2 });
    expect(before).toBeUndefined();
    expect(d.outingPlans[0]).toMatchObject({ id: 'theo', on: true, poopMin: 2, by: 'jo@example.com' });
    actions.restoreOutingPlan('theo', before);
    expect(d.outingPlans).toEqual([]);
  });
});

describe('what goes out of the app', () => {
  const am = { ...outing(at(14, '07:40'), true, { slot: 'meal-theo-am' }), id: outingId('theo', TODAY, 'meal-theo-am') };

  test('reminders: the outings still to come today and tomorrow, each cancelled once its outing is logged anywhere', () => {
    const list = outingReminders(theo, plan, meals, [am], NOW, ['sam@example.com', 'jo@example.com']);
    expect(list.map((r) => [r.title, r.at])).toEqual([
      ['Take Theo out · Dinner', at(14, '18:00')],
      ['Take Theo out · Breakfast', at(15, '08:00')],
      ['Take Theo out · Dinner', at(15, '18:00')],
    ]);
    expect(list[0].recipients).toEqual(['sam@example.com', 'jo@example.com']);
    expect(list[0].source).toEqual(outingSource('theo', TODAY, 'meal-theo-pm'));
    expect(list[0].source).toEqual({
      checks: [
        { doc: 'petOutingPlans/theo', due: [{ field: 'on', in: [true] }] },
        { doc: `petOutings/out-theo-${TODAY}-meal-theo-pm`, absent: true },
      ],
    });
    expect(outingReminders(theo, { ...plan, remind: false }, meals, [], NOW, 'all')).toEqual([]);
  });

  test('agenda: today and tomorrow, done with how once logged', () => {
    const items = outingAgenda(theo, plan, meals, [am], NOW, 'https://example.web.app');
    expect(items.map((i) => [i.ref, i.items[0].title, i.items[0].status, i.items[0].detail ?? null])).toEqual([
      [`outing:theo:meal-theo-am:${TODAY}`, 'Take Theo out · Breakfast', 'done', 'Pooped'],
      [`outing:theo:meal-theo-pm:${TODAY}`, 'Take Theo out · Dinner', 'upcoming', null],
      [`outing:theo:meal-theo-am:${TOMORROW}`, 'Take Theo out · Breakfast', 'upcoming', null],
      [`outing:theo:meal-theo-pm:${TOMORROW}`, 'Take Theo out · Dinner', 'upcoming', null],
    ]);
    expect(items[0].items[0].kind).toBe('task');
  });

  test('to-do: each outing not yet logged today, Pooped and Pee only writing the same outing, for anyone in the household', () => {
    const [item] = outingTodos(theo, plan, meals, [am], NOW, 'https://example.web.app');
    expect(item.title).toBe('Take Theo out · Dinner');
    expect(item.done?.label).toBe('Pooped');
    expect(item.cancel?.label).toBe('Pee only');
    expect(item.done?.roles).toEqual(['admin', 'member', 'helper', 'kid']);
    expect(item.done?.ops).toEqual([{ col: 'petOutings', id: `out-theo-${TODAY}-meal-theo-pm`, data: { petId: 'theo', slot: 'meal-theo-pm', at: '$now', pee: true, poop: true, by: '$me', createdAt: '$now' } }]);
    expect(item.cancel?.ops[0].data).toMatchObject({ poop: false, pee: true });
    expect(outingTodos(theo, { ...plan, on: false }, meals, [], NOW)).toEqual([]);
  });
});
