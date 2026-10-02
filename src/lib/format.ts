// Pet's own display phrases; the shared locale formatters are in @huishouden/pwa-kit/time.
import { formatDayShort, formatTime } from '@huishouden/pwa-kit/time';

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
