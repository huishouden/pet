import { useState } from 'react';
import { ScanText, Trash2 } from 'lucide-react';
import type { Course, Meal, Pet } from '../lib/model';
import { LIMITS } from '../lib/model';
import { MAX_COURSE_DAYS, MAX_TIMES_PER_DAY, daysUntil, defaultTimes, lastDay, type CourseDraft } from '../lib/courses';
import { isMealTime, mealsOf } from '../lib/feeding';
import { isYmd, toYmd } from '../lib/time';
import type { CourseInput } from '../lib/build';
import { Chip, Dialog, Field, ghostButton, inputClass, primaryButton, secondaryButton } from './ui';

/**
 * "Scan the label": reading a medicine label on the device and turning it into a `CourseDraft` is
 * being built in the shared kit. Until it ships the button stays hidden; when it does, pass
 * `onScanLabel` (resolving to a draft, or null when the person cancels) and flip this on.
 */
export const SCAN_LABEL_ENABLED = false;

/** A short medicine course: what, how much, how often, from when and for how long. */
export function CourseDialog({ course, pet, meals, now, onSave, onDelete, onClose, onScanLabel }: {
  course: Course | null;
  pet: Pet | undefined;
  meals: Meal[];
  now: number;
  onSave: (input: CourseInput) => void;
  onDelete?: () => void;
  onClose: () => void;
  onScanLabel?: () => Promise<CourseDraft | null>;
}) {
  const mealTimes = pet ? mealsOf(meals, pet.id).map((m) => m.time) : [];
  const [name, setName] = useState(course?.name ?? '');
  const [dose, setDose] = useState(course?.dose ?? '');
  const [times, setTimes] = useState<string[]>(course?.times ?? defaultTimes(2, mealTimes));
  const [startDate, setStartDate] = useState(course?.startDate ?? toYmd(now));
  const [length, setLength] = useState<'days' | 'until'>('days');
  const [days, setDays] = useState(String(course?.days ?? 7));
  const [until, setUntil] = useState(course ? lastDay(course) : '');
  const [withFood, setWithFood] = useState(course?.withFood ?? false);
  const [notes, setNotes] = useState(course?.notes ?? '');
  const total = length === 'days' ? Math.round(Number(days)) : daysUntil(startDate, until);
  const valid = !!pet && name.trim().length > 0 && isYmd(startDate) && times.length > 0 && times.every(isMealTime) && !!total && total >= 1 && total <= MAX_COURSE_DAYS;

  const setCount = (n: number) => setTimes(defaultTimes(n, mealTimes));

  const fill = (d: CourseDraft) => {
    setName(d.name);
    setDose(d.dose);
    setTimes(d.times.length ? d.times : defaultTimes(d.timesPerDay, mealTimes));
    if (isYmd(d.startDate)) setStartDate(d.startDate);
    if (d.days) {
      setLength('days');
      setDays(String(d.days));
    }
    if (d.withFood !== undefined) setWithFood(d.withFood);
    setNotes(d.notes ?? '');
  };

  const save = () => {
    if (!valid || !pet || !total) return;
    onSave({ petId: pet.id, name, dose, timesPerDay: times.length, times, startDate, days: total, withFood, notes });
    onClose();
  };

  return (
    <Dialog
      title={course ? `Edit ${course.name}` : `Medicine course${pet ? ` for ${pet.name}` : ''}`}
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
        {SCAN_LABEL_ENABLED && onScanLabel && (
          <button
            type="button"
            className={secondaryButton}
            onClick={async () => {
              const draft = await onScanLabel();
              if (draft) fill(draft);
            }}
          >
            <ScanText size={18} /> Scan the label
          </button>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Medicine">
            <input className={inputClass} value={name} maxLength={LIMITS.courseName} onChange={(e) => setName(e.target.value)} placeholder="Antibiotic" autoComplete="off" />
          </Field>
          <Field label="Dose">
            <input className={inputClass} value={dose} maxLength={LIMITS.courseDose} onChange={(e) => setDose(e.target.value)} placeholder="1 tablet" autoComplete="off" />
          </Field>
        </div>
        <fieldset>
          <legend className="mb-1.5 block text-sm font-medium text-stone-700">How often</legend>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3].map((n) => (
              <Chip key={n} active={times.length === n} onClick={() => setCount(n)}>
                {n === 1 ? 'Once a day' : n === 2 ? 'Twice a day' : '3 times a day'}
              </Chip>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {times.map((t, i) => (
              <input
                key={i}
                className={`${inputClass} w-36`}
                type="time"
                value={t}
                aria-label={`Dose ${i + 1} time`}
                onChange={(e) => setTimes((list) => list.map((x, j) => (j === i ? e.target.value : x)))}
              />
            ))}
            {times.length < MAX_TIMES_PER_DAY && (
              <button type="button" className={ghostButton} onClick={() => setCount(times.length + 1)}>
                Another time
              </button>
            )}
          </div>
          <p className="mt-1.5 text-sm text-stone-600">After each time, a dose nobody has ticked shows as missed. Twice a day starts at the pet's AM and PM meals.</p>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First day">
            <input className={inputClass} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <fieldset>
            <legend className="mb-1.5 block text-sm font-medium text-stone-700">For</legend>
            <div className="flex items-center gap-2">
              {length === 'days' ? (
                <>
                  <input
                    className={`${inputClass} w-20 text-center tabular-nums`}
                    inputMode="numeric"
                    value={days}
                    onChange={(e) => setDays(e.target.value.replace(/\D/g, '').slice(0, 3))}
                    aria-label="Number of days"
                  />
                  <span className="text-base text-stone-700">days</span>
                  <button type="button" className={ghostButton} onClick={() => setLength('until')}>
                    Until a date
                  </button>
                </>
              ) : (
                <>
                  <input className={inputClass} type="date" value={until} min={startDate} onChange={(e) => setUntil(e.target.value)} aria-label="Last day" />
                  <button type="button" className={ghostButton} onClick={() => setLength('days')}>
                    Days
                  </button>
                </>
              )}
            </div>
          </fieldset>
        </div>
        <label className="flex min-h-11 items-center gap-3 text-base text-stone-800">
          <input type="checkbox" className="h-5 w-5 accent-forest-700" checked={withFood} onChange={(e) => setWithFood(e.target.checked)} />
          Give with food
        </label>
        <Field label="Notes (optional)">
          <textarea className={`${inputClass} min-h-20`} maxLength={LIMITS.courseNotes} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What it is for, how to give it" />
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
