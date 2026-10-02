import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { Pet, Species } from '../lib/model';
import { LIMITS, SPECIES } from '../lib/model';
import { SPECIES_LABELS } from '../lib/care';
import { MONTHS, daysInMonth, toYmd, ymd } from '@huishouden/pwa-kit/time';
import { WEIGHT_UNITS, parseWeight, type WeightUnit } from '../lib/weight';
import type { BirthdayGuess } from '../lib/birthday';
import { BirthdayFind } from './BirthdayFind';
import type { PetInput } from '../lib/build';
import { Chip, Dialog, Field, deleteButton, ghostButton, inputClass, primaryButton } from '@huishouden/pwa-kit/react/ui';

export function PetDialog({ pet, now, calendarAvailable, birthday, onSave, onDelete, onClose }: {
  pet: Pet | null;
  now: number;
  calendarAvailable: boolean;
  /** A birthday found in the calendar without its year, to finish here. */
  birthday?: BirthdayGuess;
  onSave: (input: PetInput) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(pet?.name ?? '');
  const [species, setSpecies] = useState<Species>(pet?.species ?? 'dog');
  const [breed, setBreed] = useState(pet?.breed ?? '');
  const [birthDate, setBirthDate] = useState(birthday?.date ?? pet?.birthDate ?? '');
  // A birthday from the calendar that lacks its year: month and day kept, year typed here.
  const [partial, setPartial] = useState<{ month: number; day: number } | null>(birthday && !birthday.date ? { month: birthday.month, day: birthday.day } : null);
  const [birthYear, setBirthYear] = useState('');
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(pet?.weightUnit ?? 'lb');
  const [notes, setNotes] = useState(pet?.notes ?? '');
  const [target, setTarget] = useState(pet?.targetWeight !== undefined ? String(pet.targetWeight) : '');
  const [targetNote, setTargetNote] = useState(pet?.targetNote ?? '');
  const targetWeight = target.trim() ? parseWeight(target) : undefined;
  const targetValid = targetWeight !== null && (targetWeight === undefined || targetWeight < LIMITS.maxTargetWeight);
  const valid = name.trim().length > 0 && targetValid;

  const pickBirthday = (g: BirthdayGuess) => {
    if (g.date) {
      setBirthDate(g.date);
      setPartial(null);
    } else {
      setPartial({ month: g.month, day: g.day });
      setBirthYear('');
    }
  };
  const typeYear = (text: string) => {
    setBirthYear(text);
    const y = Number(text);
    if (!partial || !/^\d{4}$/.test(text)) return;
    const date = ymd(y, partial.month, Math.min(partial.day, daysInMonth(y, partial.month)));
    if (date <= toYmd(now)) setBirthDate(date);
  };

  const save = () => {
    if (!valid) return;
    onSave({ name, species, breed, birthDate: birthDate || undefined, weightUnit, targetWeight: targetWeight ?? undefined, targetNote, notes });
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
              className={deleteButton}
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
            <input
              className={inputClass}
              type="date"
              value={birthDate}
              max={toYmd(now)}
              onChange={(e) => {
                setBirthDate(e.target.value);
                setPartial(null);
              }}
            />
          </Field>
        </div>
        {partial && (
          <Field label={`Year born (${MONTHS[partial.month - 1]} ${partial.day})`} hint="Your calendar has the day but not the year.">
            <input className={inputClass} inputMode="numeric" maxLength={4} value={birthYear} onChange={(e) => typeYear(e.target.value)} placeholder="2027" autoComplete="off" />
          </Field>
        )}
        <BirthdayFind name={name} available={calendarAvailable} now={now} onPick={pickBirthday} />
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
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`Target weight in ${weightUnit} (optional)`} hint={targetValid ? "The vet's goal, to compare each weighing with." : 'A weight above 0, like 24.5.'}>
            <input className={inputClass} inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="24.5" autoComplete="off" />
          </Field>
          <Field label="About the target (optional)">
            <input className={inputClass} value={targetNote} maxLength={LIMITS.targetNote} onChange={(e) => setTargetNote(e.target.value)} placeholder="Vet's goal" autoComplete="off" />
          </Field>
        </div>
        <Field label="Care notes (optional)" hint="Diet, allergies, anything a sitter should know.">
          <textarea className={`${inputClass} min-h-24`} value={notes} maxLength={LIMITS.petNotes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {pet && onDelete && <p className="text-base text-stone-600">Removing {pet.name} also removes their reminders, meals and feeds, medicine, weights and records. You can undo it right after.</p>}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
