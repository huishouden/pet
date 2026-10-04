import { useState } from 'react';
import { GiversField, type GiversValue } from '@huishouden/pwa-kit/react/roles';
import { toMedCourse, type ParsedCourse } from '@huishouden/pwa-kit/dose';
import { LabelScan, type LabelFill } from '@huishouden/pwa-kit/react/dose';
import { Trash2 } from 'lucide-react';
import type { Course, Meal, Pet } from '../lib/model';
import { LIMITS } from '../lib/model';
import { MAX_COURSE_DAYS, MAX_TIMES_PER_DAY, daysUntil, defaultTimes, lastDay, type CourseDraft } from '../lib/courses';
import { mealsOf } from '../lib/feeding';
import { isYmd, toYmd, isHhmm } from '@huishouden/pwa-kit/time';
import type { CourseInput } from '../lib/build';
import { Chip, Dialog, Field, ghostButton, inputClass, primaryButton } from '@huishouden/pwa-kit/react/ui';
import { useT } from '../i18n';
import { formatList } from '@huishouden/pwa-kit/i18n';
import { formatClock } from '../lib/format';


/** A short medicine course: what, how much, how often, from when and for how long. */
export function CourseDialog({ course, pet, meals, now, helpers = [], nameOf = (e) => e, onSave, onDelete, onClose }: {
  course: Course | null;
  pet: Pet | undefined;
  meals: Meal[];
  now: number;
  /** The household's helpers, who the course can be restricted to. */
  helpers?: string[];
  nameOf?: (email: string) => string;
  onSave: (input: CourseInput) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const t = useT();
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
  const [givers, setGivers] = useState<GiversValue>({ givers: course?.givers ?? 'all', approvedHelpers: course?.approvedHelpers ?? [] });
  const total = length === 'days' ? Math.round(Number(days)) : daysUntil(startDate, until);
  const valid = !!pet && name.trim().length > 0 && isYmd(startDate) && times.length > 0 && times.every(isHhmm) && !!total && total >= 1 && total <= MAX_COURSE_DAYS;

  const setCount = (n: number) => setTimes(defaultTimes(n, mealTimes));
  // "Scan the label" (the kit's LabelScan): the photo is read on this device and never stored or
  // uploaded; the course is filled from it and the card says field by field what was filled.
  const readLabelInto = (parsed: ParsedCourse): LabelFill[] => {
    // The pet's first meals (`defaultMeals`: ids end in -am and -pm, whatever language named them).
    const am = mealsOf(meals, pet?.id ?? '').find((m) => m.id.endsWith('-am') || m.name === 'AM')?.time;
    const pm = mealsOf(meals, pet?.id ?? '').find((m) => m.id.endsWith('-pm') || m.name === 'PM')?.time;
    const draft = toMedCourse(parsed, { startDate: toYmd(now), defaultTimes: { ...(am ? { morning: am } : {}), ...(pm ? { evening: pm } : {}) } });
    if (!draft.name && !draft.dose && draft.times.length === 0) return [];
    fill(draft);
    return [
      { label: t('courseDialog.medicine'), value: draft.name },
      { label: t('courseDialog.dose'), value: draft.dose },
      { label: t('courseDialog.times'), value: formatList(draft.times.map(formatClock)) },
      { label: t('courseDialog.days'), value: draft.days ? String(draft.days) : '' },
      { label: t('courseDialog.food'), value: draft.withFood === true ? t('courseDialog.withFood') : '' },
      { label: t('common.notes'), value: draft.notes },
    ];
  };

  const fill = (d: CourseDraft) => {
    if (d.name) setName(d.name.slice(0, LIMITS.courseName));
    if (d.dose) setDose(d.dose.slice(0, LIMITS.courseDose));
    if (d.times.length) setTimes(d.times.slice(0, MAX_TIMES_PER_DAY));
    else if (d.timesPerDay) setTimes(defaultTimes(d.timesPerDay, mealTimes));
    if (isYmd(d.startDate)) setStartDate(d.startDate);
    if (d.days) {
      setLength('days');
      setDays(String(d.days));
    }
    if (d.withFood !== undefined) setWithFood(d.withFood);
    if (d.notes) setNotes(d.notes.slice(0, LIMITS.courseNotes));
  };

  const save = () => {
    if (!valid || !pet || !total) return;
    onSave({ petId: pet.id, name, dose, timesPerDay: times.length, times, startDate, days: total, withFood, notes, ...givers });
    onClose();
  };

  return (
    <Dialog
      title={course ? t('a11y.edit', { name: course.name }) : pet ? t('courseDialog.newFor', { name: pet.name }) : t('courseDialog.new')}
      onClose={onClose}
      footer={
        <>
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
        <LabelScan onRead={readLabelInto} intro={t('courseDialog.scanIntro')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('courseDialog.medicine')}>
            <input className={inputClass} value={name} maxLength={LIMITS.courseName} onChange={(e) => setName(e.target.value)} placeholder={t('courseDialog.medicinePlaceholder')} autoComplete="off" />
          </Field>
          <Field label={t('courseDialog.dose')}>
            <input className={inputClass} value={dose} maxLength={LIMITS.courseDose} onChange={(e) => setDose(e.target.value)} placeholder={t('courseDialog.dosePlaceholder')} autoComplete="off" />
          </Field>
        </div>
        <fieldset>
          <legend className="mb-1.5 block text-sm font-medium text-ink-soft">{t('courseDialog.howOften')}</legend>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3].map((n) => (
              <Chip key={n} active={times.length === n} onClick={() => setCount(n)}>
                {t('course.timesADay', { count: n })}
              </Chip>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {times.map((time, i) => (
              <input
                key={i}
                className={`${inputClass} max-w-36`}
                type="time"
                value={time}
                aria-label={t('courseDialog.doseTime', { n: i + 1 })}
                onChange={(e) => setTimes((list) => list.map((x, j) => (j === i ? e.target.value : x)))}
              />
            ))}
            {times.length < MAX_TIMES_PER_DAY && (
              <button type="button" className={ghostButton} onClick={() => setCount(times.length + 1)}>
                {t('courseDialog.anotherTime')}
              </button>
            )}
          </div>
          <p className="mt-1.5 text-sm text-muted">{t('courseDialog.timesHint')}</p>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('courseDialog.firstDay')}>
            <input className={inputClass} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <fieldset>
            <legend className="mb-1.5 block text-sm font-medium text-ink-soft">{t('courseDialog.for')}</legend>
            <div className="flex items-center gap-2">
              {length === 'days' ? (
                <>
                  <input
                    className={`${inputClass} max-w-20 text-center tabular-nums`}
                    inputMode="numeric"
                    value={days}
                    onChange={(e) => setDays(e.target.value.replace(/\D/g, '').slice(0, 3))}
                    aria-label={t('courseDialog.numberOfDays')}
                  />
                  <span className="text-base text-ink-soft">{t('courseDialog.daysWord', { count: Math.round(Number(days)) || 0 })}</span>
                  <button type="button" className={`${ghostButton} whitespace-nowrap`} onClick={() => setLength('until')}>
                    {t('courseDialog.untilDate')}
                  </button>
                </>
              ) : (
                <>
                  <input className={inputClass} type="date" value={until} min={startDate} onChange={(e) => setUntil(e.target.value)} aria-label={t('courseDialog.lastDay')} />
                  <button type="button" className={ghostButton} onClick={() => setLength('days')}>
                    {t('courseDialog.days')}
                  </button>
                </>
              )}
            </div>
          </fieldset>
        </div>
        <label className="flex min-h-11 items-center gap-3 text-base text-ink">
          <input type="checkbox" className="h-5 w-5 accent-forest-700 dark:accent-forest-400" checked={withFood} onChange={(e) => setWithFood(e.target.checked)} />
          {t('courseDialog.giveWithFood')}
        </label>
        <Field label={t('form.notesOptional')}>
          <textarea className={`${inputClass} min-h-20`} maxLength={LIMITS.courseNotes} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('courseDialog.notesPlaceholder')} />
        </Field>
        <GiversField value={givers} onChange={setGivers} helpers={helpers} name={nameOf} />
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
