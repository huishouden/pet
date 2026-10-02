import { describe, expect, test } from 'bun:test';
import { reminderDoc } from '@huishouden/pwa-kit/reminders';
import { DEMO_NOW, demoData } from './demo';
import { courseRef, courseReminders, mealReminders, mealsRef, petUrl } from './notify';
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
});
