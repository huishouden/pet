// Weight log maths: units, the latest weight, the trend, and the points of the small chart. Pure.

import { DAY, calendarDaysBetween } from './time';

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
  const days = calendarDaysBetween(first.at, last.at);
  if (Math.abs(change) < Math.max(0.1, last.shown * 0.01)) return { direction: 'steady', change: 0, days, text: `Steady over ${span(days)}` };
  const direction = change > 0 ? 'up' : 'down';
  return { direction, change, days, text: `${direction === 'up' ? 'Up' : 'Down'} ${formatWeight(Math.abs(change), unit)} in ${span(days)}` };
}

export interface ChartGeometry {
  points: { x: number; y: number; at: number; value: number }[];
  /** Rounded bounds of the y axis, in `unit`. */
  min: number;
  max: number;
  path: string;
}

/**
 * Points of a line chart `width` × `height` (inside `pad`), x by time and y by weight, with the y range
 * padded so a steady weight doesn't look like a cliff.
 */
export function chart(entries: Entry[], unit: WeightUnit, width: number, height: number, pad = 8): ChartGeometry | null {
  const s = series(entries, unit);
  if (s.length === 0) return null;
  const values = s.map((e) => e.shown);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const margin = Math.max((hi - lo) * 0.25, hi * 0.03, 0.5);
  const min = Math.floor((lo - margin) * 2) / 2;
  const max = Math.ceil((hi + margin) * 2) / 2;
  const t0 = s[0].at;
  const t1 = s.at(-1)!.at;
  const x = (t: number) => (t1 === t0 ? width / 2 : pad + ((t - t0) / (t1 - t0)) * (width - 2 * pad));
  const y = (v: number) => pad + (1 - (v - min) / (max - min)) * (height - 2 * pad);
  const points = s.map((e) => ({ x: round(x(e.at)), y: round(y(e.shown)), at: e.at, value: e.shown }));
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ');
  return { points, min, max, path };
}

const round = (n: number) => Math.round(n * 10) / 10;
