import { describe, expect, test } from 'bun:test';
import { DEMO_NOW, demoData, emptyData, type PetHouseholdData } from '../lib/demo';
import { FIELDS } from '../lib/model';
import { applyOps, createActions, type Op } from './actions';
import { COLLECTIONS, type DataKey } from './types';

/** Actions over an in-memory backend that records every write, as the sample store does. */
function harness(initial: PetHouseholdData = demoData()) {
  let data = initial;
  const writes: Op[][] = [];
  let seq = 0;
  const actions = createActions({
    me: 'sam@example.com',
    now: () => DEMO_NOW,
    read: () => data,
    newId: (key) => `${key}-${seq++}`,
    write: (ops) => {
      writes.push(ops);
      data = applyOps(data, ops);
    },
    contacts: { save: () => {}, remove: () => {}, restore: () => {} },
  });
  return { actions, get data() { return data; }, writes };
}

/** Every document written carries only the keys the rules allow for its collection. */
function expectRuleKeys(writes: Op[][]) {
  for (const op of writes.flat()) {
    if (!op.data) continue;
    const allowed = FIELDS[COLLECTIONS[op.col]] as readonly string[];
    for (const k of Object.keys(op.data)) expect(allowed).toContain(k);
    for (const v of Object.values(op.data)) expect(v).not.toBeUndefined();
  }
}

describe('giving a dose', () => {
  test('logs the dose and moves the reminder in one write; Undo puts both back', () => {
    const h = harness();
    const before = h.data.reminders.find((r) => r.id === 'demo-rem-1')!;
    const at = new Date(2031, 4, 14, 8, 0).getTime();
    const dose = h.actions.giveDose(before, at);
    expect(h.writes.at(-1)).toHaveLength(2);
    const after = h.data.reminders.find((r) => r.id === before.id)!;
    expect(after.due).toBe('2031-06-14');
    expect(after.lastDoneAt).toBe(at);
    expect(after.by).toBe(before.by);
    expect(after.createdAt).toBe(before.createdAt);
    expect(h.data.doses.some((d) => d.id === dose.id && d.reminderId === before.id)).toBe(true);

    h.actions.undoDose(dose, before);
    expect(h.data.reminders.find((r) => r.id === before.id)).toEqual(before);
    expect(h.data.doses.some((d) => d.id === dose.id)).toBe(false);
    expectRuleKeys(h.writes);
  });
});

describe('removing a pet', () => {
  test('takes its reminders, doses, weights and records, leaves shared appointments to the other pet, and Undo restores all', () => {
    const h = harness();
    const original = h.data;
    const miso = original.pets.find((p) => p.name === 'Miso')!;
    const bundle = h.actions.removePet(miso);
    expect(h.writes).toHaveLength(1);
    for (const key of ['reminders', 'doses', 'weights', 'records', 'meals', 'feedings'] as const) {
      expect(bundle[key].length).toBeGreaterThan(0);
      expect(h.data[key].some((x) => x.petId === miso.id)).toBe(false);
    }
    expect(bundle.photo?.id).toBe(miso.id);
    expect(h.data.photos.some((p) => p.id === miso.id)).toBe(false);
    const shared = h.data.appointments.find((a) => a.title === 'Boarding drop-off')!;
    expect(shared.petIds).toEqual(['demo-pet-biscuit']);
    expect(h.data.appointments.some((a) => a.title === 'Dental cleaning')).toBe(false);

    h.actions.restorePet(bundle);
    const sortById = (l: { id: string }[]) => [...l].sort((a, b) => a.id.localeCompare(b.id));
    for (const key of ['pets', 'reminders', 'doses', 'weights', 'records', 'meals', 'feedings', 'appointments', 'photos'] as const)
      expect(sortById(h.data[key] as { id: string }[])).toEqual(sortById(original[key] as { id: string }[]));
    expectRuleKeys(h.writes);
  });
});

describe("a pet's photo", () => {
  const webp = 'data:image/webp;base64,UklGRg==';
  test('is its own document keyed by the pet, replaced and removed with Undo', () => {
    const h = harness(emptyData());
    const petId = h.actions.savePet(null, { name: 'Pip', species: 'dog', weightUnit: 'kg' });
    expect(h.actions.savePetPhoto(petId, webp)).toBeUndefined();
    expect(h.data.photos).toEqual([{ id: petId, data: webp, updatedAt: DEMO_NOW, by: 'sam@example.com' }]);
    const before = h.actions.savePetPhoto(petId, 'data:image/jpeg;base64,/9j/');
    expect(before?.data).toBe(webp);
    h.actions.restorePetPhoto(petId, before);
    expect(h.data.photos[0].data).toBe(webp);
    const removed = h.actions.removePetPhoto(petId);
    expect(h.data.photos).toEqual([]);
    h.actions.restorePetPhoto(petId, removed);
    expect(h.data.photos[0].data).toBe(webp);
    expectRuleKeys(h.writes);
  });

  test('only a WebP or JPEG data URL is kept', () => {
    const h = harness(emptyData());
    expect(() => h.actions.savePetPhoto('p1', 'data:image/png;base64,iVBOR')).toThrow();
    expect(() => h.actions.savePetPhoto('p1', `data:image/webp;base64,${'A'.repeat(100_000)}`)).toThrow();
    expect(h.data.photos).toEqual([]);
  });

  test('the sample pets have invented illustrations, small enough for the rules', () => {
    for (const p of demoData().photos) {
      expect(p.data.startsWith('data:image/webp;base64,')).toBe(true);
      expect(p.data.length).toBeLessThan(60_000);
    }
    expect(demoData().photos.map((p) => p.id).sort()).toEqual(['demo-pet-biscuit', 'demo-pet-miso']);
  });
});

