import { Cake, ChevronRight } from 'lucide-react';
import type { Pet } from '../lib/model';
import { celebrationLine, celebrationTitle } from '../lib/today';
import { PetAvatar } from './PetAvatar';

// The suite's one celebration (DESIGN.md, Celebrations): a pet's birthday, on the day only. Confetti
// in the chart colours, settling once on arrival; still under prefers-reduced-motion (index.css).

const COLOURS = ['#2d6a4f', '#c86d51', '#b08d57', '#5b7a99', '#8a6f9e', '#6f8f72', '#a8735a'];

/** Fixed pieces (x, y in %, rotation, shape) so every render and screenshot is the same. They fall along the top and bottom edges, clear of the words at any width. */
const PIECES: [number, number, number, 'rect' | 'dot'][] = [
  [4, 18, 20, 'rect'], [11, 70, -35, 'dot'], [17, 32, 60, 'rect'], [24, 82, 10, 'rect'], [31, 14, -15, 'dot'],
  [38, 58, 45, 'rect'], [46, 24, -60, 'rect'], [53, 78, 0, 'dot'], [60, 12, 30, 'rect'], [67, 64, -25, 'rect'],
  [73, 30, 75, 'dot'], [80, 84, -45, 'rect'], [86, 20, 15, 'rect'], [92, 56, -70, 'dot'], [97, 30, 40, 'rect'],
];

/** A piece's height: the top 12% or the bottom 12% of the card, inside the padding. */
const edge = (y: number) => (y < 50 ? 2 + y * 0.2 : 86 + (y - 50) * 0.24);

export function Confetti({ className = '' }: { className?: string }) {
  return (
    <svg className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} aria-hidden="true" preserveAspectRatio="none">
      {PIECES.map(([x, y, r, shape], i) => (
        <g key={i} className="confetti-piece" style={{ animationDelay: `${(i % 5) * 60}ms` }}>
          {shape === 'dot' ? (
            <circle cx={`${x}%`} cy={`${edge(y)}%`} r="3.5" fill={COLOURS[i % COLOURS.length]} />
          ) : (
            <rect x={`${x}%`} y={`${edge(y)}%`} width="9" height="4" rx="1.5" fill={COLOURS[i % COLOURS.length]} transform={`rotate(${r})`} style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
          )}
        </g>
      ))}
    </svg>
  );
}

/** Today's festive card: "Happy birthday, Biscuit!", tapping through to the pet's page. */
export function BirthdayCard({ pet, pets, turns, onOpen }: { pet: Pet; pets: Pet[]; turns: number; onOpen: () => void }) {
  return (
    <section aria-label={`${pet.name}'s birthday`} className="relative overflow-hidden rounded-2xl border border-forest-200 bg-forest-50 shadow-sm">
      <Confetti />
      <button type="button" onClick={onOpen} className="relative flex w-full items-center gap-4 px-5 py-5 text-left sm:px-6" aria-label={`${celebrationTitle(pet.name)} ${celebrationLine(pet.name, turns)}. Open ${pet.name}'s page`}>
        <span className="relative shrink-0">
          <PetAvatar pet={pet} pets={pets} size={56} />
          <span className="absolute -right-1 -bottom-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-terracotta text-white ring-2 ring-white" aria-hidden="true">
            <Cake size={16} />
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-2xl font-semibold text-forest-700 sm:text-3xl">{celebrationTitle(pet.name)}</span>
          <span className="block text-lg text-stone-700">{celebrationLine(pet.name, turns)}</span>
        </span>
        <ChevronRight size={22} className="shrink-0 text-stone-600" aria-hidden="true" />
      </button>
    </section>
  );
}

/** The pet page's party band, at the top of the profile on the day. */
export function BirthdayBand({ pet, turns }: { pet: Pet; turns: number }) {
  return (
    <div role="status" className="relative -mx-6 -mt-6 mb-5 overflow-hidden rounded-t-2xl border-b border-forest-200 bg-forest-50 px-6 py-6">
      <Confetti />
      <p className="relative flex items-center gap-3 text-2xl font-semibold text-forest-700 sm:text-3xl">
        <Cake size={28} className="shrink-0 text-terracotta" aria-hidden="true" />
        {celebrationTitle(pet.name)}
      </p>
      <p className="relative mt-1 text-lg text-stone-700">{celebrationLine(pet.name, turns)}</p>
    </div>
  );
}
