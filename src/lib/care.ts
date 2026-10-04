import type { AppointmentKind, ReminderKind, Species } from './model';
import type { Unit } from './schedule';
import { t } from '../i18n';

const KIND_KEYS = {
  'flea-tick': 'kind.fleaTick',
  heartworm: 'kind.heartworm',
  vaccine: 'kind.vaccine',
  deworming: 'kind.deworming',
  medication: 'kind.medication',
  other: 'kind.other',
} as const satisfies Record<ReminderKind, string>;

const APPOINTMENT_KEYS = {
  vet: 'appointmentKind.vet',
  grooming: 'appointmentKind.grooming',
  boarding: 'appointmentKind.boarding',
  other: 'appointmentKind.other',
} as const satisfies Record<AppointmentKind, string>;

const SPECIES_KEYS = {
  dog: 'species.dog',
  cat: 'species.cat',
  rabbit: 'species.rabbit',
  bird: 'species.bird',
  fish: 'species.fish',
  reptile: 'species.reptile',
  'small pet': 'species.smallPet',
  other: 'species.other',
} as const satisfies Record<Species, string>;

/** A care reminder's kind in the active language. */
export const kindLabel = (k: ReminderKind): string => t(KIND_KEYS[k] ?? KIND_KEYS.other);
/** An appointment's kind in the active language. */
export const appointmentLabel = (k: AppointmentKind): string => t(APPOINTMENT_KEYS[k] ?? APPOINTMENT_KEYS.other);
/** A species in the active language. */
export const speciesLabel = (s: Species): string => t(SPECIES_KEYS[s] ?? SPECIES_KEYS.other);

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
    { kind: 'flea-tick', title: t('preset.fleaTick'), every: 1, unit: 'month' },
    { kind: 'deworming', title: t('preset.deworming'), every: 3, unit: 'month' },
    { kind: 'vaccine', title: t('preset.rabies'), every: 1, unit: 'year' },
    { kind: 'medication', title: t('preset.dailyMedication'), every: 1, unit: 'day' },
  ];
  if (species === 'dog') return [common[0], { kind: 'heartworm', title: t('preset.heartworm'), every: 1, unit: 'month' }, common[2], { kind: 'vaccine', title: t('preset.dhpp'), every: 1, unit: 'year' }, common[1], common[3]];
  if (species === 'cat') return [common[0], common[2], { kind: 'vaccine', title: t('preset.fvrcp'), every: 1, unit: 'year' }, common[1], common[3]];
  return common;
}
