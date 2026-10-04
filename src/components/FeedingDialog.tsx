import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { Feeding, Meal, Pet } from '../lib/model';
import { LIMITS } from '../lib/model';
import { fromLocalInput, toLocalInput } from '@huishouden/pwa-kit/time';
import { personName } from '@huishouden/pwa-kit/people';
import type { FeedingInput } from '../lib/build';
import { Chip, Dialog, Field, ghostButton, inputClass, primaryButton } from '@huishouden/pwa-kit/react/ui';
import { useT } from '../i18n';

/** Logs an extra feed, or fixes one: which meal, the time, the portion. Who fed it stays. */
export function FeedingDialog({ feeding, pet, meals, me, now, onSave, onDelete, onClose }: {
  feeding: Feeding | null;
  pet: Pet | undefined;
  meals: Meal[];
  me: string;
  now: number;
  onSave: (input: FeedingInput) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const [mealId, setMealId] = useState(feeding?.mealId ?? '');
  const [when, setWhen] = useState(toLocalInput(feeding?.at ?? now));
  const [portion, setPortion] = useState(feeding?.portion ?? '');
  const [note, setNote] = useState(feeding?.note ?? '');
  const at = fromLocalInput(when);
  const valid = !!pet && at !== null && at <= now + 60_000;

  const save = () => {
    if (!valid || !pet || at === null) return;
    onSave({ petId: pet.id, mealId: mealId || undefined, at, portion, note });
    onClose();
  };

  return (
    <Dialog
      title={feeding ? t('feedingDialog.edit') : pet ? t('feedingDialog.newFor', { name: pet.name }) : t('feedingDialog.new')}
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
        {feeding && <p className="text-base text-muted">{t('feedingDialog.fedBy', { name: personName(feeding.by, { email: me }) })}</p>}
        <fieldset>
          <legend className="mb-1.5 block text-sm font-medium text-ink-soft">{t('feedingDialog.meal')}</legend>
          <div className="flex flex-wrap gap-2">
            {meals.map((m) => (
              <Chip key={m.id} active={mealId === m.id} onClick={() => setMealId(m.id)}>
                {m.name}
              </Chip>
            ))}
            <Chip active={!mealId} onClick={() => setMealId('')}>
              {t('feedingDialog.extra')}
            </Chip>
          </div>
        </fieldset>
        <Field label={t('feedingDialog.when')}>
          <input className={inputClass} type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        </Field>
        <Field label={t('mealDialog.portion')}>
          <input className={inputClass} value={portion} maxLength={LIMITS.portion} onChange={(e) => setPortion(e.target.value)} placeholder={t('mealDialog.portionPlaceholder')} />
        </Field>
        <Field label={t('feedingDialog.note')}>
          <input className={inputClass} value={note} maxLength={LIMITS.feedingNote} onChange={(e) => setNote(e.target.value)} placeholder={t('feedingDialog.notePlaceholder')} />
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
