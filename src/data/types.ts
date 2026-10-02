import type { Contact, ContactInput } from '@huishouden/pwa-kit/contacts';
import type { Appointment, Course, Dose, Feeding, Meal, MedDose, Pet, PetRecord, Reminder, Weight } from '../lib/model';
import type { AppointmentInput, CourseInput, FeedingInput, MealInput, PetInput, RecordInput, ReminderInput } from '../lib/build';
import type { PetHouseholdData } from '../lib/demo';
import type { WeightUnit } from '../lib/weight';

export type { PetHouseholdData };

/** Collection names under households/{id}, by the data key that holds them. */
export const COLLECTIONS = {
  pets: 'petProfiles',
  reminders: 'petReminders',
  doses: 'petDoses',
  appointments: 'petAppointments',
  weights: 'petWeights',
  records: 'petRecords',
  meals: 'petMeals',
  feedings: 'petFeedings',
  courses: 'petMedCourses',
  medDoses: 'petMedDoses',
} as const;
export type DataKey = keyof typeof COLLECTIONS;

/** Everything removed with a pet, so Undo can put it all back under the same ids. */
export interface PetBundle {
  pet: Pet;
  reminders: Reminder[];
  doses: Dose[];
  weights: Weight[];
  records: PetRecord[];
  meals: Meal[];
  feedings: Feeding[];
  courses: Course[];
  medDoses: MedDose[];
  /** Appointments as they were: those only for this pet are deleted, shared ones lose this pet. */
  appointments: Appointment[];
}

/** Writes return immediately (Firestore queues them offline); failures arrive through the store's error callback. */
export interface PetActions {
  savePet(id: string | null, input: PetInput): string;
  removePet(pet: Pet): PetBundle;
  restorePet(bundle: PetBundle): void;
  saveReminder(id: string | null, input: ReminderInput): void;
  deleteReminder(r: Reminder): void;
  restoreReminder(r: Reminder): void;
  /** Records a dose and moves the reminder to its next due date; Undo is `undoDose`. */
  giveDose(r: Reminder, at: number): Dose;
  undoDose(dose: Dose, before: Reminder): void;
  saveAppointment(id: string | null, input: AppointmentInput): void;
  deleteAppointment(a: Appointment): void;
  restoreAppointment(a: Appointment): void;
  logWeight(input: { petId: string; at: number; value: number; unit: WeightUnit }): Weight;
  deleteWeight(w: Weight): void;
  restoreWeight(w: Weight): void;
  saveRecord(id: string | null, input: RecordInput): void;
  deleteRecord(r: PetRecord): void;
  restoreRecord(r: PetRecord): void;
  saveMeal(id: string | null, input: MealInput): void;
  deleteMeal(m: Meal): void;
  restoreMeal(m: Meal): void;
  /** Logs a feed (by the signed-in member); Undo is deleteFeedings. */
  logFeeding(input: FeedingInput): Feeding;
  /** Changes the time, portion or note; who fed and when it was logged stay. */
  updateFeeding(f: Feeding, input: FeedingInput): void;
  /** Un-ticks a meal (all of today's feeds for it) or deletes one feed; Undo is restoreFeedings. */
  deleteFeedings(list: Feeding[]): void;
  restoreFeedings(list: Feeding[]): void;
  /** Returns the course's id. */
  saveCourse(id: string | null, input: CourseInput): string;
  deleteCourse(c: Course): void;
  restoreCourse(c: Course): void;
  /** Ticks one dose of a course as given at `at` (now, or its time on an earlier day); Undo is deleteMedDoses. */
  giveMedDose(c: Course, slot: number, at: number): MedDose;
  /** Changes when a dose was given; who gave it stays. */
  moveMedDose(d: MedDose, at: number): void;
  deleteMedDoses(list: MedDose[]): void;
  restoreMedDoses(list: MedDose[]): void;
  saveContact(id: string | null, input: ContactInput): void;
  deleteContact(c: Contact): void;
  /** Puts a deleted contact back under its old id, so appointments that point at it still do. */
  restoreContact(c: Contact): void;
}

export interface PetStore {
  data: PetHouseholdData;
  /** False until the pets and reminders have answered once (from cache or server). */
  ready: boolean;
  actions: PetActions;
  /** Lowercase emails of the household, for consistent badge colours. */
  members: string[];
  /** The signed-in member's email (or the sample's). */
  me: string;
}
