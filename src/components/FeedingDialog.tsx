import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { Feeding, Meal, Pet } from '../lib/model';
import { LIMITS } from '../lib/model';
import { fromLocalInput, toLocalInput } from '../lib/time';
import { personName } from '../lib/people';
import type { FeedingInput } from '../lib/build';
import { Chip, Dialog, Field, ghostButton, inputClass, primaryButton } from './ui';

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
      title={feeding ? 'Edit feed' : `Log a feed${pet ? ` for ${pet.name}` : ''}`}
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
        {feeding && <p className="text-base text-stone-600">Fed by {personName(feeding.by, { email: me })}.</p>}
        <fieldset>
          <legend className="mb-1.5 block text-sm font-medium text-stone-700">Meal</legend>
          <div className="flex flex-wrap gap-2">
            {meals.map((m) => (
              <Chip key={m.id} active={mealId === m.id} onClick={() => setMealId(m.id)}>
                {m.name}
              </Chip>
            ))}
            <Chip active={!mealId} onClick={() => setMealId('')}>
              Extra
            </Chip>
          </div>
        </fieldset>
        <Field label="When">
          <input className={inputClass} type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        </Field>
        <Field label="Portion (optional)">
          <input className={inputClass} value={portion} maxLength={LIMITS.portion} onChange={(e) => setPortion(e.target.value)} placeholder="1 cup" />
        </Field>
        <Field label="Note (optional)">
          <input className={inputClass} value={note} maxLength={LIMITS.feedingNote} onChange={(e) => setNote(e.target.value)} placeholder="Left half of it" />
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
