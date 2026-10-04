import { Cake, FilePlus, MoveRight, Pencil, Plus, Scale, Target, TrendingDown, TrendingUp, X } from 'lucide-react';
import type { Pet, Reminder } from '../lib/model';
import { byUrgency } from '../lib/schedule';
import { formatDayShort, parseYmd } from '@huishouden/pwa-kit/time';
import { age } from '../lib/time';
import { formatDateShort } from '../lib/format';
import { convert, formatWeight, latest, targetProgress, trend } from '../lib/weight';
import { birthdayCountdown, birthdayText } from '../lib/birthday';
import { BirthdayBand } from '../components/Celebration';
import { speciesLabel } from '../lib/care';
import { useClock } from '@huishouden/pwa-kit/react/clock';
import type { PetStore } from '../data/types';
import type { Open } from '../PetApp';
import { PetAvatar, PetChips } from '../components/PetAvatar';
import { WeightChart } from '../components/WeightChart';
import { FeedingCard, MedicineCard } from '../components/PetFeedingCards';
import { permissions } from '../lib/permissions';
import { ReminderRow } from './Care';
import { cardClass, ghostButton, iconButton, overline, primaryButton } from '@huishouden/pwa-kit/react/ui';
import { useT } from '../i18n';

/** One pet at a time: profile and care notes, its reminders, the weight log and its records. */
export function Pets({ store, pets, open, shown, onShow, onGive, onRestore, notify }: {
  store: PetStore;
  pets: Pet[];
  open: Open;
  shown: string | null;
  onShow: (id: string) => void;
  onGive: (r: Reminder) => void;
  /** Restore for a dismissed reminder, when this person may (left out otherwise). */
  onRestore: (r: Reminder) => (() => void) | undefined;
  notify: (message: string, undo?: () => void) => void;
}) {
  const t = useT();
  const { now } = useClock();
  const pet = pets.find((p) => p.id === shown) ?? pets[0];

  return (
    <div className="flex flex-col gap-5 lg:h-full lg:min-h-0">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <h2 className="text-2xl font-semibold text-ink">{t('tab.pets')}</h2>
          {pets.length > 1 && <PetChips pets={pets} selected={pet?.id ?? null} onSelect={(id) => id && onShow(id)} all={false} label={t('pets.pet')} />}
        </div>
        <button type="button" className={primaryButton} onClick={() => open.pet(null)}>
          <Plus size={20} /> {t('pets.addPet')}
        </button>
      </div>
      {!pet ? (
        <p className={`${cardClass} p-6 text-lg text-muted`}>{t('pets.empty')}</p>
      ) : (
        <PetDetail key={pet.id} pet={pet} pets={pets} store={store} open={open} now={now} onGive={onGive} onRestore={onRestore} notify={notify} />
      )}
    </div>
  );
}

