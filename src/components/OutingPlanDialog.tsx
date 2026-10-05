import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { Meal, OutingMode, OutingPlan, Pet } from '../lib/model';
import type { OutingPlanInput } from '../lib/build';
import { mealsOf } from '../lib/feeding';
import { OUTING_LIMITS } from '@huishouden/pwa-kit/pet-outings';
import { DEFAULT_EVERY, DEFAULT_FLAG_DAYS, DEFAULT_FROM, DEFAULT_TO, defaultPlan, everyTimes } from '../lib/outings';
import { formatClock } from '../lib/format';
import { isHhmm } from '@huishouden/pwa-kit/time';
import { Checkbox, Chip, Dialog, Field, ghostButton, iconButton, inputClass, primaryButton, selectClass } from '@huishouden/pwa-kit/react/ui';
import { useT } from '../i18n';

/**
 * A pet's outings: on or off; when (with its meals, at set times, or every few hours while the
 * household is up); the poops a day to expect and how many short days in a row before the vet hint;
 * reminders at each outing; and an optional walk goal (off by default: walks can always be logged).
 */
export function OutingPlanDialog({ plan, pet, meals, onSave, onClose }: {
  plan: OutingPlan | undefined;
  pet: Pet;
  meals: Meal[];
  onSave: (input: OutingPlanInput) => void;
  onClose: () => void;
}) {
  const t = useT();
  const start = plan ?? defaultPlan(pet);
  const [on, setOn] = useState(plan ? plan.on : true);
  const [mode, setMode] = useState<OutingMode>(start.mode);
  const [times, setTimes] = useState<string[]>(plan?.times?.length ? plan.times : ['07:00', '12:00', '18:00']);
  const [every, setEvery] = useState(start.every ?? DEFAULT_EVERY);
  const [from, setFrom] = useState(start.from ?? DEFAULT_FROM);
  const [to, setTo] = useState(start.to ?? DEFAULT_TO);
  const [poopMin, setPoopMin] = useState(String(start.poopMin ?? 0));
  const [flagDays, setFlagDays] = useState(String(start.flagDays ?? DEFAULT_FLAG_DAYS));
  const [remind, setRemind] = useState(!!start.remind);
  const [walkGoal, setWalkGoal] = useState(start.walkGoal ? String(start.walkGoal) : '');
  const petMeals = mealsOf(meals, pet.id);
  const min = Number(poopMin);
  const days = Number(flagDays);
  const goal = walkGoal === '' ? 0 : Number(walkGoal);
  const validTimes = times.filter(isHhmm);
  const valid =
    Number.isInteger(min) && min >= 0 && min <= OUTING_LIMITS.poopMin &&
    Number.isInteger(days) && days >= 1 && days <= OUTING_LIMITS.flagDays &&
    Number.isInteger(goal) && goal >= 0 && goal <= OUTING_LIMITS.walkMin &&
    (mode !== 'times' || validTimes.length > 0) &&
    (mode !== 'every' || (isHhmm(from) && isHhmm(to) && from < to));

  const save = () => {
    if (!valid) return;
    onSave({ on, mode, times: validTimes, every, from, to, poopMin: min, flagDays: days, remind, walkGoal: goal });
    onClose();
  };

  const preview = mode === 'every' && isHhmm(from) && isHhmm(to) ? everyTimes(every, from, to).map(formatClock).join(', ') : '';

  return (
    <Dialog
      title={t('planDialog.title', { name: pet.name })}
      onClose={onClose}
      footer={
        <>
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
        <Checkbox checked={on} onChange={setOn}>
          {t('planDialog.on', { name: pet.name })}
        </Checkbox>
        {on && (
          <>
            <Field label={t('planDialog.when')}>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('planDialog.when')}>
                <Chip active={mode === 'meals'} onClick={() => setMode('meals')}>
                  {t('planDialog.withMeals')}
                </Chip>
                <Chip active={mode === 'times'} onClick={() => setMode('times')}>
                  {t('planDialog.setTimes')}
                </Chip>
                <Chip active={mode === 'every'} onClick={() => setMode('every')}>
                  {t('planDialog.everyHours')}
                </Chip>
              </div>
            </Field>
            {mode === 'meals' && (
              <p className="text-base text-muted">
                {petMeals.length ? t('planDialog.mealsHint', { list: petMeals.map((m) => `${m.name} ${formatClock(m.time)}`).join(', ') }) : t('planDialog.noMeals', { name: pet.name })}
              </p>
            )}
            {mode === 'times' && (
              <div className="space-y-2">
                {times.map((time, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      className={`${inputClass} w-40`}
                      type="time"
                      value={time}
                      aria-label={t('planDialog.timeN', { n: i + 1 })}
                      onChange={(e) => setTimes(times.map((x, j) => (j === i ? e.target.value : x)))}
                    />
                    {times.length > 1 && (
                      <button type="button" className={iconButton} aria-label={t('planDialog.removeTime', { n: i + 1 })} onClick={() => setTimes(times.filter((_, j) => j !== i))}>
                        <X size={18} />
                      </button>
                    )}
                  </div>
                ))}
                {times.length < OUTING_LIMITS.times && (
                  <button type="button" className={`${ghostButton} -ml-2`} onClick={() => setTimes([...times, '12:00'])}>
                    <Plus size={18} /> {t('planDialog.addTime')}
                  </button>
                )}
              </div>
            )}
            {mode === 'every' && (
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label={t('planDialog.every')}>
                  <select className={selectClass} value={every} onChange={(e) => setEvery(Number(e.target.value))}>
                    {Array.from({ length: OUTING_LIMITS.every }, (_, i) => i + 1).map((h) => (
                      <option key={h} value={h}>
                        {t('planDialog.hours', { count: h })}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t('planDialog.from')}>
                  <input className={inputClass} type="time" value={from} onChange={(e) => setFrom(e.target.value)} />
                </Field>
                <Field label={t('planDialog.to')}>
                  <input className={inputClass} type="time" value={to} onChange={(e) => setTo(e.target.value)} />
                </Field>
                {preview && <p className="text-base text-muted sm:col-span-3">{preview}</p>}
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('planDialog.poopMin')} hint={t('planDialog.poopMinHint')}>
                <input className={inputClass} type="number" inputMode="numeric" min={0} max={OUTING_LIMITS.poopMin} value={poopMin} onChange={(e) => setPoopMin(e.target.value)} />
              </Field>
              <Field label={t('planDialog.flagDays')} hint={t('planDialog.flagDaysHint')}>
                <input className={inputClass} type="number" inputMode="numeric" min={1} max={OUTING_LIMITS.flagDays} value={flagDays} onChange={(e) => setFlagDays(e.target.value)} />
              </Field>
            </div>
            <Checkbox checked={remind} onChange={setRemind}>
              {t('planDialog.remind')}
            </Checkbox>
            <Field label={t('planDialog.walkGoal')} hint={t('planDialog.walkGoalHint')}>
              <input className={`${inputClass} w-40`} type="number" inputMode="numeric" min={0} max={OUTING_LIMITS.walkMin} value={walkGoal} placeholder={t('planDialog.walkGoalNone')} onChange={(e) => setWalkGoal(e.target.value)} />
            </Field>
          </>
        )}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
