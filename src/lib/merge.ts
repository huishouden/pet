import type { MergeSpec } from '@huishouden/pwa-kit/merge';
import { MERGE_LIMITS } from '@huishouden/pwa-kit/merge';
import { takeOut, type OutingSlot } from './outings';
import { t } from '../i18n';

// Several pets fed or taken out at the same time show as one wherever the household sees them
// (@huishouden/pwa-kit/merge): "Feed Milo and Theo · AM", "Milo and Theo: AM not fed yet", "Take
// Milo and Theo out · AM". Only the same meal or outing (by its name) at the same time merges; each
// pet keeps its own record, to-do and reminder source.

const keyOf = (what: string, label: string) => `${what}:${label.trim().toLocaleLowerCase()}`.slice(0, MERGE_LIMITS.key);
const part = (name: string) => name.trim().slice(0, MERGE_LIMITS.part);

// One builder per title, used for a pet's own title and, with `{parts}`, the merged one.

/** "Feed Milo · AM": a meal on the agenda. */
export const mealTitle = (name: string, meal: string) => t('agenda.feed', { name: name.trim(), meal: meal.trim() });

/** "Milo: AM not fed yet": a meal's notification. */
export const mealReminderTitle = (name: string, meal: string) => t('notify.mealTitle', { pet: name.trim(), meal: meal.trim() });

/** A pet's meal on the agenda: "Feed {parts} · AM". */
export const mealMerge = (name: string, meal: string): MergeSpec => ({ key: keyOf('meal', meal), part: part(name), title: mealTitle('{parts}', meal) });

/** A pet's meal not fed yet, the notification: "{parts}: AM not fed yet". */
export const mealReminderMerge = (name: string, meal: string): MergeSpec => ({ key: keyOf('meal', meal), part: part(name), title: mealReminderTitle('{parts}', meal) });

/** A pet's scheduled outing, on the agenda and as a notification: "Take {parts} out · AM". */
export const outingMerge = (name: string, slot: OutingSlot): MergeSpec => ({ key: keyOf('outing', slot.label), part: part(name), title: takeOut('{parts}', slot) });
