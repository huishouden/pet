import { isHhmm } from '@huishouden/pwa-kit/time';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { Meal, Pet } from '../lib/model';
import { LIMITS } from '../lib/model';
import type { MealInput } from '../lib/build';
import { Dialog, Field, ghostButton, inputClass, primaryButton } from '@huishouden/pwa-kit/react/ui';
import { useT } from '../i18n';

/** One meal on a pet's board: its name, when it counts as missed, and optionally what and how much. */
export function MealDialog({ meal, pet, onSave, onDelete, onClose }: {
  meal: Meal | null;
  pet: Pet | undefined;
  onSave: (input: MealInput) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const [name, setName] = useState(meal?.name ?? '');
  const [time, setTime] = useState(meal?.time ?? '12:00');
  const [food, setFood] = useState(meal?.food ?? '');
  const [portion, setPortion] = useState(meal?.portion ?? '');
  const [note, setNote] = useState(meal?.note ?? '');
  const valid = !!pet && name.trim().length > 0 && isHhmm(time);

  const save = () => {
    if (!valid || !pet) return;
    onSave({ petId: pet.id, name, time, food, portion, note });
    onClose();
  };

  return (
    <Dialog
      title={meal ? t('a11y.edit', { name: meal.name }) : pet ? t('mealDialog.newFor', { name: pet.name }) : t('mealDialog.new')}
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
              <Trash2 size={18} /> {t('mealDialog.remove')}
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
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('common.name')}>
            <input className={inputClass} value={name} maxLength={LIMITS.mealName} onChange={(e) => setName(e.target.value)} placeholder={t('meal.am')} autoComplete="off" />
          </Field>
          <Field label={t('mealDialog.cutoff')} hint={t('mealDialog.cutoffHint')}>
            <input className={inputClass} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('mealDialog.food')}>
            <input className={inputClass} value={food} maxLength={LIMITS.food} onChange={(e) => setFood(e.target.value)} placeholder={t('mealDialog.foodPlaceholder')} />
          </Field>
          <Field label={t('mealDialog.portion')}>
            <input className={inputClass} value={portion} maxLength={LIMITS.portion} onChange={(e) => setPortion(e.target.value)} placeholder={t('mealDialog.portionPlaceholder')} />
          </Field>
        </div>
        <Field label={t('mealDialog.note')}>
          <input className={inputClass} value={note} maxLength={LIMITS.mealNote} onChange={(e) => setNote(e.target.value)} placeholder={t('mealDialog.notePlaceholder')} />
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
