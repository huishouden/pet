import { useId, useState, type ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import { ROUTINE_DEFAULTS, ROUTINE_LIMITS, type RoutineMode, type RoutineUnit } from '@huishouden/pwa-kit/pet-routines';
import { isHhmm, toYmd, weekdayName } from '@huishouden/pwa-kit/time';
import type { Pet, Routine } from '../lib/model';
import type { RoutineInput } from '../lib/build';
import { LIMITS } from '../lib/model';
import { ROUTINE_PRESET_SCHEDULES, presetName, presetsFor, type RoutinePreset } from '../lib/routines';
import { Checkbox, Chip, Dialog, Field, deleteButton, ghostButton, inputClass, primaryButton, selectClass } from '@huishouden/pwa-kit/react/ui';
import { useT } from '../i18n';

/** A labelled row of chips. Not a `Field`: its `<label>` would name the first chip. */
function ChipGroup({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id}>
      <span id={id} className="mb-1.5 block text-sm font-medium text-ink-soft">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
      {hint && <span className="mt-1 block text-sm text-muted">{hint}</span>}
    </div>
  );
}

/** Monday first. */
const WEEK = [1, 2, 3, 4, 5, 6, 0] as const;
const UNITS: readonly RoutineUnit[] = ['day', 'week', 'month'];

/**
 * Sets up a care routine: a preset (scoop the litter box, change the litter, brush...) or your own
 * name; which pets it is for (two cats, one box); how it repeats (counted from when it was last
 * done, fixed on the calendar, or on set weekdays); and an optional reminder at a time of day.
 */
export function RoutineDialog({ routine, petId, pets, now, onSave, onDelete, onClose }: {
  routine: Routine | null;
  /** The pet whose page it was opened from; checked for a new routine. */
  petId?: string;
  pets: Pet[];
  now: number;
  onSave: (input: RoutineInput) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const first = pets.find((p) => p.id === petId) ?? pets[0];
  const [kind, setKind] = useState<RoutineInput['kind']>(routine?.kind);
  const [name, setName] = useState(routine?.name ?? '');
  const [petIds, setPetIds] = useState<string[]>(routine?.petIds ?? (first ? [first.id] : []));
  const [mode, setMode] = useState<RoutineMode>(routine?.mode ?? 'after-done');
  const [every, setEvery] = useState(String(routine?.every ?? 1));
  const [unit, setUnit] = useState<RoutineUnit>(routine?.unit ?? 'week');
  const [days, setDays] = useState<number[]>(routine?.days ?? [1]);
  const [remind, setRemind] = useState(!!routine?.remind);
  const [time, setTime] = useState(routine?.time ?? ROUTINE_DEFAULTS.remindAt);
  const count = Number(every);
  const valid =
    name.trim().length > 0 &&
    petIds.length > 0 &&
    (mode === 'weekdays' ? days.length > 0 : Number.isInteger(count) && count >= 1 && count <= ROUTINE_LIMITS.every) &&
    (!remind || isHhmm(time));

  const pick = (preset: RoutinePreset | 'custom') => {
    if (preset === 'custom') {
      setKind('custom');
      return;
    }
    const s = ROUTINE_PRESET_SCHEDULES[preset];
    setKind(preset);
    setName(presetName(preset));
    setMode(s.mode);
    setEvery(String(s.every));
    setUnit(s.unit);
  };

  const save = () => {
    if (!valid) return;
    onSave({ name, kind: kind ?? 'custom', petIds, mode, every: count, unit, days, since: routine?.since ?? toYmd(now), remind, time: remind ? time : undefined });
    onClose();
  };

  const presets = presetsFor(first?.species);
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <Dialog
      title={routine ? t('routineDialog.edit') : t('routineDialog.new')}
      onClose={onClose}
      footer={
        <>
          {onDelete && (
            <button type="button" className={deleteButton} onClick={() => { onDelete(); onClose(); }}>
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
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        {!routine && (
          <ChipGroup label={t('routineDialog.preset')}>
            <>
              {presets.map((p) => (
                <Chip key={p} active={kind === p} onClick={() => pick(p)}>
                  {presetName(p)}
                </Chip>
              ))}
              <Chip active={kind === 'custom'} onClick={() => pick('custom')}>
                {t('routineDialog.custom')}
              </Chip>
            </>
          </ChipGroup>
        )}
        <Field label={t('routineDialog.name')}>
          <input className={inputClass} value={name} maxLength={LIMITS.routineName} placeholder={t('routineDialog.namePlaceholder')} onChange={(e) => setName(e.target.value)} />
        </Field>
        <ChipGroup label={t('routineDialog.pets')} hint={pets.length > 1 ? t('routineDialog.petsHint') : undefined}>
          <>
            {pets.map((p) => (
              <Chip key={p.id} active={petIds.includes(p.id)} onClick={() => setPetIds(toggle(petIds, p.id))}>
                {p.name}
              </Chip>
            ))}
          </>
        </ChipGroup>
        <ChipGroup label={t('routineDialog.repeats')}>
          <>
            <Chip active={mode === 'after-done'} onClick={() => setMode('after-done')}>
              {t('routineDialog.afterDone')}
            </Chip>
            <Chip active={mode === 'fixed'} onClick={() => setMode('fixed')}>
              {t('routineDialog.fixed')}
            </Chip>
            <Chip active={mode === 'weekdays'} onClick={() => setMode('weekdays')}>
              {t('routineDialog.weekdays')}
            </Chip>
          </>
        </ChipGroup>
        {mode === 'weekdays' ? (
          <ChipGroup label={t('routineDialog.onDays')}>
            <>
              {WEEK.map((d) => (
                <Chip key={d} active={days.includes(d)} onClick={() => setDays(toggle(days, d))}>
                  {weekdayName(d, { short: true })}
                </Chip>
              ))}
            </>
          </ChipGroup>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:max-w-md">
            <Field label={t('routineDialog.every')}>
              <input className={inputClass} type="number" inputMode="numeric" min={1} max={ROUTINE_LIMITS.every} value={every} onChange={(e) => setEvery(e.target.value)} />
            </Field>
            <Field label={t('routineDialog.unit')}>
              <select className={selectClass} value={unit} onChange={(e) => setUnit(e.target.value as RoutineUnit)}>
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u === 'day' ? t('routineDialog.unitDay', { count }) : u === 'week' ? t('routineDialog.unitWeek', { count }) : t('routineDialog.unitMonth', { count })}
                  </option>
                ))}
              </select>
            </Field>
            <p className="col-span-2 text-base text-muted">{mode === 'after-done' ? t('routineDialog.afterDoneHint') : t('routineDialog.fixedHint')}</p>
          </div>
        )}
        <Checkbox checked={remind} onChange={setRemind}>
          {t('routineDialog.remind')}
        </Checkbox>
        {remind && (
          <Field label={t('routineDialog.time')} hint={t('routineDialog.timeHint')}>
            <input className={`${inputClass} max-w-40`} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        )}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
