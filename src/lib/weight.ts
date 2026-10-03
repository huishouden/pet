// Weight log maths: units, the latest weight and the trend. The chart is the kit's QuantityChart. Pure.

import { DAY, daysBetween } from '@huishouden/pwa-kit/time';

export type WeightUnit = 'kg' | 'lb';
export const WEIGHT_UNITS: readonly WeightUnit[] = ['kg', 'lb'];

const LB_PER_KG = 2.2046226218;

export function convert(value: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return value;
  return from === 'kg' ? value * LB_PER_KG : value / LB_PER_KG;
}

/** One decimal: "11.8 lb", "4.0 kg". */
export function formatWeight(value: number, unit: WeightUnit): string {
  return `${(Math.round(value * 10) / 10).toFixed(1)} ${unit}`;
}

/** Parses what people type ("11.8", "11,8") into a positive number, or null. */
export function parseWeight(text: string): number | null {
  const v = Number(text.trim().replace(',', '.'));
  return Number.isFinite(v) && v > 0 && v < 2000 ? Math.round(v * 100) / 100 : null;
}

interface Entry {
  at: number;
  value: number;
  unit: WeightUnit;
}

/** Entries oldest first, each converted to `unit`. */
export function series<T extends Entry>(entries: T[], unit: WeightUnit): (T & { shown: number })[] {
  return [...entries].sort((a, b) => a.at - b.at).map((e) => ({ ...e, shown: convert(e.value, e.unit, unit) }));
}

export function latest<T extends Entry>(entries: T[]): T | null {
  return entries.reduce<T | null>((best, e) => (!best || e.at > best.at ? e : best), null);
}

export interface Trend {
  direction: 'up' | 'down' | 'steady';
  /** Change in `unit`, positive when gaining. */
  change: number;
  days: number;
  /** "Up 0.6 lb in 3 months", "Down 0.2 kg in 6 weeks", "Steady over 2 months". */
  text: string;
}

const span = (days: number) => {
  if (days < 14) return `${days} day${days === 1 ? '' : 's'}`;
  if (days < 60) return `${Math.round(days / 7)} weeks`;
  const months = Math.round(days / 30.44);
  return months < 24 ? `${months} months` : `${Math.round(days / 365.25)} years`;
};

/**
 * Change from the earliest weighing within `windowDays` before the latest one, to the latest.
 * Changes under 1% of body weight read as steady (scales and fur vary that much). Null with
 * fewer than two weighings in the window.
 */
export function trend(entries: Entry[], unit: WeightUnit, windowDays = 180): Trend | null {
  const s = series(entries, unit);
  const last = s.at(-1);
  if (!last) return null;
  const inWindow = s.filter((e) => e !== last && last.at - e.at <= windowDays * DAY);
  const first = inWindow[0];
  if (!first) return null;
  const change = Math.round((last.shown - first.shown) * 10) / 10;
  const days = daysBetween(first.at, last.at);
  if (Math.abs(change) < Math.max(0.1, last.shown * 0.01)) return { direction: 'steady', change: 0, days, text: `Steady over ${span(days)}` };
  const direction = change > 0 ? 'up' : 'down';
  return { direction, change, days, text: `${direction === 'up' ? 'Up' : 'Down'} ${formatWeight(Math.abs(change), unit)} in ${span(days)}` };
}

export interface TargetProgress {
  /** Latest weight minus the target, in the pet's unit. */
  difference: number;
  onTarget: boolean;
  /** "1.8 lb to lose", "0.4 kg to gain", "On target". */
  text: string;
  /** Which way the recent trend is going relative to the target; null when on target or no trend. */
  heading: 'toward' | 'away' | 'steady' | null;
  /** "Heading toward the target", "Moving away from the target", "Holding steady". */
  headingText: string | null;
}

/** Within this share of the target, a weight is on target (scales and fur vary that much). */
export const ON_TARGET_SHARE = 0.02;

/** How the latest weight stands against the target, and whether the trend is closing the gap. */
export function targetProgress(entries: Entry[], unit: WeightUnit, target: number | undefined): TargetProgress | null {
  const last = latest(entries);
  if (!last || !target) return null;
  const difference = Math.round((convert(last.value, last.unit, unit) - target) * 10) / 10;
  if (Math.abs(difference) <= target * ON_TARGET_SHARE) return { difference, onTarget: true, text: 'On target', heading: null, headingText: null };
  const text = `${formatWeight(Math.abs(difference), unit)} to ${difference > 0 ? 'lose' : 'gain'}`;
  const t = trend(entries, unit);
  if (!t) return { difference, onTarget: false, text, heading: null, headingText: null };
  if (t.direction === 'steady') return { difference, onTarget: false, text, heading: 'steady', headingText: 'Holding steady' };
  const toward = (difference > 0) === (t.direction === 'down');
  return { difference, onTarget: false, text, heading: toward ? 'toward' : 'away', headingText: toward ? 'Heading toward the target' : 'Moving away from the target' };
}
