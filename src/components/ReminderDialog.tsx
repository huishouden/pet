import { useState } from 'react';
import { BellOff, RotateCcw, Trash2 } from 'lucide-react';
import type { Dose, Pet, Reminder, ReminderKind } from '../lib/model';
import { LIMITS, REMINDER_KINDS } from '../lib/model';
import { kindLabel, presetsFor, type Preset } from '../lib/care';
import { UNITS, describeRecurrence, isRecurring, type Unit } from '../lib/schedule';
import { formatTime, isYmd, toYmd } from '@huishouden/pwa-kit/time';
import { formatDateShort } from '../lib/format';
import { personName } from '@huishouden/pwa-kit/people';
import type { ReminderInput } from '../lib/build';
import { PetAvatar } from './PetAvatar';
import { Chip, Dialog, Field, ghostButton, inputClass, primaryButton, secondaryButton } from '@huishouden/pwa-kit/react/ui';
import { useT } from '../i18n';
import { AddToCalendar } from '@huishouden/pwa-kit/react/calendar';
import { reminderEntry } from '../lib/agenda';

// i18n-dynamic: unit.
const UNIT_KEYS = { day: 'unit.day', week: 'unit.week', month: 'unit.month', year: 'unit.year' } as const satisfies Record<Unit, string>;

export function ReminderDialog({ reminder, petId: initialPet, pets, doses, members: _members, me, now, onSave, onDismiss, onRestore, onDelete, onClose }: {
  reminder: Reminder | null;
  petId?: string;
  pets: Pet[];
  doses: Dose[];
  members: string[];
  me: string;
  now: number;
  onSave: (input: ReminderInput) => void;
  /** Stops it coming due; it stays in the care list as Dismissed. */
  onDismiss?: () => void;
  /** Brings a dismissed one back. */
  onRestore?: () => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const t = useT();
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
      dismissedAt: reminder?.dismissedAt,
    });
    onClose();
  };

  return (
    <Dialog
      title={reminder ? t('reminderDialog.edit') : t('reminderDialog.new')}
      onClose={onClose}
      footer={
        <>
          {reminder && reminderEntry(reminder, pets, now) && <AddToCalendar entry={reminderEntry(reminder, pets, now)!} />}
          {onDelete && (
            <button
              type="button"
              className="mr-auto inline-flex min-h-11 items-center gap-2 rounded-xl px-3 font-medium text-error hover:bg-sunken"
              onClick={() => {
                onDelete();
                onClose();
              }}
            >
              <Trash2 size={18} /> {t('common.delete')}
            </button>
          )}
          <button type="button" className={ghostButton} onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className={primaryButton} disabled={!valid} onClick={save}>
            {t('common.save')}
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
            <legend className="mb-1.5 block text-sm font-medium text-ink-soft">{t('form.for')}</legend>
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
            <legend className="mb-1.5 block text-sm font-medium text-ink-soft">{t('reminderDialog.startFrom')}</legend>
            <div className="flex flex-wrap gap-2">
              {presetsFor(pet?.species).map((p) => (
                <Chip key={p.title} active={title === p.title} onClick={() => usePreset(p)}>
                  {p.title}
                </Chip>
              ))}
            </div>
            <p className="mt-1.5 text-sm text-muted">{t('reminderDialog.presetsHint')}</p>
          </fieldset>
        )}
        <Field label={t('form.what')}>
          <input className={inputClass} value={title} maxLength={LIMITS.reminderTitle} onChange={(e) => setTitle(e.target.value)} placeholder={t('preset.fleaTick')} />
        </Field>
        <Field label={t('form.kind')}>
          <select className={inputClass} value={kind} onChange={(e) => setKind(e.target.value as ReminderKind)}>
            {REMINDER_KINDS.map((k) => (
              <option key={k} value={k}>
                {kindLabel(k)}
              </option>
            ))}
          </select>
        </Field>
        <fieldset>
          <legend className="mb-1.5 block text-sm font-medium text-ink-soft">{t('reminderDialog.repeats')}</legend>
          <div className="flex flex-wrap items-center gap-2">
            <Chip active={!repeats} onClick={() => setRepeats(false)}>
              {t('care.once')}
            </Chip>
            <Chip active={repeats} onClick={() => setRepeats(true)}>
              {t('reminderDialog.repeats')}
            </Chip>
            {repeats && (
              <span className="flex items-center gap-2">
                <span className="text-base text-ink-soft">{t('reminderDialog.every')}</span>
                <input
                  className={`${inputClass} max-w-20 text-center tabular-nums`}
                  inputMode="numeric"
                  value={every}
                  onChange={(e) => setEvery(e.target.value.replace(/\D/g, '').slice(0, 3))}
                  aria-label={t('reminderDialog.everyHowMany')}
                />
                <select className={`${inputClass} max-w-32`} value={unit} onChange={(e) => setUnit(e.target.value as Unit)} aria-label={t('weightDialog.unit')}>
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {t(UNIT_KEYS[u], { count: everyN || 1 })}
                    </option>
                  ))}
                </select>
              </span>
            )}
          </div>
          {repeats && <p className="mt-1.5 text-sm text-muted">{t('reminderDialog.repeatHint', { every: describeRecurrence({ every: everyN || 1, unit }).toLowerCase() })}</p>}
        </fieldset>
        <Field label={repeats ? t('reminderDialog.nextDue') : t('reminderDialog.due')}>
          <input className={inputClass} type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>
        <Field label={t('form.notesOptional')}>
          <textarea className={`${inputClass} min-h-20`} maxLength={LIMITS.reminderNotes} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('reminderDialog.notesPlaceholder')} />
        </Field>
        {history.length > 0 && (
          <section aria-label={t('today.given')}>
            <h3 className="mb-1 text-sm font-medium text-ink-soft">{t('today.given')}</h3>
            <ul className="rounded-xl border border-line">
              {history.map((d) => (
                <li key={d.id} className="flex min-h-11 items-center justify-between gap-3 border-b border-line px-3 text-base last:border-b-0">
                  <span className="text-ink">{t('appointments.when', { day: formatDateShort(d.at), time: formatTime(d.at) })}</span>
                  <span className="text-muted">{t('reminderDialog.by', { name: personName(d.by, { email: me }) })}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {reminder && reminder.dismissedAt === undefined && onDismiss && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-3">
            <button
              type="button"
              className={secondaryButton}
              onClick={() => {
                onDismiss();
                onClose();
              }}
            >
              <BellOff size={18} /> {t('todo.dismiss')}
            </button>
            <p className="min-w-0 flex-1 text-sm text-muted">{t('reminderDialog.dismissHint')}</p>
          </div>
        )}
        {reminder && reminder.dismissedAt !== undefined && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-3">
            <p className="min-w-0 flex-1 text-base text-ink-soft">{t('reminderDialog.dismissedOn', { date: formatDateShort(reminder.dismissedAt) })}</p>
            {onRestore && (
              <button
                type="button"
                className={secondaryButton}
                onClick={() => {
                  onRestore();
                  onClose();
                }}
              >
                <RotateCcw size={18} /> {t('care.restore')}
              </button>
            )}
          </div>
        )}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
