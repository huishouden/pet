import type { AppointmentKind, ReminderKind, Species } from './model';
import type { Unit } from './schedule';

export const KIND_LABELS: Record<ReminderKind, string> = {
  'flea-tick': 'Flea and tick',
  heartworm: 'Heartworm',
  vaccine: 'Vaccine',
  deworming: 'Deworming',
  medication: 'Medication',
  other: 'Other',
};

export const APPOINTMENT_LABELS: Record<AppointmentKind, string> = {
  vet: 'Vet',
  grooming: 'Grooming',
  boarding: 'Boarding',
  other: 'Other',
};

export const SPECIES_LABELS: Record<Species, string> = {
  dog: 'Dog',
  cat: 'Cat',
  rabbit: 'Rabbit',
  bird: 'Bird',
  fish: 'Fish',
  reptile: 'Reptile',
  'small pet': 'Small pet',
  other: 'Other',
};

export interface Preset {
  kind: ReminderKind;
  title: string;
  every: number;
  unit: Unit;
}

/**
 * One-tap starting points for a new reminder. Intervals are common defaults, not advice: the dialog
 * says to follow the vet's schedule and every field stays editable.
 */
export function presetsFor(species: Species | undefined): Preset[] {
  const common: Preset[] = [
    { kind: 'flea-tick', title: 'Flea and tick', every: 1, unit: 'month' },
    { kind: 'deworming', title: 'Deworming', every: 3, unit: 'month' },
    { kind: 'vaccine', title: 'Rabies vaccine', every: 1, unit: 'year' },
    { kind: 'medication', title: 'Daily medication', every: 1, unit: 'day' },
  ];
  if (species === 'dog') return [common[0], { kind: 'heartworm', title: 'Heartworm prevention', every: 1, unit: 'month' }, common[2], { kind: 'vaccine', title: 'DHPP vaccine', every: 1, unit: 'year' }, common[1], common[3]];
  if (species === 'cat') return [common[0], common[2], { kind: 'vaccine', title: 'FVRCP vaccine', every: 1, unit: 'year' }, common[1], common[3]];
  return common;
}
