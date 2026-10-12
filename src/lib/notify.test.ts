import { describe, expect, test } from 'bun:test';
import { mergedReminderText, reminderDoc, reminderMergeKey } from '@huishouden/pwa-kit/reminders';
import { DEMO_NOW, demoData } from './demo';
import { birthdayReminders, courseRef, courseReminders, mealReminders, mealsRef, petUrl, reminderChanges, reminderSignatures, remindersByRef, routinesRef } from './notify';
import { readSource, sourceAllowed, stillDue } from '@huishouden/pwa-kit/reminder-source';
import { doseTodos } from './todos';
import { mealAt } from './feeding';

const d = demoData();
const biscuit = d.pets.find((p) => p.name === 'Biscuit')!;
const miso = d.pets.find((p) => p.name === 'Miso')!;
const antibiotic = d.courses.find((c) => c.name === 'Antibiotic')!;

describe('medicine course reminders', () => {
  test('one per remaining dose, titled with the pet, linking to its page', () => {
    const list = courseReminders(antibiotic, biscuit, d.medDoses, DEMO_NOW);
    // Day 3 of 7 at 10:30: today's PM, then two a day through the 18th.
    expect(list).toHaveLength(9);
    expect(list[0]).toMatchObject({ app: 'pet', title: 'Biscuit: Antibiotic', at: mealAt('19:00', DEMO_NOW), url: petUrl(biscuit.id) });
    expect(list[0].body).toContain('1 tablet');
    expect(list[0].body).toContain('with food');
    expect(new Set(list.map((r) => r.id)).size).toBe(list.length);
    for (const r of list) expect(r.id!.startsWith(courseRef(antibiotic.id).replace(/[^A-Za-z0-9_-]+/g, '_'))).toBe(true);
    for (const r of list) expect(() => reminderDoc(r, 'sam@example.com', DEMO_NOW)).not.toThrow();
  });

  test('a dose ticked early today drops its reminder', () => {
    const early = { id: 'x', petId: biscuit.id, courseId: antibiotic.id, slot: 1, at: DEMO_NOW, by: 'sam@example.com', createdAt: DEMO_NOW };
    const list = courseReminders(antibiotic, biscuit, [...d.medDoses, early], DEMO_NOW);
    expect(list).toHaveLength(8);
    expect(list.some((r) => r.at === mealAt('19:00', DEMO_NOW))).toBe(false);
  });

  test('a finished course has none', () => {
    const finished = d.courses.find((c) => c.name === 'Anti-nausea')!;
    expect(courseReminders(finished, miso, d.medDoses, DEMO_NOW)).toEqual([]);
  });
});

describe('meal reminders', () => {
  test('at each untaken cut-off ahead: today’s PM and tomorrow’s AM and PM', () => {
    const list = mealReminders(biscuit, d.meals, d.feedings, DEMO_NOW);
    expect(list.map((r) => r.title)).toEqual(['Biscuit: PM not fed yet', 'Biscuit: AM not fed yet', 'Biscuit: PM not fed yet']);
    expect(list.every((r) => r.ref === mealsRef(biscuit.id) && r.at > DEMO_NOW)).toBe(true);
  });

  test('a cut-off already passed is not re-sent; ticking a meal removes its nudge', () => {
    const before = mealReminders(miso, d.meals, d.feedings, DEMO_NOW);
    expect(before.map((r) => r.title)).toEqual(['Miso: PM not fed yet', 'Miso: AM not fed yet', 'Miso: PM not fed yet']);
    const pmFed = { id: 'f', petId: miso.id, mealId: `${miso.id}-pm`, at: DEMO_NOW, by: 'sam@example.com', createdAt: DEMO_NOW };
    expect(mealReminders(miso, d.meals, [...d.feedings, pmFed], DEMO_NOW)).toHaveLength(2);
  });

  test('two pets not fed at the same meal and minute: one notification, "Biscuit and Miso: PM not fed yet"', () => {
    const [b] = mealReminders(biscuit, d.meals, d.feedings, DEMO_NOW);
    const [m] = mealReminders(miso, d.meals, d.feedings, DEMO_NOW);
    expect(b.at).toBe(m.at);
    const all = (r: typeof b) => ({ ...r, recipients: 'all' as const });
    expect(reminderMergeKey(all(b))).toBe(reminderMergeKey(all(m)));
    expect(mergedReminderText([all(m), all(b)], 'en').title).toBe('Biscuit and Miso: PM not fed yet');
    for (const r of [b, m]) expect(reminderDoc(r, 'sam@example.com', DEMO_NOW).merge).toEqual({ key: 'meal:pm', part: r === b ? 'Biscuit' : 'Miso', title: '{parts}: PM not fed yet' });
  });
});

test('a pet with a birthday gets one notification for the next one, linked to its page', () => {
  const now = new Date(2031, 4, 14, 10, 30).getTime();
  const [r] = birthdayReminders({ id: 'p1', name: 'Biscuit', birthDate: '2027-03-08' }, now);
  expect(r).toMatchObject({ app: 'pet', ref: 'pet:birthday:p1', title: "Biscuit's birthday", body: 'Biscuit turns 5 today.', at: new Date(2032, 2, 8, 9).getTime() });
  expect(r.url).toContain('pet=p1');
  expect(birthdayReminders({ id: 'p2', name: 'Pip' }, now)).toEqual([]);
  expect(birthdayReminders({ id: 'p3', name: 'Rex', birthDate: '2025-03-08', birthDateApprox: true }, now)).toEqual([]);
});

