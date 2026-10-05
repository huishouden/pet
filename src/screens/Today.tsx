import type { ReactNode } from 'react';
import { Cake, CalendarDays, ChevronRight, DoorOpen, PawPrint, Pill, Plus, Syringe, Utensils } from 'lucide-react';
import type { Course, Meal, Outing, Pet, Reminder } from '../lib/model';
import type { OutingSlot } from '../lib/outings';
import { OutingsBoard } from '../components/OutingsBoard';
import { toYmd, type Ymd } from '@huishouden/pwa-kit/time';
import { allDoneLine, birthdaysToday, comingUp, doneNow, laterToday, needsDoing, type ComingItem, type LaterItem, type Need } from '../lib/today';
import { useClock } from '@huishouden/pwa-kit/react/clock';
import type { PetStore } from '../data/types';
import type { Open } from '../PetApp';
import { PetAvatar } from '../components/PetAvatar';
import { FeedingBoard } from '../components/FeedingBoard';
import { NeedsDoing } from '../components/NeedsDoing';
import { BirthdayCard } from '../components/Celebration';
import { cardClass, ghostButton, overline, primaryButton } from '@huishouden/pwa-kit/react/ui';
import { useT } from '../i18n';

const COMING_SHOWN = 5;

/**
 * "What needs doing for the pets right now?": what is due or late at the top, with its one tap; then
 * the rest of today and what is coming up; then the day's board and the pets, each a tap from its page.
 */
export function Today({ store, pets, open, onGive, onToggleMeal, onToggleDose, onLogOuting, onUndoOuting, afterNeeds }: {
  store: PetStore;
  pets: Pet[];
  open: Open;
  onGive: (r: Reminder) => void;
  onToggleMeal: (pet: Pet, meal: Meal, day: number) => void;
  onToggleDose: (pet: Pet, course: Course, slot: number, day: Ymd) => void;
  onLogOuting: (pet: Pet, slot: OutingSlot, poop: boolean) => void;
  onUndoOuting: (o: Outing) => void;
  /** Shown just below Needs doing (calendar suggestions). */
  afterNeeds?: ReactNode;
}) {
  const t = useT();
  const { now } = useClock();
  const { data } = store;

  if (pets.length === 0)
    return (
      <section className={`${cardClass} mx-auto max-w-2xl p-8`} aria-label={t('today.welcome')}>
        <PawPrint size={32} className="text-link" aria-hidden="true" />
        <h2 className="mt-3 text-3xl font-semibold text-ink">{t('today.firstPet')}</h2>
        <p className="mt-2 text-lg text-muted">{t('today.firstPetBody')}</p>
        <button type="button" className={`${primaryButton} mt-5`} onClick={() => open.pet(null)}>
          <Plus size={20} /> {t('today.addPet')}
        </button>
      </section>
    );

  const needs = needsDoing(data, pets, now);
  const done = doneNow(data, pets, now);
  const later = laterToday(data, pets, now);
  const coming = comingUp(data, pets, now);
  const parties = birthdaysToday(pets, now);
  const petOf = (id: string) => pets.find((p) => p.id === id);

  const doNeed = (n: Need) => {
    const pet = petOf(n.petId);
    if (n.kind === 'care') onGive(n.reminder);
    else if (n.kind === 'meal' && pet) onToggleMeal(pet, n.meal, now);
    else if (n.kind === 'dose' && pet) onToggleDose(pet, n.course, n.slot, toYmd(now));
  };
  const openNeed = (n: Need) => {
    if (n.kind === 'care') open.reminder(n.reminder);
    else if (n.kind === 'dose') open.doseLog(n.course);
    else open.showPet(n.petId);
  };

  return (
    <div className="flex flex-col gap-5 lg:h-full lg:overflow-y-auto [&>*]:shrink-0">
      <NeedsDoing needs={needs} done={done} pets={pets} me={store.me} now={now} allDone={allDoneLine(later)} onDo={doNeed} onUndo={doNeed} onOpen={openNeed} />
      <OutingsBoard
        pets={pets}
        plans={data.outingPlans}
        meals={data.meals}
        outings={data.outings}
        me={store.me}
        now={now}
        onLog={onLogOuting}
        onUndo={onUndoOuting}
        onEdit={(o) => open.outing(o, o.petId)}
        onAdd={(petId) => open.outing(null, petId)}
      />
      {afterNeeds}
      {parties.map(({ pet, countdown }) => (
        <BirthdayCard key={pet.id} pet={pet} pets={pets} turns={countdown.turns} onOpen={() => open.showPet(pet.id)} />
      ))}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 md:grid-cols-2 md:items-start">
        <section className={`${cardClass} px-5 py-4 sm:px-6`} aria-label={t('today.later')}>
          <h2 className={overline}>{t('today.later')}</h2>
          {later.length === 0 ? (
            <p className="mt-2 text-lg text-muted">{t('today.nothingElse')}</p>
          ) : (
            <ul className="mt-1">
              {later.map((l) => (
                <LaterRow key={l.key} item={l} onOpen={l.appointment ? () => open.appointment(l.appointment!) : undefined} />
              ))}
            </ul>
          )}
        </section>
        {coming.length > 0 && (
          <section className={`${cardClass} px-5 py-4 sm:px-6`} aria-label={t('today.comingUp')}>
            <h2 className={overline}>{t('today.comingUp')}</h2>
            <ul className="mt-1">
              {coming.slice(0, COMING_SHOWN).map((c) => (
                <ComingRow key={c.key} item={c} pets={pets} onOpen={() => openComing(c, open)} />
              ))}
            </ul>
            {coming.length > COMING_SHOWN && (
              <button type="button" className={`${ghostButton} -ml-2 mt-1`} onClick={() => open.tab('care')}>
                {t('today.moreOnCare', { count: coming.length - COMING_SHOWN })} <ChevronRight size={18} />
              </button>
            )}
          </section>
        )}
      </div>
      <FeedingBoard
        pets={pets}
        meals={data.meals}
        feedings={data.feedings}
        courses={data.courses}
        medDoses={data.medDoses}
        me={store.me}
        now={now}
        onToggleMeal={onToggleMeal}
        onToggleDose={onToggleDose}
        onAddMeal={(petId) => open.meal(null, petId)}
      />
      <PetsRow pets={pets} onShow={open.showPet} />
    </div>
  );
}

