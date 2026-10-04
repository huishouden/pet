// Pet's own display phrases; the shared locale formatters are in @huishouden/pwa-kit/time.
import { formatDayShort, formatTime, formatYmd, toYmd } from '@huishouden/pwa-kit/time';
import { t } from '../i18n';

export const formatDateShort = (at: number) => formatYmd(toYmd(at));

/** "today", "yesterday", "3 days ago" within a week; otherwise the date: "Sat, Apr 12". */
export function formatWhenGiven(at: number, now: number): string {
  const d = Math.round((new Date(now).setHours(0, 0, 0, 0) - new Date(at).setHours(0, 0, 0, 0)) / 86_400_000);
  if (d === 0) return t('given.today');
  if (d === 1) return t('given.yesterday');
  if (d > 1 && d < 7) return t('given.daysAgo', { count: d });
  return formatDayShort(at);
}

/** '18:00' → "6:00 PM" in the device's locale. */
export const formatClock = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return formatTime(new Date(2031, 0, 1, h, m).getTime());
};
