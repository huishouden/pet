// Care routines: scoop the litter box, change the litter, brush, and the like, for one pet or
// several (two cats and one box). When one is due, and the id of the log written when it is done,
// come from the kit (`@huishouden/pwa-kit/pet-routines`), which the portal's to-do list and the
// assistant share. Pure: every function takes `now`.

import { ROUTINE_DEFAULTS, ROUTINE_PRESETS, ROUTINE_PRESET_SCHEDULES, routineLogId, routineRule, routineSchedule, routineStatus, type RoutinePreset, type RoutineStatus } from '@huishouden/pwa-kit/pet-routines';
import { describeRule, describeSchedule } from '@huishouden/pwa-kit/schedule';
import { addDays, dueText, toYmd, ymdToTime } from '@huishouden/pwa-kit/time';
import { formatList } from '@huishouden/pwa-kit/i18n';
import type { Pet, Routine, RoutineLog } from './model';
import { t } from '../i18n';

export { ROUTINE_DEFAULTS, ROUTINE_PRESETS, routineLogId };
export type { RoutinePreset };

/** The history a routine's sheet lists. */
export const HISTORY_SHOWN = 12;
/** The furthest back routine logs are ever read. */
export const MAX_LOG_DAYS = 400;
/** The least read back, with no routines or only daily ones: two weeks. */
export const MIN_LOG_DAYS = 15;

const UNIT_DAYS = { day: 1, week: 7, month: 31 } as const;

/**
 * From when the routine logs are read (the start of a local day, so it stays the same all day): far
 * enough back for the slowest routine's sheet (`HISTORY_SHOWN` times, and two more for where it
 * stands), at least two weeks, at most `MAX_LOG_DAYS`. Every log read is billed on each open: a
 * household that scoops daily and changes the litter weekly reads 14 weeks of logs, not a year.
 */
export function logWindowStart(routines: readonly Pick<Routine, 'mode' | 'every' | 'unit'>[], now: number): number {
  const today = toYmd(now);
  const days = Math.max(MIN_LOG_DAYS, ...routines.map((r) => (HISTORY_SHOWN + 2) * (r.mode === 'weekdays' ? 7 : (r.every ?? 1) * UNIT_DAYS[r.unit ?? 'week'])));
  return ymdToTime(addDays(today, -Math.min(MAX_LOG_DAYS, days)));
}

/** A preset's name as it is written into the routine when picked ("Scoop litter box"); the person may change it. */
export function presetName(kind: RoutinePreset): string {
  switch (kind) {
    case 'scoop':
      return t('routines.preset.scoop');
    case 'litter':
      return t('routines.preset.litter');
    case 'brush':
      return t('routines.preset.brush');
    case 'fountain':
      return t('routines.preset.fountain');
    case 'fishWater':
      return t('routines.preset.fishWater');
    case 'cage':
      return t('routines.preset.cage');
  }
}

export { ROUTINE_PRESET_SCHEDULES };

/** Which presets suit a species first: the litter box for cats, brushing for dogs. */
export function presetsFor(species: Pet['species'] | undefined): RoutinePreset[] {
  const first: Record<string, RoutinePreset[]> = {
    cat: ['scoop', 'litter', 'fountain', 'brush'],
    dog: ['brush', 'fountain'],
    fish: ['fishWater'],
    bird: ['cage'],
    reptile: ['cage'],
    'small pet': ['cage', 'brush'],
    rabbit: ['cage', 'brush'],
  };
  const head = first[species ?? ''] ?? [];
  return [...head, ...ROUTINE_PRESETS.filter((p) => !head.includes(p))];
}

/** "Miso", "Miso and Biscuit": the pets a routine is for, those still in the household. */
export function petsLabel(r: Pick<Routine, 'petIds'>, pets: Pick<Pet, 'id' | 'name'>[]): string {
  return formatList(r.petIds.map((id) => pets.find((p) => p.id === id)?.name.trim()).filter((n): n is string => !!n));
}

/** How a routine repeats, in words: "Every week · from when it was last done", "Every Monday and Thursday". */
export function scheduleText(r: Routine): string {
  const s = routineSchedule(r);
  if (!s) return describeRule(routineRule(r));
  return r.mode === 'after-done' ? t('routines.fromDone', { every: describeSchedule(s) }) : describeSchedule(s);
}

export type RoutineLogs = Pick<RoutineLog, 'routineId' | 'due' | 'on' | 'at' | 'by' | 'id' | 'note'>[];

/** Where a routine stands today. */
export const statusOf = (r: Routine, logs: readonly RoutineLog[], now: number): RoutineStatus<RoutineLog> => routineStatus(r, logs, toYmd(now));

export interface RoutineItem {
  routine: Routine;
  status: RoutineStatus<RoutineLog>;
}

/** Open routines (due today or overdue, the most overdue first) and the ones done today, for Today. */
export function routinesToday(routines: Routine[], logs: readonly RoutineLog[], now: number): { open: RoutineItem[]; done: RoutineItem[] } {
  const all = routines.map((routine) => ({ routine, status: statusOf(routine, logs, now) }));
  const byName = (a: RoutineItem, b: RoutineItem) => a.routine.name.localeCompare(b.routine.name);
  return {
    open: all.filter((x) => x.status.state === 'due' || x.status.state === 'overdue').sort((a, b) => b.status.late - a.status.late || byName(a, b)),
    done: all.filter((x) => x.status.state === 'done').sort(byName),
  };
}

/** The line under an open routine: "Overdue by 2 days", "Due today". */
export const dueLine = (item: RoutineItem, now: number) => dueText(item.status.due, toYmd(now));

/** A routine's logs, latest first. */
export const historyOf = (routineId: string, logs: readonly RoutineLog[], limit = HISTORY_SHOWN) =>
  logs
    .filter((l) => l.routineId === routineId)
    .sort((a, b) => b.at - a.at)
    .slice(0, limit);

/** The routines that include a pet, by name. */
export const routinesOfPet = (routines: Routine[], petId: string) => routines.filter((r) => r.petIds.includes(petId)).sort((a, b) => a.name.localeCompare(b.name));
