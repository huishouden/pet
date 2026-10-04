import { useState, type ReactNode } from 'react';
import { Check, Pencil, Plus, RotateCcw } from 'lucide-react';
import type { Pet, Reminder } from '../lib/model';
import { describeRecurrence, dueState, dueText, groupByDue } from '../lib/schedule';
import { formatDayShort, parseYmd } from '@huishouden/pwa-kit/time';
import { formatWhenGiven } from '../lib/format';
import { useClock } from '@huishouden/pwa-kit/react/clock';
import type { PetStore } from '../data/types';
import type { Open } from '../PetApp';
import { PetAvatar, PetChips } from '../components/PetAvatar';
import { cardClass, iconButton, overline, primaryButton, secondaryButton } from '@huishouden/pwa-kit/react/ui';
import { useT } from '../i18n';
import { forPet } from '../lib/today';

/** Every reminder, grouped by how soon it is due, with one-tap Given. */
export function Care({ store, pets, open, onGive, onRestore, deviceSettings }: {
  store: PetStore;
  pets: Pet[];
  open: Open;
  onGive: (r: Reminder) => void;
  /** Restore for a dismissed reminder, when this person may (left out otherwise). */
  onRestore: (r: Reminder) => (() => void) | undefined;
  notify: (message: string, undo?: () => void) => void;
  deviceSettings?: ReactNode;
}) {
  const t = useT();
  const { now } = useClock();
  const [petId, setPetId] = useState<string | null>(null);
  const reminders = store.data.reminders.filter((r) => pets.some((p) => p.id === r.petId) && (!petId || r.petId === petId));
  const groups = groupByDue(reminders, now);

  return (
    <div className="mx-auto max-w-4xl space-y-5 lg:h-full lg:overflow-y-auto">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <h2 className="text-2xl font-semibold text-ink">{t('tab.care')}</h2>
        <button type="button" className={primaryButton} onClick={() => open.reminder(null, petId ?? undefined)} disabled={pets.length === 0}>
          <Plus size={20} /> {t('care.addReminder')}
        </button>
      </div>
      {pets.length > 1 && <PetChips pets={pets} selected={petId} onSelect={setPetId} />}
      {pets.length === 0 && <p className={`${cardClass} p-6 text-lg text-muted`}>{t('care.addPetFirst')}</p>}
      {pets.length > 0 && groups.length === 0 && (
        <p className={`${cardClass} p-6 text-lg text-muted`}>{t('care.empty')}</p>
      )}
      {groups.map((g) => (
        <section key={g.id} aria-label={g.label}>
          <h3 className={`${overline} mb-2 ${g.id === 'overdue' ? 'text-attention!' : ''}`}>
            {t('care.groupCount', { label: g.label, count: g.items.length })}
          </h3>
          <ul className={cardClass}>
            {g.items.map((r) => (
              <ReminderRow key={r.id} r={r} pets={pets} now={now} onGive={() => onGive(r)} onRestore={onRestore(r)} onEdit={() => open.reminder(r)} />
            ))}
          </ul>
        </section>
      ))}
      {deviceSettings}
    </div>
  );
}

export function ReminderRow({ r, pets, now, onGive, onRestore, onEdit, compact }: {
  r: Reminder;
  pets: Pet[];
  now: number;
  onGive: () => void;
  /** Brings a dismissed reminder back; absent for those who may not. */
  onRestore?: () => void;
  onEdit: () => void;
  compact?: boolean;
}) {
  const t = useT();
  const pet = pets.find((p) => p.id === r.petId);
  const state = dueState(r, now);
  const dismissed = state === 'dismissed';
  const urgent = state === 'overdue' || state === 'today';
  const due = parseYmd(r.due);
  const dueColour = urgent ? 'text-attention' : state === 'done' ? 'text-link' : dismissed ? 'text-muted' : 'text-ink-soft';
  const meta = [
    compact ? null : pet?.name,
    describeRecurrence(r),
    compact || state === 'done' ? null : dismissed ? (r.dismissedAt ? t('care.dismissedOn', { date: formatDayShort(r.dismissedAt) }) : null) : due !== null ? formatDayShort(due) : null,
    compact ? null : r.lastDoneAt ? t('care.lastGiven', { when: formatWhenGiven(r.lastDoneAt, now) }) : null,
  ].filter(Boolean);
  return (
    <li className={`flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line last:border-b-0 ${compact ? 'py-3' : 'px-4 py-4 sm:flex-nowrap sm:px-5'}`}>
      {!compact && <PetAvatar pet={pet} pets={pets} size={40} />}
      <div className={`min-w-0 flex-1 ${compact ? '' : 'basis-[calc(100%-4rem)] sm:basis-auto'}`}>
        <p className={`${compact ? 'text-lg' : 'text-xl'} font-semibold text-ink`}>{r.title}</p>
        <p className="text-base text-muted">
          {compact && <span className={`font-semibold ${dueColour}`}>{dueText(r, now)} · </span>}
          {meta.join(' · ')}
        </p>
      </div>
      {!compact && <p className={`mr-auto shrink-0 text-lg font-semibold sm:mr-0 sm:text-right ${dueColour}`}>{dueText(r, now)}</p>}
      {state !== 'done' && !dismissed && (
        <button type="button" className={urgent || state === 'soon' ? primaryButton : secondaryButton} onClick={onGive} aria-label={pet ? t('care.markGivenTo', { title: r.title, pet: pet.name }) : t('care.markGiven', { title: r.title })}>
          <Check size={18} /> {t('today.given')}
        </button>
      )}
      {dismissed && onRestore && (
        <button type="button" className={secondaryButton} onClick={onRestore} aria-label={t('care.restoreName', { name: forPet(r.title, pet?.name) })}>
          <RotateCcw size={18} /> {t('care.restore')}
        </button>
      )}
      <button type="button" className={iconButton} onClick={onEdit} aria-label={t('a11y.edit', { name: forPet(r.title, pet?.name) })}>
        <Pencil size={18} />
      </button>
    </li>
  );
}
