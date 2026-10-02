import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { Pet, Species } from '../lib/model';
import { LIMITS, SPECIES } from '../lib/model';
import { SPECIES_LABELS } from '../lib/care';
import { toYmd } from '@huishouden/pwa-kit/time';
import { WEIGHT_UNITS, type WeightUnit } from '../lib/weight';
import type { PetInput } from '../lib/build';
import { Chip, Dialog, Field, ghostButton, inputClass, primaryButton } from '@huishouden/pwa-kit/react/ui';

export function PetDialog({ pet, now, onSave, onDelete, onClose }: {
  pet: Pet | null;
  now: number;
  onSave: (input: PetInput) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(pet?.name ?? '');
  const [species, setSpecies] = useState<Species>(pet?.species ?? 'dog');
  const [breed, setBreed] = useState(pet?.breed ?? '');
  const [birthDate, setBirthDate] = useState(pet?.birthDate ?? '');
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(pet?.weightUnit ?? 'lb');
  const [notes, setNotes] = useState(pet?.notes ?? '');
  const valid = name.trim().length > 0;

  const save = () => {
    if (!valid) return;
    onSave({ name, species, breed, birthDate: birthDate || undefined, weightUnit, notes });
    onClose();
  };

  return (
    <Dialog
      title={pet ? `Edit ${pet.name}` : 'New pet'}
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
              <Trash2 size={18} /> Remove pet
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
        <Field label="Name">
          <input className={inputClass} value={name} maxLength={LIMITS.petName} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        </Field>
        <fieldset>
          <legend className="mb-1.5 block text-sm font-medium text-stone-700">Kind of animal</legend>
          <div className="flex flex-wrap gap-2">
            {SPECIES.map((s) => (
              <Chip key={s} active={species === s} onClick={() => setSpecies(s)}>
                {SPECIES_LABELS[s]}
              </Chip>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Breed (optional)">
            <input className={inputClass} value={breed} maxLength={LIMITS.breed} onChange={(e) => setBreed(e.target.value)} autoComplete="off" />
          </Field>
          <Field label="Birthday (optional)" hint="A guess is fine.">
            <input className={inputClass} type="date" value={birthDate} max={toYmd(now)} onChange={(e) => setBirthDate(e.target.value)} />
          </Field>
        </div>
        <fieldset>
          <legend className="mb-1.5 block text-sm font-medium text-stone-700">Weigh in</legend>
          <div className="flex gap-2">
            {WEIGHT_UNITS.map((u) => (
              <Chip key={u} active={weightUnit === u} onClick={() => setWeightUnit(u)}>
                {u === 'kg' ? 'Kilograms' : 'Pounds'}
              </Chip>
            ))}
          </div>
        </fieldset>
        <Field label="Care notes (optional)" hint="Diet, allergies, anything a sitter should know.">
          <textarea className={`${inputClass} min-h-24`} value={notes} maxLength={LIMITS.petNotes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {pet && onDelete && <p className="text-base text-stone-600">Removing {pet.name} also removes their reminders, meals and feeds, medicine, weights and records. You can undo it right after.</p>}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
