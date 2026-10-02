import { Fragment } from 'react';
import { Check, Pill, Utensils, Syringe } from 'lucide-react';
import type { Pet } from '../lib/model';
import type { Need } from '../lib/today';
import { PetAvatar } from './PetAvatar';
import { cardClass, primaryButton } from '@huishouden/pwa-kit/react/ui';

const KIND_ICON = { dose: Pill, meal: Utensils, care: Syringe } as const;

/**
 * The top of Today: everything due now or past due, most overdue first, each with its one tap
 * (Given, Fed). Late ones say how late in terracotta. With nothing due, one calm line and what is next.
 */
export function NeedsDoing({ needs, pets, allDone, onDo, onOpen }: {
  needs: Need[];
  pets: Pet[];
  /** "All done for now · next: …", shown when nothing is due. */
  allDone: string;
  onDo: (need: Need) => void;
  /** Opens the thing itself (the reminder, the course's doses by day, the pet). */
  onOpen: (need: Need) => void;
}) {
  const late = needs.filter((n) => n.late).length;
  return (
    <section className={`${cardClass} px-4 py-4 sm:px-6 sm:py-5`} aria-label="Needs doing">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-xl font-semibold text-stone-800 sm:text-2xl">Needs doing</h2>
        {late > 0 && <p className="text-base font-medium text-terracotta-dark sm:text-lg">{late} past due</p>}
      </div>
      {needs.length === 0 ? (
        <p className="mt-2 flex items-center gap-3 text-xl font-medium text-forest-700 sm:text-2xl" aria-live="polite">
          <Check size={28} className="shrink-0" aria-hidden="true" /> {allDone}
        </p>
      ) : (
        <ul className="mt-1" aria-label="Due now">
          {needs.map((n) => (
            <NeedRow key={n.key} need={n} pet={pets.find((p) => p.id === n.petId)} pets={pets} onDo={() => onDo(n)} onOpen={() => onOpen(n)} />
          ))}
        </ul>
      )}
    </section>
  );
}

function NeedRow({ need, pet, pets, onDo, onOpen }: { need: Need; pet: Pet | undefined; pets: Pet[]; onDo: () => void; onOpen: () => void }) {
  const Icon = need.kind === 'care' && need.reminder.kind === 'medication' ? Pill : KIND_ICON[need.kind];
  return (
    <li className="flex items-center gap-3 border-b border-stone-200 py-3 last:border-b-0 sm:gap-4">
      <span className={`h-12 w-1.5 shrink-0 rounded-full ${need.late ? 'bg-terracotta' : 'bg-forest-200'}`} aria-hidden="true" />
      <span className="hidden sm:block">
        <PetAvatar pet={pet} pets={pets} size={44} />
      </span>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 rounded-xl text-left" aria-label={`${need.title}, ${need.when}. Open`}>
        <span className={`flex items-center gap-2 text-xl leading-tight font-semibold sm:text-2xl ${need.late ? 'text-terracotta-dark' : 'text-stone-800'}`}>
          <Icon size={20} className="hidden shrink-0 sm:block" aria-hidden="true" />
          <span className="min-w-0 [overflow-wrap:anywhere]">{need.title}</span>
        </span>
        <span className={`mt-0.5 block text-base sm:text-lg ${need.late ? 'font-medium text-terracotta-dark' : 'text-stone-600'}`}>
          {need.when.split(' · ').map((part, i) => (
            <Fragment key={i}>
              {i > 0 && ' · '}
              <span className="whitespace-nowrap">{part}</span>
            </Fragment>
          ))}
        </span>
      </button>
      <button type="button" className={`${primaryButton} min-h-14 shrink-0 px-4 text-lg sm:min-w-32 sm:px-5`} onClick={onDo} aria-label={`${need.action}: ${need.title}`}>
        <Check size={22} /> {need.action}
      </button>
    </li>
  );
}
