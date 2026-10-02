import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { Dose, Pet, Reminder, ReminderKind } from '../lib/model';
import { LIMITS, REMINDER_KINDS } from '../lib/model';
import { KIND_LABELS, presetsFor, type Preset } from '../lib/care';
import { UNITS, describeRecurrence, isRecurring, type Unit } from '../lib/schedule';
import { formatTime, isYmd, toYmd } from '@huishouden/pwa-kit/time';
import { formatDateShort } from '../lib/format';
import { personName } from '@huishouden/pwa-kit/people';
import type { ReminderInput } from '../lib/build';
import { PetAvatar } from './PetAvatar';
import { Chip, Dialog, Field, ghostButton, inputClass, primaryButton } from '@huishouden/pwa-kit/react/ui';

export function ReminderDialog({ reminder, petId: initialPet, pets, doses, members: _members, me, now, onSave, onDelete, onClose }: {
  reminder: Reminder | null;
  petId?: string;
  pets: Pet[];
  doses: Dose[];
  members: string[];
  me: string;
  now: number;
  onSave: (input: ReminderInput) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [petId, setPetId] = useState(reminder?.petId ?? initialPet ?? pets[0]?.id ?? '');
  const [kind, setKind] = useState<ReminderKind>(reminder?.kind ?? 'flea-tick');
  const [title, setTitle] = useState(reminder?.title ?? '');
  const [repeats, setRepeats] = useState(reminder ? isRecurring(reminder) : true);
  const [every, setEvery] = useState(String(reminder?.every ?? 1));
  const [unit, setUnit] = useState<Unit>(reminder?.unit ?? 'month');
  const [due, setDue] = useState(reminder?.due ?? toYmd(now));
  const [notes, setNotes] = useState(reminder?.notes ?? '');
  const pet = pets.find((p) => p.id === petId);
  const everyN = Math.round(Number(every));
  const valid = !!petId && title.trim().length > 0 && isYmd(due) && (!repeats || (everyN >= 1 && everyN <= LIMITS.every));
  const history = reminder ? doses.filter((d) => d.reminderId === reminder.id).sort((a, b) => b.at - a.at).slice(0, 5) : [];

  const usePreset = (p: Preset) => {
    setKind(p.kind);
    setTitle(p.title);
    setRepeats(true);
    setEvery(String(p.every));
    setUnit(p.unit);
  };

  const save = () => {
    if (!valid) return;
    onSave({
      petId,
      kind,
      title,
      every: repeats ? everyN : undefined,
      unit: repeats ? unit : undefined,
      due,
      // A one-off made recurring again starts fresh; edits otherwise keep when it was last given.
      lastDoneAt: reminder?.lastDoneAt,
      notes,
    });
    onClose();
  };

  return (
    <Dialog
      title={reminder ? 'Edit reminder' : 'New reminder'}
      onClose={onClose}
      footer={
        <>
          {onDelete && (
            <button
              type="button"
              className="mr-auto inline-flex min-h-11 items-center gap-2 rounded-xl px-3 font-medium text-red-700 hover:bg-stone-100"
              onClick={() => {
                onDelete();
                onClose();
              }}
            >
              <Trash2 size={18} /> Delete
            </button>
          )}
          <button type="button" className={ghostButton} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={primaryButton} disabled={!valid} onClick={save}>
            Save
          </button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        {pets.length > 1 && (
          <fieldset>
            <legend className="mb-1.5 block text-sm font-medium text-stone-700">For</legend>
            <div className="flex flex-wrap gap-2">
              {pets.map((p) => (
                <Chip key={p.id} active={petId === p.id} onClick={() => setPetId(p.id)}>
                  <PetAvatar pet={p} pets={pets} size={24} /> {p.name}
                </Chip>
              ))}
            </div>
          </fieldset>
        )}
        {!reminder && (
          <fieldset>
            <legend className="mb-1.5 block text-sm font-medium text-stone-700">Start from</legend>
            <div className="flex flex-wrap gap-2">
              {presetsFor(pet?.species).map((p) => (
                <Chip key={p.title} active={title === p.title} onClick={() => usePreset(p)}>
                  {p.title}
                </Chip>
              ))}
            </div>
            <p className="mt-1.5 text-sm text-stone-600">Common schedules. Follow your vet's advice and change anything below.</p>
          </fieldset>
        )}
        <Field label="What">
          <input className={inputClass} value={title} maxLength={LIMITS.reminderTitle} onChange={(e) => setTitle(e.target.value)} placeholder="Flea and tick" />
        </Field>
        <Field label="Kind">
          <select className={inputClass} value={kind} onChange={(e) => setKind(e.target.value as ReminderKind)}>
            {REMINDER_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </Field>
        <fieldset>
          <legend className="mb-1.5 block text-sm font-medium text-stone-700">Repeats</legend>
          <div className="flex flex-wrap items-center gap-2">
            <Chip active={!repeats} onClick={() => setRepeats(false)}>
              Once
            </Chip>
            <Chip active={repeats} onClick={() => setRepeats(true)}>
              Repeats
            </Chip>
            {repeats && (
              <span className="flex items-center gap-2">
                <span className="text-base text-stone-700">every</span>
                <input
                  className={`${inputClass} max-w-20 text-center tabular-nums`}
                  inputMode="numeric"
                  value={every}
                  onChange={(e) => setEvery(e.target.value.replace(/\D/g, '').slice(0, 3))}
                  aria-label="Every how many"
                />
                <select className={`${inputClass} max-w-32`} value={unit} onChange={(e) => setUnit(e.target.value as Unit)} aria-label="Unit">
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {everyN === 1 ? u : `${u}s`}
                    </option>
                  ))}
                </select>
              </span>
            )}
          </div>
          {repeats && <p className="mt-1.5 text-sm text-stone-600">The next one is due {describeRecurrence({ every: everyN || 1, unit }).toLowerCase()} after each dose, counted from the day it is given.</p>}
        </fieldset>
        <Field label={repeats ? 'Next due' : 'Due'}>
          <input className={inputClass} type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>
        <Field label="Notes (optional)">
          <textarea className={`${inputClass} min-h-20`} maxLength={LIMITS.reminderNotes} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Dose, brand, with food" />
        </Field>
        {history.length > 0 && (
          <section aria-label="Given">
            <h3 className="mb-1 text-sm font-medium text-stone-700">Given</h3>
            <ul className="rounded-xl border border-stone-200">
              {history.map((d) => (
                <li key={d.id} className="flex min-h-11 items-center justify-between gap-3 border-b border-stone-200 px-3 text-base last:border-b-0">
                  <span className="text-stone-800">
                    {formatDateShort(d.at)}, {formatTime(d.at)}
                  </span>
                  <span className="text-stone-600">by {personName(d.by, { email: me })}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
