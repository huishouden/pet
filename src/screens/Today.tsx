import { CalendarPlus, Check, ChevronRight, MapPin, PawPrint, Plus } from 'lucide-react';
import type { Course, Meal, Pet, Reminder } from '../lib/model';
import { byUrgency, describeRecurrence, dueState, headline, needsAttention } from '../lib/schedule';
import { petNames } from '../lib/pets';
import { formatDayLong, formatTime, relativeDay } from '@huishouden/pwa-kit/time';
import { formatWhenGiven } from '../lib/format';
import { useClock } from '@huishouden/pwa-kit/react/clock';
import type { PetStore } from '../data/types';
import type { Open } from '../PetApp';
import { PetAvatar } from '../components/PetAvatar';
import { FeedingBoard } from '../components/FeedingBoard';
import { cardClass, ghostButton, overline, primaryButton } from '@huishouden/pwa-kit/react/ui';

const SHOWN = 4;

/** The wall view: who has been fed today, what care is due, and the next appointment. */
export function Today({ store, pets, open, onGive, onToggleMeal, onToggleDose }: {
  store: PetStore;
  pets: Pet[];
  open: Open;
  onGive: (r: Reminder) => void;
  onToggleMeal: (pet: Pet, meal: Meal) => void;
  onToggleDose: (pet: Pet, course: Course, slot: number) => void;
}) {
  const { now } = useClock();
  const { reminders, appointments } = store.data;
  const live = reminders.filter((r) => pets.some((p) => p.id === r.petId));
  const attention = needsAttention(live, now);
  const nextLater = byUrgency(live, now).find((r) => dueState(r, now) === 'later');
  const upcoming = appointments.filter((a) => a.at >= now - 3_600_000).sort((a, b) => a.at - b.at);
  const [next, ...later] = upcoming;

  if (pets.length === 0)
    return (
      <section className={`${cardClass} mx-auto max-w-2xl p-8`} aria-label="Welcome">
        <PawPrint size={32} className="text-forest-700" aria-hidden="true" />
        <h2 className="mt-3 text-3xl font-semibold text-stone-800">Add your first pet</h2>
        <p className="mt-2 text-lg text-stone-600">Then add their flea, heartworm and vaccine reminders, vet visits and weight. Everyone in the household sees the same.</p>
        <button type="button" className={`${primaryButton} mt-5`} onClick={() => open.pet(null)}>
          <Plus size={20} /> Add a pet
        </button>
      </section>
    );

  return (
    <div className="flex flex-col gap-5 lg:h-full lg:min-h-0">
      <FeedingBoard
        pets={pets}
        meals={store.data.meals}
        feedings={store.data.feedings}
        courses={store.data.courses}
        medDoses={store.data.medDoses}
        me={store.me}
        now={now}
        onToggleMeal={onToggleMeal}
        onToggleDose={onToggleDose}
        onAddMeal={(petId) => open.meal(null, petId)}
      />
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_400px]">
      <section className={`${cardClass} flex min-h-0 flex-col px-6 py-5`} aria-label="Needs attention">
        <div className="flex items-center justify-between gap-4">
          <h2 className={overline}>{attention.length ? 'Needs attention' : 'Care'}</h2>
          <button type="button" className={ghostButton} onClick={() => open.tab('care')}>
            All care <ChevronRight size={18} />
          </button>
        </div>
        {attention.length === 0 ? (
          <div className="py-4">
            <p className="flex items-center gap-3 text-3xl font-semibold text-forest-700">
              <Check size={32} aria-hidden="true" /> All care is up to date
            </p>
            {nextLater && (
              <p className="mt-3 text-xl text-stone-600">
                Next: {headline(nextLater, now)} for {petNames([nextLater.petId], pets)}.
              </p>
            )}
            {live.length === 0 && (
              <button type="button" className={`${primaryButton} mt-5`} onClick={() => open.reminder(null)}>
                <Plus size={20} /> Add a reminder
              </button>
            )}
          </div>
        ) : (
          <ul className="min-h-0 flex-1 overflow-y-auto" aria-label="Reminders due">
            {attention.slice(0, SHOWN).map((r) => (
              <AttentionRow key={r.id} r={r} pet={pets.find((p) => p.id === r.petId)} pets={pets} now={now} onGive={() => onGive(r)} onOpen={() => open.reminder(r)} />
            ))}
            {attention.length > SHOWN && (
              <li className="pt-3">
                <button type="button" className={ghostButton} onClick={() => open.tab('care')}>
                  {attention.length - SHOWN} more on Care <ChevronRight size={18} />
                </button>
              </li>
            )}
          </ul>
        )}
      </section>

      <div className="flex min-h-0 flex-col gap-6">
        <section className={`${cardClass} px-6 py-5`} aria-label="Next appointment">
          <div className="flex items-center justify-between gap-4">
            <h2 className={overline}>Next appointment</h2>
            <div className="flex gap-1">
              <button type="button" className={ghostButton} onClick={() => open.appointment(null)} aria-label="Add appointment">
                <CalendarPlus size={18} /> Add
              </button>
              <button type="button" className={ghostButton} onClick={() => open.tab('appointments')}>
                All <ChevronRight size={18} />
              </button>
            </div>
          </div>
          {next ? (
            <>
              <button type="button" className="mt-1 -mx-2 w-[calc(100%+1rem)] rounded-xl px-2 py-1 text-left hover:bg-stone-50" onClick={() => open.appointment(next)}>
                <p className="text-2xl font-semibold text-stone-800">{next.title}</p>
                <p className="mt-1 text-lg text-stone-700">
                  <span className="font-semibold text-forest-700">{relativeDay(next.at, now)}</span> · {formatDayLong(next.at)}, {formatTime(next.at)}
                </p>
                <p className="mt-0.5 text-base text-stone-600">{petNames(next.petIds, pets)}</p>
                {next.location && (
                  <p className="mt-0.5 flex items-center gap-1.5 text-base text-stone-600">
                    <MapPin size={16} aria-hidden="true" /> {next.location}
                  </p>
                )}
              </button>
              {later.length > 0 && (
                <ul className="mt-2 border-t border-stone-200">
                  {later.slice(0, 2).map((a) => (
                    <li key={a.id}>
                      <button type="button" onClick={() => open.appointment(a)} className="flex min-h-12 w-full items-center gap-3 border-b border-stone-200 py-2 text-left last:border-b-0 hover:bg-stone-50">
                        <span className="w-24 shrink-0 text-base font-medium text-stone-600">{relativeDay(a.at, now)}</span>
                        <span className="min-w-0 flex-1 truncate text-base text-stone-800">{a.title}</span>
                        <span className="shrink-0 text-sm text-stone-600">{petNames(a.petIds, pets)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="mt-2 text-lg text-stone-600">No appointments coming up.</p>
          )}
        </section>
      </div>
    </div>
    </div>
  );
}

function AttentionRow({ r, pet, pets, now, onGive, onOpen }: { r: Reminder; pet: Pet | undefined; pets: Pet[]; now: number; onGive: () => void; onOpen: () => void }) {
  const state = dueState(r, now);
  const urgent = state === 'overdue' || state === 'today';
  const last = r.lastDoneAt ? `last given ${formatWhenGiven(r.lastDoneAt, now)}` : null;
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-stone-200 py-3 last:border-b-0 sm:flex-nowrap">
      <span className={`hidden h-12 w-1.5 shrink-0 rounded-full sm:block ${urgent ? 'bg-terracotta' : 'bg-stone-200'}`} aria-hidden="true" />
      <PetAvatar pet={pet} pets={pets} size={40} />
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 basis-[calc(100%-4rem)] rounded-xl text-left sm:basis-auto" aria-label={`${headline(r, now)}, ${pet?.name ?? ''}. Edit`}>
        <span className={`block text-xl leading-tight font-semibold sm:text-2xl ${urgent ? 'text-terracotta-dark' : 'text-stone-800'}`}>{headline(r, now)}</span>
        <span className="mt-1 block text-base text-stone-600 sm:text-lg">{[pet?.name, describeRecurrence(r), last].filter(Boolean).join(' · ')}</span>
      </button>
      <button type="button" className={`${primaryButton} min-h-12 w-full shrink-0 px-5 text-lg sm:w-auto`} onClick={onGive} aria-label={`Mark ${r.title} given to ${pet?.name ?? 'the pet'}`}>
        <Check size={22} /> Given
      </button>
    </li>
  );
}
