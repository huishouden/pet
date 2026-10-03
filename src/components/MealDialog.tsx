import { isHhmm } from '@huishouden/pwa-kit/time';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { Meal, Pet } from '../lib/model';
import { LIMITS } from '../lib/model';
import type { MealInput } from '../lib/build';
import { Dialog, Field, ghostButton, inputClass, primaryButton } from '@huishouden/pwa-kit/react/ui';

/** One meal on a pet's board: its name, when it counts as missed, and optionally what and how much. */
export function MealDialog({ meal, pet, onSave, onDelete, onClose }: {
  meal: Meal | null;
  pet: Pet | undefined;
  onSave: (input: MealInput) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
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
      title={meal ? `Edit ${meal.name}` : `New meal${pet ? ` for ${pet.name}` : ''}`}
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
              <Trash2 size={18} /> Remove meal
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
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <input className={inputClass} value={name} maxLength={LIMITS.mealName} onChange={(e) => setName(e.target.value)} placeholder="AM" autoComplete="off" />
          </Field>
          <Field label="Not fed yet after" hint="After this time an unticked meal shows Not fed yet.">
            <input className={inputClass} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Food (optional)">
            <input className={inputClass} value={food} maxLength={LIMITS.food} onChange={(e) => setFood(e.target.value)} placeholder="Lamb kibble" />
          </Field>
          <Field label="Portion (optional)">
            <input className={inputClass} value={portion} maxLength={LIMITS.portion} onChange={(e) => setPortion(e.target.value)} placeholder="1 cup" />
          </Field>
        </div>
        <Field label="With this meal (optional)">
          <input className={inputClass} value={note} maxLength={LIMITS.mealNote} onChange={(e) => setNote(e.target.value)} placeholder="Supplement mixed in" />
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
