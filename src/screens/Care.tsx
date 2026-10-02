import { useState } from 'react';
import { Check, Pencil, Plus } from 'lucide-react';
import type { Pet, Reminder } from '../lib/model';
import { describeRecurrence, dueState, dueText, groupByDue } from '../lib/schedule';
import { parseYmd } from '../lib/time';
import { formatDayShort, formatWhenGiven } from '../lib/format';
import { useClock } from '../clock';
import type { PetStore } from '../data/types';
import type { Open } from '../PetApp';
import { PetAvatar, PetChips } from '../components/PetAvatar';
import { cardClass, iconButton, overline, primaryButton, secondaryButton } from '../components/ui';

/** Every reminder, grouped by how soon it is due, with one-tap Given. */
export function Care({ store, pets, open, onGive }: {
  store: PetStore;
  pets: Pet[];
  open: Open;
  onGive: (r: Reminder) => void;
  notify: (message: string, undo?: () => void) => void;
}) {
  const { now } = useClock();
  const [petId, setPetId] = useState<string | null>(null);
  const reminders = store.data.reminders.filter((r) => pets.some((p) => p.id === r.petId) && (!petId || r.petId === petId));
  const groups = groupByDue(reminders, now);

  return (
    <div className="mx-auto max-w-4xl space-y-5 lg:h-full lg:overflow-y-auto">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <h2 className="text-2xl font-semibold text-stone-800">Care</h2>
        <button type="button" className={primaryButton} onClick={() => open.reminder(null, petId ?? undefined)} disabled={pets.length === 0}>
          <Plus size={20} /> Add reminder
        </button>
      </div>
      {pets.length > 1 && <PetChips pets={pets} selected={petId} onSelect={setPetId} />}
      {pets.length === 0 && <p className={`${cardClass} p-6 text-lg text-stone-600`}>Add a pet first, on the Pets tab.</p>}
      {pets.length > 0 && groups.length === 0 && (
        <p className={`${cardClass} p-6 text-lg text-stone-600`}>No reminders yet. Add flea and tick, heartworm, vaccines or a medication, and Pet says when each is due.</p>
      )}
      {groups.map((g) => (
        <section key={g.label} aria-label={g.label}>
          <h3 className={`${overline} mb-2 ${g.label === 'Overdue' ? 'text-terracotta-dark' : ''}`}>
            {g.label} ({g.items.length})
          </h3>
          <ul className={cardClass}>
            {g.items.map((r) => (
              <ReminderRow key={r.id} r={r} pets={pets} now={now} onGive={() => onGive(r)} onEdit={() => open.reminder(r)} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function ReminderRow({ r, pets, now, onGive, onEdit, compact }: { r: Reminder; pets: Pet[]; now: number; onGive: () => void; onEdit: () => void; compact?: boolean }) {
  const pet = pets.find((p) => p.id === r.petId);
  const state = dueState(r, now);
  const urgent = state === 'overdue' || state === 'today';
  const due = parseYmd(r.due);
  const dueColour = urgent ? 'text-terracotta-dark' : state === 'done' ? 'text-forest-700' : 'text-stone-700';
  const meta = [
    compact ? null : pet?.name,
    describeRecurrence(r),
    compact || state === 'done' ? null : due !== null ? formatDayShort(due) : null,
    compact ? null : r.lastDoneAt ? `last given ${formatWhenGiven(r.lastDoneAt, now)}` : null,
  ].filter(Boolean);
  return (
    <li className={`flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-stone-200 last:border-b-0 ${compact ? 'py-3' : 'px-4 py-4 sm:flex-nowrap sm:px-5'}`}>
      {!compact && <PetAvatar pet={pet} pets={pets} size={40} />}
      <div className={`min-w-0 flex-1 ${compact ? '' : 'basis-[calc(100%-4rem)] sm:basis-auto'}`}>
        <p className={`${compact ? 'text-lg' : 'text-xl'} font-semibold text-stone-800`}>{r.title}</p>
        <p className="text-base text-stone-600">
          {compact && <span className={`font-semibold ${dueColour}`}>{dueText(r, now)} · </span>}
          {meta.join(' · ')}
        </p>
      </div>
      {!compact && <p className={`mr-auto shrink-0 text-lg font-semibold sm:mr-0 sm:text-right ${dueColour}`}>{dueText(r, now)}</p>}
      {state !== 'done' && (
        <button type="button" className={urgent || state === 'soon' ? primaryButton : secondaryButton} onClick={onGive} aria-label={`Mark ${r.title} given to ${pet?.name ?? 'the pet'}`}>
          <Check size={18} /> Given
        </button>
      )}
      <button type="button" className={iconButton} onClick={onEdit} aria-label={`Edit ${r.title}${pet ? ` for ${pet.name}` : ''}`}>
        <Pencil size={18} />
      </button>
    </li>
  );
}
