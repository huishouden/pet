import { ChevronRight, Plus } from 'lucide-react';
import type { Pet, Routine, RoutineLog } from '../lib/model';
import { petsLabel, routinesOfPet, scheduleText, statusOf } from '../lib/routines';
import { doneBy } from '../lib/format';
import { cardClass, ghostButton, overline, primaryButton } from '@huishouden/pwa-kit/react/ui';
import { dueText, toYmd } from '@huishouden/pwa-kit/time';
import { useT } from '../i18n';
import { RoutineIcon } from './RoutineIcon';

/**
 * A pet's care routines on its page: each with how it repeats and where it stands (overdue, due
 * today, done today by whom, or the next day), opening the routine's sheet. A routine for several
 * pets shows on each of them. Without any, what they are for and how to start (admins and members).
 */
export function RoutinesCard({ pet, pets, routines, logs, me, now, managesRoutines, onAdd, onOpen }: {
  pet: Pet;
  pets: Pet[];
  routines: Routine[];
  logs: RoutineLog[];
  me: string;
  now: number;
  managesRoutines: boolean;
  onAdd: () => void;
  onOpen: (r: Routine) => void;
}) {
  const t = useT();
  const mine = routinesOfPet(routines, pet.id);
  const today = toYmd(now);
  return (
    <section className={`${cardClass} p-6`} aria-label={t('routines.of', { name: pet.name })}>
      <div className="flex flex-wrap items-center justify-between gap-x-4">
        <h3 className={overline}>{t('routines.title')}</h3>
        {managesRoutines && mine.length > 0 && (
          <button type="button" className={`${ghostButton} whitespace-nowrap`} onClick={onAdd} aria-label={t('routines.addFor', { name: pet.name })}>
            <Plus size={18} /> {t('routines.add')}
          </button>
        )}
      </div>
      {mine.length === 0 ? (
        <div className="mt-2">
          <p className="text-base text-muted">{pet.species === 'cat' ? t('routines.pitchCat', { name: pet.name }) : t('routines.pitch', { name: pet.name })}</p>
          {managesRoutines ? (
            <button type="button" className={`${pet.species === 'cat' ? primaryButton : ghostButton} mt-3`} onClick={onAdd} aria-label={t('routines.addFor', { name: pet.name })}>
              {t('routines.setUp')}
            </button>
          ) : (
            <p className="mt-1 text-sm text-muted">{t('routines.staffSetsUp')}</p>
          )}
        </div>
      ) : (
        <ul className="mt-1 divide-y divide-line">
          {mine.map((r) => {
            const s = statusOf(r, logs, now);
            const others = pets.filter((p) => r.petIds.includes(p.id) && p.id !== pet.id);
            const state =
              s.state === 'done' && s.log
                ? doneBy('done', s.log.by, me, s.log.at)
                : dueText(s.due, today);
            return (
              <li key={r.id}>
                <button type="button" className="-mx-2 flex min-h-14 w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-sunken" onClick={() => onOpen(r)} aria-label={t('routines.open', { name: r.name })}>
                  <RoutineIcon kind={r.kind} size={22} className="shrink-0 text-link" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-lg font-semibold text-ink">{r.name}</span>
                    <span className="block text-sm text-muted sm:text-base">
                      {scheduleText(r)}
                      {others.length > 0 && ` · ${t('routines.withPets', { pets: petsLabel({ petIds: others.map((p) => p.id) }, pets) })}`}
                    </span>
                    <span className={`block text-sm sm:text-base ${s.state === 'overdue' ? 'font-semibold text-attention' : s.state === 'done' ? 'text-link' : 'text-muted'}`}>{state}</span>
                  </span>
                  <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
