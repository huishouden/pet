import { daysBetween, parseYmd } from '@huishouden/pwa-kit/time';
import { t } from '../i18n';

// Pet's own wording; the shared time and date helpers are in @huishouden/pwa-kit/time.

/**
 * "4 years", "7 months", "3 weeks", "Born today"; null for a missing or future birth date. An
 * approximate birth date (an age typed in, not a birthday) reads "About 6 years", "About 1 year",
 * "About 4 months": nothing finer than the age that was entered.
 */
export function age(birthDate: string | undefined, now: number, approx?: boolean): string | null {
  const born = parseYmd(birthDate);
  if (born === null) return null;
  const days = daysBetween(born, now);
  if (days < 0) return null;
  if (approx) return approxAge(born, now);
  if (days === 0) return t('age.bornToday');
  if (days < 14) return t('age.days', { count: days });
  const b = new Date(born);
  const n = new Date(now);
  let months = (n.getFullYear() - b.getFullYear()) * 12 + n.getMonth() - b.getMonth();
  if (n.getDate() < b.getDate()) months -= 1;
  if (months < 2) return t('age.weeks', { count: Math.floor(days / 7) });
  if (months < 24) return t('age.months', { count: months });
  const years = Math.floor(months / 12);
  return t('age.years', { count: years });
}

function approxAge(born: number, now: number): string {
  const b = new Date(born);
  const n = new Date(now);
  let months = (n.getFullYear() - b.getFullYear()) * 12 + n.getMonth() - b.getMonth();
  if (n.getDate() < b.getDate()) months -= 1;
  if (months < 1) return t('age.underMonth');
  if (months < 12) return t('age.aboutMonths', { count: months });
  const years = Math.floor(months / 12);
  return t('age.aboutYears', { count: years });
}