describe('the sender drops a reminder once it is done elsewhere', () => {
  const stored = (r: Parameters<typeof reminderDoc>[0]) => readSource('pet', reminderDoc(r, 'helen@example.com', DEMO_NOW).source)!;

  test("a dose given or skipped from the portal's To-do list, or its course removed", () => {
    const [next] = courseReminders(antibiotic, biscuit, d.medDoses, DEMO_NOW);
    const source = stored(next);
    expect(sourceAllowed('pet', source, 'helen@example.com', 'helper', new Map())).toBe(true);
    // The to-do for that dose logs exactly the record the source waits for.
    const todo = doseTodos(antibiotic, d.medDoses, d.pets, next.at - 60_000).find((t) => t.due === next.at)!;
    const logged = todo.done!.ops[0];
    expect(todo.cancel!.ops[0].id).toBe(logged.id);
    const course = `petMedCourses/${antibiotic.id}`;
    const dose = `petMedDoses/${logged.id}`;
    expect(source.checks.map((c) => c.doc)).toEqual([course, dose]);
    expect(stillDue(source, new Map([[course, {}], [dose, null]]))).toBe(true);
    expect(stillDue(source, new Map([[course, {}], [dose, { skipped: true }]]))).toBe(false);
    expect(stillDue(source, new Map([[course, null], [dose, null]]))).toBe(false);
    // Every dose of the course names its own slot's record.
    const all = courseReminders(antibiotic, biscuit, d.medDoses, DEMO_NOW);
    expect(new Set(all.map((r) => stored(r).checks[1]?.doc)).size).toBe(all.length);
  });

  test('a meal removed, or a birthday changed', () => {
    const [meal] = mealReminders(biscuit, d.meals, d.feedings, DEMO_NOW);
    const ms = stored(meal);
    expect(stillDue(ms, new Map([[ms.checks[0].doc, {}]]))).toBe(true);
    expect(stillDue(ms, new Map([[ms.checks[0].doc, null]]))).toBe(false);
    const pet = { id: 'p1', name: 'Biscuit', birthDate: '2027-03-08' };
    const [birthday] = birthdayReminders(pet, Date.UTC(2031, 0, 1));
    const bs = stored(birthday);
    expect(stillDue(bs, new Map([['petProfiles/p1', pet]]))).toBe(true);
    expect(stillDue(bs, new Map([['petProfiles/p1', { ...pet, birthDate: '2027-04-08' }]]))).toBe(false);
    expect(stillDue(bs, new Map([['petProfiles/p1', { ...pet, birthDateApprox: true }]]))).toBe(false);
  });
});

describe('reminders to write after a change', () => {
  const outers = ['sam@example.com'];
  const written = (data: typeof d) => reminderSignatures(data, DEMO_NOW, outers);
  const changes = (before: typeof d, after: typeof d) => reminderChanges(written(before), remindersByRef(after, DEMO_NOW, outers));

  test('nothing to write when nothing changed, also a minute later', () => {
    expect(changes(d, d)).toEqual({ replace: [], remove: [] });
    // Signed at open, compared at a later change: nothing derived from the clock may differ.
    expect(reminderChanges(written(d), remindersByRef(d, DEMO_NOW + 60_000, outers))).toEqual({ replace: [], remove: [] });
  });

  test("a meal fed rewrites only that pet's meal reminders", () => {
    const meal = d.meals.find((m) => m.petId === miso.id && mealAt(m.time, DEMO_NOW) > DEMO_NOW)!;
    const fed = { ...d, feedings: [...d.feedings, { id: 'fed-now', petId: miso.id, mealId: meal.id, at: DEMO_NOW, by: 'sam@example.com', createdAt: DEMO_NOW }] };
    const { replace, remove } = changes(d, fed);
    expect(replace.map(([ref]) => ref)).toEqual([mealsRef(miso.id)]);
    expect(replace[0][1]().some((r) => r.at === mealAt(meal.time, DEMO_NOW))).toBe(false);
    expect(remove).toEqual([]);
  });

  test('a deleted course is cancelled', () => {
    expect(changes(d, { ...d, courses: d.courses.filter((c) => c.id !== antibiotic.id) })).toEqual({ replace: [], remove: [courseRef(antibiotic.id)] });
  });

  test('a ref that empties is replaced with nothing, and any change to a reminder (its link) is a change', () => {
    const routine = d.routines[0]!;
    // Reminders turned off: the routine's ref is still there, now empty.
    const off = { ...d, routines: d.routines.map((r) => (r.id === routine.id ? { ...r, remind: false } : r)) };
    const before = remindersByRef(d, DEMO_NOW, outers).get(routinesRef(routine.id))!();
    const { replace } = changes(d, off);
    expect(before.length).toBeGreaterThan(0);
    expect(replace.map(([ref, build]) => [ref, build().length])).toEqual([[routinesRef(routine.id), 0]]);
    // Only the link differs: still rewritten.
    const sigs = written(d);
    const builders = remindersByRef(d, DEMO_NOW, outers);
    const ref = mealsRef(miso.id);
    const moved = new Map(builders).set(ref, () => builders.get(ref)!().map((r) => ({ ...r, url: `${r.url}&x=1` })));
    expect(reminderChanges(sigs, moved).replace.map(([r]) => r)).toEqual([ref]);
  });
});