function PetDetail({ pet, pets, store, open, now, onGive, onRestore, notify }: {
  pet: Pet;
  pets: Pet[];
  store: PetStore;
  open: Open;
  now: number;
  onGive: (r: Reminder) => void;
  /** Restore for a dismissed reminder, when this person may (left out otherwise). */
  onRestore: (r: Reminder) => (() => void) | undefined;
  notify: (message: string, undo?: () => void) => void;
}) {
  const t = useT();
  const reminders = byUrgency(
    store.data.reminders.filter((r) => r.petId === pet.id),
    now,
  );
  const weights = store.data.weights.filter((w) => w.petId === pet.id);
  const perms = permissions(store.role, store.me);
  const last = latest(weights);
  const tr = trend(weights, pet.weightUnit);
  const TrendIcon = tr?.direction === 'up' ? TrendingUp : tr?.direction === 'down' ? TrendingDown : MoveRight;
  const recent = [...weights].sort((a, b) => b.at - a.at).slice(0, 3);
  const records = store.data.records.filter((r) => r.petId === pet.id).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));
  const born = parseYmd(pet.birthDate);
  const ageText = age(pet.birthDate, now, pet.birthDateApprox);
  const birthday = birthdayText(pet.birthDate, now, pet.birthDateApprox);
  const party = birthdayCountdown(pet.birthDate, now, pet.birthDateApprox);
  const target = targetProgress(weights, pet.weightUnit, pet.targetWeight);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:min-h-0 lg:flex-1 lg:grid-cols-2 lg:overflow-y-auto">
      <div className="flex flex-col gap-5">
        <section className={`${cardClass} p-6`} aria-label={t('pets.profile', { name: pet.name })}>
          {party?.days === 0 && <BirthdayBand pet={pet} turns={party.turns} />}
          <div className="flex items-start gap-4">
            <PetAvatar pet={pet} pets={pets} size={64} />
            <div className="min-w-0 flex-1">
              <h3 className="text-3xl font-semibold text-ink [overflow-wrap:anywhere]">{pet.name}</h3>
              <p className="mt-0.5 text-lg text-muted">{[speciesLabel(pet.species), pet.breed, ageText].filter(Boolean).join(' · ')}</p>
              {born !== null && !pet.birthDateApprox && <p className="text-base text-muted">{t('birthday.born', { date: formatDateShort(born) })}</p>}
              {birthday && party?.days !== 0 && (
                <p className={`mt-0.5 flex items-center gap-1.5 text-base ${birthday === t('birthday.today') ? 'font-semibold text-link' : 'text-muted'}`}>
                  <Cake size={16} aria-hidden="true" /> {birthday}
                </p>
              )}
              {pet.targetWeight !== undefined && (
                <p className="mt-0.5 flex items-center gap-1.5 text-base text-muted">
                  <Target size={16} aria-hidden="true" />{' '}
                  {target
                    ? t('pets.targetWith', { weight: formatWeight(pet.targetWeight, pet.weightUnit), status: target.onTarget ? t('pets.onTarget') : target.text })
                    : t('pets.target', { weight: formatWeight(pet.targetWeight, pet.weightUnit) })}
                </p>
              )}
            </div>
            <button type="button" className={ghostButton} onClick={() => open.pet(pet)} aria-label={t('a11y.edit', { name: pet.name })}>
              <Pencil size={18} /> <span className="hidden sm:inline">{t('common.edit')}</span>
            </button>
          </div>
          {pet.notes && <p className="mt-4 rounded-xl bg-page px-4 py-3 text-lg whitespace-pre-line text-ink-soft">{pet.notes}</p>}
        </section>
        <FeedingCard pet={pet} meals={store.data.meals} feedings={store.data.feedings} me={store.me} now={now} open={open} />
        <section className={`${cardClass} p-6`} aria-label={t('pets.recordsOf', { name: pet.name })}>
          <div className="flex items-center justify-between gap-4">
            <h3 className={overline}>{t('pets.records')}</h3>
            <button type="button" className={ghostButton} onClick={() => open.record(null, pet.id)}>
              <FilePlus size={18} /> {t('pets.addRecord')}
            </button>
          </div>
          {records.length === 0 ? (
            <p className="mt-2 text-base text-muted">{t('pets.recordsEmpty')}</p>
          ) : (
            <ul>
              {records.map((r) => {
                const d = parseYmd(r.date);
                return (
                  <li key={r.id} className="border-b border-line last:border-b-0">
                    <button type="button" className="flex w-full items-start gap-4 py-3 text-left hover:bg-sunken" onClick={() => open.record(r, pet.id)} aria-label={t('pets.recordEdit', { title: r.title })}>
                      <span className="w-32 shrink-0 pt-0.5 text-base text-muted">{d !== null ? formatDateShort(d) : ''}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-lg font-semibold text-ink">{r.title}</span>
                        {r.text && <span className="line-clamp-2 block text-base text-muted">{r.text}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <div className="flex flex-col gap-5">
        <MedicineCard pet={pet} courses={store.data.courses} medDoses={store.data.medDoses} now={now} open={open} perms={perms} />
        <section className={`${cardClass} p-6`} aria-label={t('pets.careOf', { name: pet.name })}>
          <div className="flex items-center justify-between gap-4">
            <h3 className={overline}>{t('tab.care')}</h3>
            <button type="button" className={ghostButton} onClick={() => open.reminder(null, pet.id)}>
              <Plus size={18} /> {t('care.addReminder')}
            </button>
          </div>
          {reminders.length === 0 ? (
            <p className="mt-2 text-base text-muted">{t('pets.noReminders', { name: pet.name })}</p>
          ) : (
            <ul>
              {reminders.map((r) => (
                <ReminderRow key={r.id} r={r} pets={pets} now={now} onGive={() => onGive(r)} onRestore={onRestore(r)} onEdit={() => open.reminder(r)} compact />
              ))}
            </ul>
          )}
        </section>
        <section className={`${cardClass} p-6`} aria-label={t('pets.weightOf', { name: pet.name })}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className={overline}>{t('pets.weight')}</h3>
              {last ? (
                <>
                  <p className="mt-1 text-4xl font-semibold text-ink tabular-nums">{formatWeight(convert(last.value, last.unit, pet.weightUnit), pet.weightUnit)}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-base text-muted">
                    {tr && <TrendIcon size={16} aria-hidden="true" />}
                    {tr ? `${tr.text} · ` : ''}
                    {t('pets.weighed', { date: formatDayShort(last.at) })}
                  </p>
                  {target && pet.targetWeight !== undefined && (
                    <p className="mt-1 text-base text-muted">
                      <span className="font-semibold text-ink">{target.text}</span>
                      {` · ${t('pets.targetLower', { weight: formatWeight(pet.targetWeight, pet.weightUnit) })}`}
                      {pet.targetNote && ` (${pet.targetNote})`}
                      {target.headingText && (
                        <>
                          {' · '}
                          <span className={target.heading === 'away' ? 'text-attention' : undefined}>{target.headingText}</span>
                        </>
                      )}
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-1 text-lg text-muted">{t('pets.notWeighed')}</p>
              )}
            </div>
            <button type="button" className={`${primaryButton} shrink-0`} onClick={() => open.weight(pet.id)}>
              <Scale size={20} /> {t('pets.logWeight')}
            </button>
          </div>
          <WeightChart weights={weights} unit={pet.weightUnit} target={pet.targetWeight} />
          {recent.length > 0 && (
            <ul className="mt-3 border-t border-line" aria-label={t('pets.recentWeighings')}>
              {recent.map((w) => (
                <li key={w.id} className="flex min-h-11 items-center gap-3 border-b border-line last:border-b-0">
                  <span className="w-32 shrink-0 text-base text-muted">{formatDateShort(w.at)}</span>
                  <span className="flex-1 text-base font-medium text-ink tabular-nums">{formatWeight(convert(w.value, w.unit, pet.weightUnit), pet.weightUnit)}</span>
                  {perms.mayChange(w) && <button
                    type="button"
                    className={iconButton}
                    aria-label={t('pets.deleteWeighing', { date: formatDayShort(w.at) })}
                    onClick={() => {
                      store.actions.deleteWeight(w);
                      notify(t('pets.weighingDeleted', { date: formatDayShort(w.at) }), () => store.actions.restoreWeight(w));
                    }}
                  >
                    <X size={18} />
                  </button>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
