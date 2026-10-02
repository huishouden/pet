// Firestore shapes under households/{householdId}. The project's rules accept exactly these keys
// (`keys().hasOnly(FIELDS.x)`), so writers build documents from these types and never add fields.

import type { Unit } from './schedule';
import type { WeightUnit } from './weight';

export const SPECIES = ['dog', 'cat', 'rabbit', 'bird', 'fish', 'reptile', 'small pet', 'other'] as const;
export type Species = (typeof SPECIES)[number];

export const REMINDER_KINDS = ['flea-tick', 'heartworm', 'vaccine', 'deworming', 'medication', 'other'] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];

export const APPOINTMENT_KINDS = ['vet', 'grooming', 'boarding', 'other'] as const;
export type AppointmentKind = (typeof APPOINTMENT_KINDS)[number];

/** petProfiles/{petId} */
export interface PetData {
  name: string;
  species: Species;
  breed?: string;
  /** YYYY-MM-DD. */
  birthDate?: string;
  /** Set when `birthDate` was worked out from an age (rescues, unknown birthdays): no birthday is shown or reminded. */
  birthDateApprox?: boolean;
  /** The unit this pet is weighed in. */
  weightUnit: WeightUnit;
  /** The weight to aim for (the vet's goal), in `weightUnit`. */
  targetWeight?: number;
  /** Where the target comes from: "Vet's goal". */
  targetNote?: string;
  /** Care notes shown on the pet's card: diet, allergies, temperament. */
  notes?: string;
  createdAt: number;
  updatedAt?: number;
  by: string;
}
export interface Pet extends PetData {
  id: string;
}

/** petReminders/{id}: prevention, vaccines and medication, one-off or every N days/weeks/months/years. */
export interface ReminderData {
  petId: string;
  kind: ReminderKind;
  title: string;
  /** Repeats `every` `unit` after each dose; absent for a one-off. */
  every?: number;
  unit?: Unit;
  /** YYYY-MM-DD of the next dose. */
  due: string;
  lastDoneAt?: number;
  notes?: string;
  createdAt: number;
  updatedAt?: number;
  by: string;
}
export interface Reminder extends ReminderData {
  id: string;
}

/** petDoses/{id}: a dose given (the history behind a reminder). */
export interface DoseData {
  petId: string;
  reminderId: string;
  title: string;
  at: number;
  by: string;
  createdAt: number;
}
export interface Dose extends DoseData {
  id: string;
}

/** petAppointments/{id}: vet visits, grooming, boarding. */
export interface AppointmentData {
  petIds: string[];
  kind: AppointmentKind;
  title: string;
  at: number;
  location?: string;
  notes?: string;
  /** The household contact it is with (households/{id}/contacts). */
  contactId?: string;
  /** The Google Calendar event it came from, so an import never adds it twice. */
  calendarEventId?: string;
  calendarLink?: string;
  createdAt: number;
  by: string;
}
export interface Appointment extends AppointmentData {
  id: string;
}

/** petWeights/{id} */
export interface WeightData {
  petId: string;
  at: number;
  value: number;
  unit: WeightUnit;
  by: string;
  createdAt: number;
}
export interface Weight extends WeightData {
  id: string;
}

/** petRecords/{id}: dated notes and records (a diagnosis, a certificate, a diet change). */
export interface RecordData {
  petId: string;
  title: string;
  /** YYYY-MM-DD the record is about. */
  date: string;
  text?: string;
  createdAt: number;
  updatedAt?: number;
  by: string;
}
export interface PetRecord extends RecordData {
  id: string;
}

/** petMeals/{id}: one meal in a pet's feeding schedule. */
export interface MealData {
  petId: string;
  name: string;
  /** 'HH:MM', 24-hour local time. */
  time: string;
  food?: string;
  portion?: string;
  /** Treats or medicine given with this meal. */
  note?: string;
  createdAt: number;
  updatedAt?: number;
  by: string;
}
export interface Meal extends MealData {
  id: string;
}

/** petFeedings/{id}: one feed, for a scheduled meal or extra. */
export interface FeedingData {
  petId: string;
  mealId?: string;
  at: number;
  portion?: string;
  note?: string;
  by: string;
  createdAt: number;
  updatedAt?: number;
}
export interface Feeding extends FeedingData {
  id: string;
}

/** petMedCourses/{id}: a short course of medicine ("1 tablet twice daily for 7 days with food"). */
export interface CourseData {
  petId: string;
  name: string;
  dose: string;
  timesPerDay: number;
  /** 'HH:MM' per dose, `timesPerDay` of them. */
  times: string[];
  startDate: string;
  days: number;
  withFood: boolean;
  notes?: string;
  createdAt: number;
  updatedAt?: number;
  by: string;
}
export interface Course extends CourseData {
  id: string;
}

/** petMedDoses/{id}: one dose of a course, given. `slot` is the index into the course's times. */
export interface MedDoseData {
  petId: string;
  courseId: string;
  slot: number;
  at: number;
  by: string;
  createdAt: number;
}
export interface MedDose extends MedDoseData {
  id: string;
}

/** The only keys each collection's documents may carry; the rules list the same. */
export const FIELDS = {
  petProfiles: ['name', 'species', 'breed', 'birthDate', 'birthDateApprox', 'weightUnit', 'targetWeight', 'targetNote', 'notes', 'createdAt', 'updatedAt', 'by'],
  petReminders: ['petId', 'kind', 'title', 'every', 'unit', 'due', 'lastDoneAt', 'notes', 'createdAt', 'updatedAt', 'by'],
  petDoses: ['petId', 'reminderId', 'title', 'at', 'by', 'createdAt'],
  petAppointments: ['petIds', 'kind', 'title', 'at', 'location', 'notes', 'contactId', 'calendarEventId', 'calendarLink', 'createdAt', 'by'],
  petWeights: ['petId', 'at', 'value', 'unit', 'by', 'createdAt'],
  petRecords: ['petId', 'title', 'date', 'text', 'createdAt', 'updatedAt', 'by'],
  petMeals: ['petId', 'name', 'time', 'food', 'portion', 'note', 'createdAt', 'updatedAt', 'by'],
  petFeedings: ['petId', 'mealId', 'at', 'portion', 'note', 'by', 'createdAt', 'updatedAt'],
  petMedCourses: ['petId', 'name', 'dose', 'timesPerDay', 'times', 'startDate', 'days', 'withFood', 'notes', 'createdAt', 'updatedAt', 'by'],
  petMedDoses: ['petId', 'courseId', 'slot', 'at', 'by', 'createdAt'],
} as const;

/** String length caps, mirrored in the rules. */
export const LIMITS = {
  petName: 60,
  breed: 60,
  petNotes: 1000,
  reminderTitle: 80,
  reminderNotes: 500,
  every: 365,
  title: 120,
  location: 200,
  notes: 500,
  recordTitle: 120,
  recordText: 2000,
  maxPetsPerAppointment: 10,
  maxWeight: 2000,
  maxTargetWeight: 1000,
  targetNote: 200,
  mealName: 40,
  food: 80,
  portion: 40,
  mealNote: 200,
  feedingNote: 200,
  courseName: 80,
  courseDose: 80,
  courseNotes: 500,
} as const;