function openComing(c: ComingItem, open: Open) {
  if (c.reminder) open.reminder(c.reminder);
  else if (c.appointment) open.appointment(c.appointment);
  else open.showPet(c.petIds[0]);
}

const LATER_ICON = { dose: Pill, meal: Utensils, appointment: CalendarDays, outing: DoorOpen } as const;

function LaterRow({ item, onOpen }: { item: LaterItem; onOpen?: () => void }) {
  const Icon = LATER_ICON[item.kind];
  const body = (
    <>
      <span className="w-24 shrink-0 text-base font-medium text-ink-soft tabular-nums">{item.time}</span>
      <Icon size={18} className="shrink-0 text-muted" aria-hidden="true" />
      <span className="min-w-0 flex-1 text-lg text-ink">{item.title}</span>
    </>
  );
  return (
    <li className="border-b border-line last:border-b-0">
      {onOpen ? (
        <button type="button" onClick={onOpen} className="flex min-h-12 w-full items-center gap-3 py-2 text-left hover:bg-sunken">
          {body}
        </button>
      ) : (
        <div className="flex min-h-12 items-center gap-3 py-2">{body}</div>
      )}
    </li>
  );
}

function ComingRow({ item, pets, onOpen }: { item: ComingItem; pets: Pet[]; onOpen: () => void }) {
  const pet = pets.find((p) => p.id === item.petIds[0]);
  return (
    <li className="border-b border-line last:border-b-0">
      <button type="button" onClick={onOpen} className="flex min-h-12 w-full items-center gap-3 py-2 text-left hover:bg-sunken">
        {item.kind === 'birthday' ? (
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-tint text-link" aria-hidden="true">
            <Cake size={18} />
          </span>
        ) : item.kind === 'care' ? (
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sunken text-muted" aria-hidden="true">
            <Syringe size={16} />
          </span>
        ) : (
          <PetAvatar pet={pet} pets={pets} size={32} />
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-lg leading-snug text-ink">{item.title}</span>
          <span className="block text-base text-muted">{item.detail}</span>
        </span>
      </button>
    </li>
  );
}

/** Just the pets: photo and name, each opening the pet's page, where everything about them lives. */
function PetsRow({ pets, onShow }: { pets: Pet[]; onShow: (id: string) => void }) {
  const t = useT();
  return (
    <section className={`${cardClass} px-5 py-4 sm:px-6`} aria-label={t('tab.pets')}>
      <h2 className={overline}>{t('tab.pets')}</h2>
      <ul className="mt-2 flex flex-wrap gap-2">
        {pets.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => onShow(p.id)} className="flex min-h-12 items-center gap-2.5 rounded-full border border-line bg-surface py-1 pr-4 pl-1 text-lg font-medium text-ink hover:border-forest-400" aria-label={t('today.petPage', { name: p.name })}>
              <PetAvatar pet={p} pets={pets} size={40} />
              <span translate="no">{p.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
