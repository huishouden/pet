// Calendar-day arithmetic and wording. Pure: every function takes `now` instead of reading the clock.

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** Local midnight at the start of the day containing `t`. */
export function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Local midnight `days` days after the day containing `t` (DST-safe). */
export function addDays(t: number, days: number): number {
  const d = new Date(startOfDay(t));
  d.setDate(d.getDate() + days);
  return d.getTime();
}

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

export const isYmd = (s: unknown): s is string => typeof s === 'string' && YMD.test(s) && parseYmd(s) !== null;

/** 'YYYY-MM-DD' to local midnight, or null when malformed or not a real day. */
export function parseYmd(ymd: string | undefined | null): number | null {
  if (!ymd) return null;
  const m = YMD.exec(ymd);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return date.getTime();
}

export function toYmd(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Whole calendar days from the day of `from` to the day of `to` (negative when `to` is earlier). */
export function calendarDaysBetween(from: number, to: number): number {
  return Math.round((startOfDay(to) - startOfDay(from)) / DAY);
}

/** "Today", "Tomorrow", "In 5 days", "Yesterday", "12 days ago", by calendar day. */
export function relativeDay(t: number, now: number): string {
  const d = calendarDaysBetween(now, t);
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  if (d === -1) return 'Yesterday';
  return d > 0 ? `In ${d} days` : `${-d} days ago`;
}

/** Value for <input type="datetime-local">, in local time. */
export function toLocalInput(t: number): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function fromLocalInput(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : Math.round(t);
}

/** "4 years", "7 months", "3 weeks", "Born today"; null for a missing or future birth date. */
export function age(birthDate: string | undefined, now: number): string | null {
  const born = parseYmd(birthDate);
  if (born === null) return null;
  const days = calendarDaysBetween(born, now);
  if (days < 0) return null;
  if (days === 0) return 'Born today';
  if (days < 14) return `${days} day${days === 1 ? '' : 's'}`;
  const b = new Date(born);
  const n = new Date(now);
  let months = (n.getFullYear() - b.getFullYear()) * 12 + n.getMonth() - b.getMonth();
  if (n.getDate() < b.getDate()) months -= 1;
  if (months < 2) return `${Math.floor(days / 7)} weeks`;
  if (months < 24) return `${months} months`;
  const years = Math.floor(months / 12);
  return `${years} years`;
}
