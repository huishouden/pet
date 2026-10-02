import { daysBetween, parseYmd } from '@huishouden/pwa-kit/time';

// Pet's own wording; the shared time and date helpers are in @huishouden/pwa-kit/time.

/** "4 years", "7 months", "3 weeks", "Born today"; null for a missing or future birth date. */
export function age(birthDate: string | undefined, now: number): string | null {
  const born = parseYmd(birthDate);
  if (born === null) return null;
  const days = daysBetween(born, now);
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