describe('saving', () => {
  test('a new pet, reminder, appointment, weight and record write only rule keys', () => {
    const h = harness(emptyData());
    const petId = h.actions.savePet(null, { name: ' Pip ', species: 'rabbit', weightUnit: 'kg', breed: '', notes: '' });
    h.actions.saveReminder(null, { petId, kind: 'other', title: 'Nail trim', every: 6, unit: 'week', due: '2031-05-20', notes: '' });
    h.actions.saveReminder(null, { petId, kind: 'medication', title: 'Stitches out', due: '2031-05-20' });
    h.actions.saveAppointment(null, { petIds: [petId, petId], kind: 'vet', title: 'Check-up', at: DEMO_NOW + 0.4, location: ' ', calendarLink: 'javascript:x' });
    h.actions.logWeight({ petId, at: DEMO_NOW, value: 1.856, unit: 'kg' });
    h.actions.saveRecord(null, { petId, title: 'Adopted', date: '2031-01-05', text: '  ' });
    h.actions.saveMeal(null, { petId, name: 'Noon', time: '12:00', food: '', portion: 'A handful' });
    const fed = h.actions.logFeeding({ petId, mealId: `${petId}-am`, at: DEMO_NOW, portion: '' });
    h.actions.updateFeeding(fed, { petId, mealId: `${petId}-am`, at: DEMO_NOW - 60_000, note: 'Slow' });
    h.actions.saveCourse(null, { petId, name: 'Antibiotic', dose: '1 tablet', timesPerDay: 2, times: ['19:00', '09:00', 'noon'], startDate: '2031-05-12', days: 7.4, withFood: true });
    const course = h.data.courses[0];
    h.actions.giveMedDose(course, 1, DEMO_NOW);
    expectRuleKeys(h.writes);
    expect(h.data.meals.map((m) => m.name).sort()).toEqual(['AM', 'Noon', 'PM']);
    expect(h.data.feedings[0]).toMatchObject({ by: 'sam@example.com', note: 'Slow', at: DEMO_NOW - 60_000 });
    expect(h.data.feedings[0]).not.toHaveProperty('portion');
    expect(course).toMatchObject({ times: ['09:00', '19:00'], timesPerDay: 2, days: 7 });
    expect(h.data.pets[0].name).toBe('Pip');
    expect(h.data.pets[0]).not.toHaveProperty('breed');
    expect(h.data.reminders.find((r) => r.title === 'Stitches out')).not.toHaveProperty('every');
    expect(h.data.appointments[0].petIds).toEqual([petId]);
    expect(h.data.appointments[0]).not.toHaveProperty('calendarLink');
    expect(Number.isInteger(h.data.appointments[0].at)).toBe(true);
    expect(h.data.weights[0].value).toBe(1.86);
  });

  test('a dose ticked for an earlier day keeps that time; changing the time keeps who gave it', () => {
    const h = harness(emptyData());
    const petId = h.actions.savePet(null, { name: 'Pip', species: 'dog', weightUnit: 'kg' });
    const courseId = h.actions.saveCourse(null, { petId, name: 'Antibiotic', dose: '1 tablet', timesPerDay: 2, times: ['09:00', '19:00'], startDate: '2031-05-13', days: 3, withFood: false });
    const course = h.data.courses.find((c) => c.id === courseId)!;
    const yesterdayPm = new Date(2031, 4, 13, 19).getTime();
    const d = h.actions.giveMedDose(course, 1, yesterdayPm);
    expect(d).toMatchObject({ at: yesterdayPm, by: 'sam@example.com', createdAt: DEMO_NOW });
    h.actions.moveMedDose({ ...d, by: 'alex@example.com' }, yesterdayPm + 30 * 60_000);
    expect(h.data.medDoses.find((x) => x.id === d.id)).toMatchObject({ at: yesterdayPm + 30 * 60_000, by: 'alex@example.com', createdAt: DEMO_NOW });
    expectRuleKeys(h.writes);
  });

  test('editing keeps the original author and creation time', () => {
    const h = harness();
    const r = h.data.records[0];
    h.actions.saveRecord(r.id, { petId: r.petId, title: 'Ear infection, cleared', date: r.date, text: r.text });
    const after = h.data.records.find((x) => x.id === r.id)!;
    expect(after.by).toBe(r.by);
    expect(after.createdAt).toBe(r.createdAt);
    expect(after.updatedAt).toBe(DEMO_NOW);
  });
});

test('every sample document already has only rule keys', () => {
  const d = demoData();
  const ops: Op[][] = [];
  for (const key of Object.keys(COLLECTIONS) as DataKey[]) ops.push((d[key] as { id: string }[]).map(({ id, ...data }) => ({ col: key, id, data })));
  expectRuleKeys(ops);
});
