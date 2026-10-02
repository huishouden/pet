import { CalendarSearch } from 'lucide-react';
import type { CalendarMatch } from '@huishouden/pwa-kit/calendar';
import { CalendarHint, matchWhen, useCalendarSearch } from '@huishouden/pwa-kit/react/calendar';
import { ErrorNotice, ghostButton } from '@huishouden/pwa-kit/react/ui';
import { birthdayFromMatch, birthdayQueries, guessWords, isBirthdayOf, type BirthdayGuess } from '../lib/birthday';
import { auth } from '../data/firebase';

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

/** "Yearly since 2027", "Says Miso turns 2", "In the title", or why the year is missing. */
export function guessSource(b: BirthdayMatch): string {
  if (b.guess.from === 'series') return `${b.match.title}, yearly since ${b.guess.year}`;
  if (b.guess.from === 'age' || b.guess.from === 'year') return `${b.match.title}`;
  return `${b.match.title}; the calendar doesn't say the year`;
}

/**
 * "Find in my calendar" next to Birthday: searches the member's calendars for the pet's birthday
 * and offers what each event says. Google asks for calendar access on the first tap.
 */
export function BirthdayFind({ name, available, now, onPick }: { name: string; available: boolean; now: number; onPick: (g: BirthdayGuess) => void }) {
  const search = useCalendarSearch(auth, 'Pet');
  const n = name.trim();
  const found = search.state.status === 'done' ? birthdayMatches(search.state.matches, n, now) : [];
  return (
    <div className="space-y-2">
      <button
        type="button"
        className={`${ghostButton} bg-forest-50 text-forest-700 hover:bg-forest-100 disabled:opacity-50`}
        disabled={!available || !n || search.state.status === 'searching'}
        onClick={() => void search.run(birthdayQueries(n), { seriesStart: true, limit: 10 })}
      >
        <CalendarSearch size={18} /> {search.state.status === 'searching' ? 'Searching your calendars' : 'Find birthday in my calendar'}
      </button>
      <CalendarHint app="Pet" available={available} />
      {search.state.status === 'error' && <ErrorNotice message={search.state.message} onRetry={() => void search.run(birthdayQueries(n), { seriesStart: true, limit: 10 })} />}
      {search.state.status === 'done' && found.length === 0 && (
        <p role="status" className="text-base text-stone-600">
          No birthday for {n} in your calendars from last week to a year ahead.
        </p>
      )}
      {found.length > 0 && (
        <ul className="grid gap-1.5" aria-label="Birthdays found">
          {found.map((b) => (
            <li key={b.match.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(b.guess);
                  search.reset();
                }}
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-left hover:border-forest-500 hover:bg-forest-50"
              >
                <span className="block font-medium text-stone-800">{guessWords(b.guess)}</span>
                <span className="block text-sm text-stone-600 [overflow-wrap:anywhere]">{guessSource(b)}</span>
                <span className="block text-sm text-stone-600">{matchWhen(b.match)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
