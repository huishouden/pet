// Display formatting in the device's locale. Kept apart from time.ts, whose output tests pin down.

export const formatTime = (t: number) => new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

export const formatDayLong = (t: number) => new Date(t).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

export const formatDateLong = (t: number) =>
  new Date(t).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export const formatDayShort = (t: number) => new Date(t).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

export const monthShort = (t: number) => new Date(t).toLocaleDateString(undefined, { month: 'short' });

export const formatDateShort = (t: number) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** "today", "yesterday", "3 days ago" within a week; otherwise the date: "Sat, Apr 12". */
export function formatWhenGiven(t: number, now: number): string {
  const d = Math.round((new Date(now).setHours(0, 0, 0, 0) - new Date(t).setHours(0, 0, 0, 0)) / 86_400_000);
  if (d === 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d > 1 && d < 7) return `${d} days ago`;
  return formatDayShort(t);
}

/** '18:00' → "6:00 PM" in the device's locale. */
export const formatClock = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return formatTime(new Date(2031, 0, 1, h, m).getTime());
};
