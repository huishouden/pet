import { CalendarSearch } from 'lucide-react';
import type { CalendarMatch } from '@huishouden/pwa-kit/calendar';
import { CalendarHint, matchWhen, useCalendarSearch } from '@huishouden/pwa-kit/react/calendar';
import { ErrorNotice, ghostButton } from '@huishouden/pwa-kit/react/ui';
import { birthdayFromMatch, birthdayQueries, guessWords, isBirthdayOf, type BirthdayGuess } from '../lib/birthday';
import { auth } from '../data/firebase';
import { t as tr } from '../i18n';
import { useT } from '../i18n';

/** A birthday event found for a pet, with what it says about the birth date. */
export interface BirthdayMatch {
  match: CalendarMatch;
  guess: BirthdayGuess;
}

/** The pet's birthday events among calendar matches, each with its guess; one per series. */
export function birthdayMatches(matches: CalendarMatch[], name: string, now: number): BirthdayMatch[] {
  const seen = new Set<string>();
  return matches
    .filter((m) => isBirthdayOf(m.title, name))
    .filter((m) => {
      const key = m.recurringEventId ?? m.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((match) => ({ match, guess: birthdayFromMatch(match, now) }));
}

/** The event's title, and what the calendar says about the year. */
export function guessSource(b: BirthdayMatch): string {
  if (b.guess.from === 'age' || b.guess.from === 'year') return b.match.title;
  if (b.guess.suggestedYear !== undefined) return tr('birthdayFind.since', { title: b.match.title, year: String(b.guess.suggestedYear) });
  return tr('birthdayFind.noYear', { title: b.match.title });
}

/**
 * "Find in my calendar" next to Birthday: searches the member's calendars for the pet's birthday
 * and offers what each event says. Google asks for calendar access on the first tap.
 */
export function BirthdayFind({ name, available, now, onPick }: { name: string; available: boolean; now: number; onPick: (g: BirthdayGuess) => void }) {
  const t = useT();
  const search = useCalendarSearch(auth, 'Pet');
  const n = name.trim();
  const found = search.state.status === 'done' ? birthdayMatches(search.state.matches, n, now) : [];
  return (
    <div className="space-y-2">
      <button
        type="button"
        className={`${ghostButton} bg-tint hover:bg-tint-strong disabled:opacity-50`}
        disabled={!available || !n || search.state.status === 'searching'}
        onClick={() => void search.run(birthdayQueries(n), { seriesStart: true, limit: 10 })}
      >
        <CalendarSearch size={18} /> {search.state.status === 'searching' ? t('birthdayFind.searching') : t('birthdayFind.find')}
      </button>
      <CalendarHint app="Pet" name={t('app.name')} available={available} />
      {search.state.status === 'error' && <ErrorNotice message={search.state.message} onRetry={() => void search.run(birthdayQueries(n), { seriesStart: true, limit: 10 })} />}
      {search.state.status === 'done' && found.length === 0 && (
        <p role="status" className="text-base text-muted">
          {t('birthdayFind.none', { name: n })}
        </p>
      )}
      {found.length > 0 && (
        <ul className="grid gap-1.5" aria-label={t('birthdayFind.found')}>
          {found.map((b) => (
            <li key={b.match.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(b.guess);
                  search.reset();
                }}
                className="w-full rounded-xl border border-line px-3 py-2 text-left hover:border-forest-500 hover:bg-tint"
              >
                <span className="block font-medium text-ink">{guessWords(b.guess)}</span>
                <span className="block text-sm text-muted [overflow-wrap:anywhere]">{guessSource(b)}</span>
                <span className="block text-sm text-muted">{matchWhen(b.match)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
