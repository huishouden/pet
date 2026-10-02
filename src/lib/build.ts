// Builds documents with exactly the keys the rules accept, trimmed to their limits. Shared by the
// live store and the sample-data store, so both write the same shapes.

import type { AppointmentData, AppointmentKind, CourseData, DoseData, FeedingData, MealData, MedDoseData, PetData, RecordData, ReminderData, ReminderKind, Species, WeightData } from './model';
import { LIMITS } from './model';
import { isRecurring, type Unit } from './schedule';
import { isYmd } from '@huishouden/pwa-kit/time';
import { isMealTime } from './feeding';
import { MAX_COURSE_DAYS, MAX_TIMES_PER_DAY, type CourseDraft } from './courses';
import type { WeightUnit } from './weight';

const trimmed = (s: string | undefined, max: number) => {
  const t = s?.trim();
  return t ? t.slice(0, max) : undefined;
};

/** Drops undefined values (Firestore rejects them). */
function defined<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

const validTarget = (v: number | undefined) => typeof v === 'number' && Number.isFinite(v) && v > 0 && v < LIMITS.maxTargetWeight;

export interface PetInput {
  name: string;
  species: Species;
  breed?: string;
  birthDate?: string;
  /** The birth date was worked out from an age. */
  birthDateApprox?: boolean;
  weightUnit: WeightUnit;
  targetWeight?: number;
  targetNote?: string;
  notes?: string;
}

/** What editing a pet starts from (and what saving one field of it writes back). */
export function petInputOf(p: PetData): PetInput {
  const { name, species, breed, birthDate, birthDateApprox, weightUnit, targetWeight, targetNote, notes } = p;
  return { name, species, breed, birthDate, birthDateApprox, weightUnit, targetWeight, targetNote, notes };
}

export function petDoc(p: PetInput, by: string, createdAt: number, updatedAt?: number): PetData {
  return defined({
    name: p.name.trim().slice(0, LIMITS.petName),
    species: p.species,
    breed: trimmed(p.breed, LIMITS.breed),
    birthDate: isYmd(p.birthDate) ? p.birthDate : undefined,
    birthDateApprox: isYmd(p.birthDate) && p.birthDateApprox ? true : undefined,
    weightUnit: p.weightUnit,
    ...(validTarget(p.targetWeight) ? { targetWeight: Math.round(p.targetWeight! * 100) / 100, targetNote: trimmed(p.targetNote, LIMITS.targetNote) } : {}),
    notes: trimmed(p.notes, LIMITS.petNotes),
    createdAt: Math.round(createdAt),
    updatedAt: updatedAt === undefined ? undefined : Math.round(updatedAt),
    by,
  });
}

export interface ReminderInput {
  petId: string;
  kind: ReminderKind;
  title: string;
  /** Absent or 0 for a one-off. */
  every?: number;
  unit?: Unit;
  due: string;
  lastDoneAt?: number;
  notes?: string;
}

export function reminderDoc(r: ReminderInput, by: string, createdAt: number, updatedAt?: number): ReminderData {
  const recurring = isRecurring({ every: r.every, unit: r.unit });
  return defined({
    petId: r.petId,
    kind: r.kind,
    title: r.title.trim().slice(0, LIMITS.reminderTitle),
    every: recurring ? Math.min(Math.round(r.every!), LIMITS.every) : undefined,
    unit: recurring ? r.unit : undefined,
    due: r.due,
    lastDoneAt: typeof r.lastDoneAt === 'number' ? Math.round(r.lastDoneAt) : undefined,
    notes: trimmed(r.notes, LIMITS.reminderNotes),
    createdAt: Math.round(createdAt),
    updatedAt: updatedAt === undefined ? undefined : Math.round(updatedAt),
    by,
  });
}

export function doseDoc(d: { petId: string; reminderId: string; title: string; at: number }, by: string, createdAt: number): DoseData {
  return { petId: d.petId, reminderId: d.reminderId, title: d.title.trim().slice(0, LIMITS.reminderTitle), at: Math.round(d.at), by, createdAt: Math.round(createdAt) };
}

export interface AppointmentInput {
  petIds: string[];
  kind: AppointmentKind;
  title: string;
  at: number;
  location?: string;
  notes?: string;
  contactId?: string;
  calendarEventId?: string;
  calendarLink?: string;
}

