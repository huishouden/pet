import type { ContactWrites } from '@huishouden/pwa-kit/contacts';
import { applyOps as applyKitOps, withoutId, type Backend as KitBackend, type Op as KitOp } from '@huishouden/pwa-kit/store';
import { appointmentDoc, photoDoc, courseDoc, doseDoc, feedingDoc, mealDoc, medDoseDoc, petDoc, recordDoc, reminderDoc, weightDoc } from '../lib/build';
import { markGiven } from '../lib/schedule';
import { defaultMeals } from '../lib/feeding';
import type { PetHouseholdData } from '../lib/demo';
import type { DataKey, PetActions, PetBundle } from './types';
import { track } from '@huishouden/pwa-kit/observability';

/** One document write: `data` null deletes. */
export type Op = KitOp<DataKey>;

/**
 * Where the actions write: Firestore for a household, memory for the sample. The actions themselves
 * are the same for both, so the sample behaves exactly like the real app.
 */
export interface Backend extends KitBackend<DataKey> {
  me: string;
  now(): number;
  /** The data as last seen (for edits that keep the original author and creation time). */
  read(): PetHouseholdData;
  contacts: ContactWrites;
}

export function createActions(b: Backend): PetActions {
  const put = (key: DataKey, id: string, data: object) => b.write([{ col: key, id, data }]);
  const del = (key: DataKey, id: string) => b.write([{ col: key, id, data: null }]);
  const find = <K extends DataKey>(key: K, id: string | null) => (id ? (b.read()[key] as { id: string; by: string; createdAt: number }[]).find((x) => x.id === id) : undefined);

  return {
    savePet: (id, input) => {
      const existing = find('pets', id);
      const petId = id ?? b.newId('pets');
      const now = b.now();
      const ops: Op[] = [{ col: 'pets', id: petId, data: petDoc(input, existing?.by ?? b.me, existing?.createdAt ?? now, existing ? now : undefined) }];
      // Every new pet starts with the AM and PM board the household already keeps on paper.
      if (!existing) for (const m of defaultMeals(petId)) ops.push({ col: 'meals', id: m.id, data: mealDoc(m, b.me, now) });
      b.write(ops);
      return petId;
    },
    removePet: (pet) => {
      const d = b.read();
      const mine = <T extends { petId: string }>(list: T[]) => list.filter((x) => x.petId === pet.id);
      const bundle: PetBundle = {
        pet,
        reminders: mine(d.reminders),
        doses: mine(d.doses),
        weights: mine(d.weights),
        records: mine(d.records),
        meals: mine(d.meals),
        feedings: mine(d.feedings),
        courses: mine(d.courses),
        medDoses: mine(d.medDoses),
        appointments: d.appointments.filter((a) => a.petIds.includes(pet.id)),
        photo: d.photos.find((p) => p.id === pet.id),
      };
      const ops: Op[] = [{ col: 'pets', id: pet.id, data: null }];
      if (bundle.photo) ops.push({ col: 'photos', id: pet.id, data: null });
      for (const key of ['reminders', 'doses', 'weights', 'records', 'meals', 'feedings', 'courses', 'medDoses'] as const) for (const x of bundle[key]) ops.push({ col: key, id: x.id, data: null });
      for (const a of bundle.appointments) {
        const others = a.petIds.filter((p) => p !== pet.id);
        ops.push({ col: 'appointments', id: a.id, data: others.length ? { ...withoutId(a), petIds: others } : null });
      }
      b.write(ops);
      return bundle;
    },
    restorePet: (bundle) => {
      const ops: Op[] = [{ col: 'pets', id: bundle.pet.id, data: withoutId(bundle.pet) }];
      for (const key of ['reminders', 'doses', 'weights', 'records', 'meals', 'feedings', 'courses', 'medDoses', 'appointments'] as const)
        for (const x of bundle[key]) ops.push({ col: key, id: x.id, data: withoutId(x) });
      if (bundle.photo) ops.push({ col: 'photos', id: bundle.photo.id, data: withoutId(bundle.photo) });
      b.write(ops);
    },
    savePetPhoto: (petId, dataUrl) => {
      const before = b.read().photos.find((p) => p.id === petId);
      put('photos', petId, photoDoc(dataUrl, b.me, b.now()));
      return before;
    },
    removePetPhoto: (petId) => {
      const before = b.read().photos.find((p) => p.id === petId);
      if (before) del('photos', petId);
      return before;
    },
    restorePetPhoto: (petId, before) => (before ? put('photos', petId, withoutId(before)) : del('photos', petId)),
    saveReminder: (id, input) => {
      const existing = find('reminders', id);
      const now = b.now();
      put('reminders', id ?? b.newId('reminders'), reminderDoc(input, existing?.by ?? b.me, existing?.createdAt ?? now, existing ? now : undefined));
    },
    deleteReminder: (r) => del('reminders', r.id),
    restoreReminder: (r) => put('reminders', r.id, withoutId(r)),
    giveDose: (r, at) => {
      track('give dose');
      const now = b.now();
      const next = markGiven(r, at);
      const dose = { id: b.newId('doses'), ...doseDoc({ petId: r.petId, reminderId: r.id, title: r.title, at }, b.me, now) };
      b.write([
        { col: 'doses', id: dose.id, data: withoutId(dose) },
        { col: 'reminders', id: r.id, data: reminderDoc({ ...r, ...next }, r.by, r.createdAt, now) },
      ]);
      return dose;
    },
    undoDose: (dose, before) =>
      b.write([
        { col: 'doses', id: dose.id, data: null },
        { col: 'reminders', id: before.id, data: withoutId(before) },
      ]),
    saveAppointment: (id, input) => {
      track('save appointment');
      const existing = find('appointments', id);
      put('appointments', id ?? b.newId('appointments'), appointmentDoc(input, existing?.by ?? b.me, existing?.createdAt ?? b.now()));
    },
    deleteAppointment: (a) => del('appointments', a.id),
    restoreAppointment: (a) => put('appointments', a.id, withoutId(a)),
    logWeight: (input) => {
      track('log weight');
      const w = { id: b.newId('weights'), ...weightDoc(input, b.me, b.now()) };
      put('weights', w.id, withoutId(w));
      return w;
    },
    deleteWeight: (w) => del('weights', w.id),
    restoreWeight: (w) => put('weights', w.id, withoutId(w)),
    saveRecord: (id, input) => {
      const existing = find('records', id);
      const now = b.now();
      put('records', id ?? b.newId('records'), recordDoc(input, existing?.by ?? b.me, existing?.createdAt ?? now, existing ? now : undefined));
    },
    deleteRecord: (r) => del('records', r.id),
    restoreRecord: (r) => put('records', r.id, withoutId(r)),
    saveMeal: (id, input) => {
      const existing = find('meals', id);
      const now = b.now();
      put('meals', id ?? b.newId('meals'), mealDoc(input, existing?.by ?? b.me, existing?.createdAt ?? now, existing ? now : undefined));
    },
    deleteMeal: (m) => del('meals', m.id),
    restoreMeal: (m) => put('meals', m.id, withoutId(m)),
    logFeeding: (input) => {
      track('log feed');
      const f = { id: b.newId('feedings'), ...feedingDoc(input, b.me, b.now()) };
      put('feedings', f.id, withoutId(f));
      return f;
    },
    updateFeeding: (f, input) => put('feedings', f.id, feedingDoc(input, f.by, f.createdAt, b.now())),
    deleteFeedings: (list) => b.write(list.map((f) => ({ col: 'feedings', id: f.id, data: null }))),
    restoreFeedings: (list) => b.write(list.map((f) => ({ col: 'feedings', id: f.id, data: withoutId(f) }))),
    saveCourse: (id, input) => {
      track('save medicine course');
      const existing = find('courses', id);
      const now = b.now();
      const courseId = id ?? b.newId('courses');
      put('courses', courseId, courseDoc(input, existing?.by ?? b.me, existing?.createdAt ?? now, existing ? now : undefined));
      return courseId;
    },
    deleteCourse: (c) => del('courses', c.id),
    restoreCourse: (c) => put('courses', c.id, withoutId(c)),
    giveMedDose: (c, slot, at) => {
      track('give medicine');
      const d = { id: b.newId('medDoses'), ...medDoseDoc({ petId: c.petId, courseId: c.id, slot, at }, b.me, b.now()) };
      put('medDoses', d.id, withoutId(d));
      return d;
    },
    moveMedDose: (d, at) => put('medDoses', d.id, medDoseDoc({ ...d, at }, d.by, d.createdAt)),
    deleteMedDoses: (list) => b.write(list.map((d) => ({ col: 'medDoses', id: d.id, data: null }))),
    restoreMedDoses: (list) => b.write(list.map((d) => ({ col: 'medDoses', id: d.id, data: withoutId(d) }))),
    saveContact: (id, input) => b.contacts.save(id, input),
    deleteContact: (c) => b.contacts.remove(c),
    restoreContact: (c) => b.contacts.restore(c),
  };
}

/** Applies writes to in-memory data: the sample store, and the unit tests of the actions. */
export const applyOps = (data: PetHouseholdData, ops: Op[]): PetHouseholdData => applyKitOps(data, ops);