export function appointmentDoc(a: AppointmentInput, by: string, createdAt: number): AppointmentData {
  return defined({
    petIds: [...new Set(a.petIds)].slice(0, LIMITS.maxPetsPerAppointment),
    kind: a.kind,
    title: a.title.trim().slice(0, LIMITS.title),
    at: Math.round(a.at),
    location: trimmed(a.location, LIMITS.location),
    notes: trimmed(a.notes, LIMITS.notes),
    contactId: a.contactId || undefined,
    calendarEventId: a.calendarEventId || undefined,
    calendarLink: a.calendarLink && /^https:\/\//.test(a.calendarLink) ? a.calendarLink : undefined,
    createdAt: Math.round(createdAt),
    by,
  });
}

export function weightDoc(w: { petId: string; at: number; value: number; unit: WeightUnit }, by: string, createdAt: number): WeightData {
  return { petId: w.petId, at: Math.round(w.at), value: Math.round(w.value * 100) / 100, unit: w.unit, by, createdAt: Math.round(createdAt) };
}

export interface RecordInput {
  petId: string;
  title: string;
  date: string;
  text?: string;
}

export function recordDoc(r: RecordInput, by: string, createdAt: number, updatedAt?: number): RecordData {
  return defined({
    petId: r.petId,
    title: r.title.trim().slice(0, LIMITS.recordTitle),
    date: r.date,
    text: trimmed(r.text, LIMITS.recordText),
    createdAt: Math.round(createdAt),
    updatedAt: updatedAt === undefined ? undefined : Math.round(updatedAt),
    by,
  });
}

export interface MealInput {
  petId: string;
  name: string;
  time: string;
  food?: string;
  portion?: string;
  note?: string;
}

export function mealDoc(m: MealInput, by: string, createdAt: number, updatedAt?: number): MealData {
  if (!isMealTime(m.time)) throw new Error(`Not a meal time: ${m.time}`);
  return defined({
    petId: m.petId,
    name: m.name.trim().slice(0, LIMITS.mealName),
    time: m.time,
    food: trimmed(m.food, LIMITS.food),
    portion: trimmed(m.portion, LIMITS.portion),
    note: trimmed(m.note, LIMITS.mealNote),
    createdAt: Math.round(createdAt),
    updatedAt: updatedAt === undefined ? undefined : Math.round(updatedAt),
    by,
  });
}

export interface FeedingInput {
  petId: string;
  mealId?: string;
  at: number;
  portion?: string;
  note?: string;
}

export function feedingDoc(f: FeedingInput, by: string, createdAt: number, updatedAt?: number): FeedingData {
  return defined({
    petId: f.petId,
    mealId: f.mealId || undefined,
    at: Math.round(f.at),
    portion: trimmed(f.portion, LIMITS.portion),
    note: trimmed(f.note, LIMITS.feedingNote),
    by,
    createdAt: Math.round(createdAt),
    updatedAt: updatedAt === undefined ? undefined : Math.round(updatedAt),
  });
}

export type CourseInput = Omit<CourseDraft, 'days' | 'withFood' | 'notes'> & { petId: string; days: number; withFood: boolean; notes?: string };

export function courseDoc(c: CourseInput, by: string, createdAt: number, updatedAt?: number): CourseData {
  const times = [...new Set(c.times.filter(isMealTime))].sort().slice(0, MAX_TIMES_PER_DAY);
  if (times.length === 0) throw new Error('A course needs at least one dose time');
  if (!isYmd(c.startDate)) throw new Error(`Not a date: ${c.startDate}`);
  return defined({
    petId: c.petId,
    name: c.name.trim().slice(0, LIMITS.courseName),
    dose: c.dose.trim().slice(0, LIMITS.courseDose),
    timesPerDay: times.length,
    times,
    startDate: c.startDate,
    days: Math.min(Math.max(1, Math.round(c.days)), MAX_COURSE_DAYS),
    withFood: !!c.withFood,
    notes: trimmed(c.notes, LIMITS.courseNotes),
    createdAt: Math.round(createdAt),
    updatedAt: updatedAt === undefined ? undefined : Math.round(updatedAt),
    by,
  });
}

export function medDoseDoc(d: { petId: string; courseId: string; slot: number; at: number }, by: string, createdAt: number): MedDoseData {
  return { petId: d.petId, courseId: d.courseId, slot: Math.round(d.slot), at: Math.round(d.at), by, createdAt: Math.round(createdAt) };
}
