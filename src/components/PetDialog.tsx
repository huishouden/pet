import { useContext, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { Pet, Species } from '../lib/model';
import { LIMITS, SPECIES } from '../lib/model';
import { SPECIES_LABELS } from '../lib/care';
import { MONTHS, daysBetween, toYmd } from '@huishouden/pwa-kit/time';
import { WEIGHT_UNITS, parseWeight, type WeightUnit } from '../lib/weight';
import { MAX_AGE, ageParts, approxBirthDate, birthDateFromAgeOrYear, bornWords, type BirthdayGuess } from '../lib/birthday';
import { BirthdayFind } from './BirthdayFind';
import { PetAvatar, PetPhotos } from './PetAvatar';
import { PhotoPicker } from '@huishouden/pwa-kit/react/photo';
import { age } from '../lib/time';
import type { PetInput } from '../lib/build';
import { Chip, Dialog, Field, deleteButton, ghostButton, inputClass, primaryButton } from '@huishouden/pwa-kit/react/ui';

export function PetDialog({ pet, pets, now, calendarAvailable, birthday, onSave, onDelete, onClose }: {
  pet: Pet | null;
  pets: Pet[];
  now: number;
  calendarAvailable: boolean;
  /** A birthday found in the calendar without its year, to finish here. */
  birthday?: BirthdayGuess;
  /** `photo`: the new photo's data URL, null to remove it, undefined when unchanged. */
  onSave: (input: PetInput, photo: string | null | undefined) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(pet?.name ?? '');
  const savedPhoto = useContext(PetPhotos).get(pet?.id ?? '') ?? null;
  const [photo, setPhoto] = useState<string | null>(savedPhoto);
  const [species, setSpecies] = useState<Species>(pet?.species ?? 'dog');
  const [breed, setBreed] = useState(pet?.breed ?? '');
  const [birthDate, setBirthDate] = useState(birthday?.date ?? pet?.birthDate ?? '');
  // Set when the date came from the date picker, to question a birthday that makes the pet a few weeks old.
  const [picked, setPicked] = useState(false);
  // A birthday from the calendar that lacks its year: month and day kept, age or year typed here.
  const [partial, setPartial] = useState<BirthdayGuess | null>(birthday && !birthday.date ? birthday : null);
  const [ageOrYear, setAgeOrYear] = useState('');
  // No birthday known, only an age: saved as an approximate birth date.
  const startAge = pet?.birthDateApprox && pet.birthDate && !birthday ? ageParts(pet.birthDate, now) : null;
  const [byAge, setByAge] = useState(startAge !== null);
  const [years, setYears] = useState(startAge ? String(startAge.years) : '');
  const [months, setMonths] = useState(startAge?.months ? String(startAge.months) : '');
  const [ageTouched, setAgeTouched] = useState(false);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(pet?.weightUnit ?? 'lb');
  const [notes, setNotes] = useState(pet?.notes ?? '');
  const [target, setTarget] = useState(pet?.targetWeight !== undefined ? String(pet.targetWeight) : '');
  const [targetNote, setTargetNote] = useState(pet?.targetNote ?? '');
  const targetWeight = target.trim() ? parseWeight(target) : undefined;
  const targetValid = targetWeight !== null && (targetWeight === undefined || targetWeight < LIMITS.maxTargetWeight);
  const fromAgeOrYear = partial && ageOrYear.trim() ? birthDateFromAgeOrYear(ageOrYear, partial.month, partial.day, now) : null;
  const ageEntered = years.trim() !== '' || months.trim() !== '';
  const fromAge = ageEntered ? approxBirthDate(Number(years.trim() || 0), Number(months.trim() || 0), now) : null;
  const ageValid = !byAge || !ageEntered || fromAge !== null;
  // An unchanged age keeps the date first worked out, so reopening and saving doesn't move it.
  const ageDate = startAge && !ageTouched ? pet!.birthDate! : fromAge;
  const shownDate = partial ? (fromAgeOrYear ?? birthDate) : birthDate;
  const finalDate = byAge ? ageDate : shownDate || null;
  const valid = name.trim().length > 0 && targetValid && ageValid;
  const youngDays = picked && !byAge && birthDate ? daysBetween(birthDate, toYmd(now)) : null;
  const who = name.trim() || 'your pet';

  const pickBirthday = (g: BirthdayGuess) => {
    setByAge(false);
    setPicked(false);
    if (g.date) {
      setBirthDate(g.date);
      setPartial(null);
    } else {
      setPartial(g);
      setAgeOrYear('');
    }
  };
  const typeAge = (set: (v: string) => void) => (text: string) => {
    set(text);
    setAgeTouched(true);
  };

  const save = () => {
    if (!valid) return;
    onSave({ name, species, breed, birthDate: finalDate ?? undefined, birthDateApprox: byAge && finalDate ? true : undefined, weightUnit, targetWeight: targetWeight ?? undefined, targetNote, notes }, photo === savedPhoto ? undefined : photo);
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
        <PhotoPicker
          photo={photo}
          fallback={<PetAvatar pet={pet ? { ...pet, species } : undefined} pets={pets} size={80} plain />}
          label={`${name.trim() || 'the pet'}'s photo`}
          size={80}
          onSave={setPhoto}
          onRemove={() => setPhoto(null)}
        />
        <Field label="Name">
          <input className={inputClass} value={name} maxLength={LIMITS.petName} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        </Field>
        <fieldset>
          <legend className="mb-1.5 block text-sm font-medium text-ink-soft">Kind of animal</legend>
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
          {byAge ? (
            <fieldset>
              <legend className="mb-1.5 block text-sm font-medium text-ink-soft">Age (optional)</legend>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Years">
                  <input className={inputClass} inputMode="numeric" maxLength={2} value={years} onChange={(e) => typeAge(setYears)(e.target.value)} placeholder="6" autoComplete="off" />
                </Field>
                <Field label="Months">
                  <input className={inputClass} inputMode="numeric" maxLength={2} value={months} onChange={(e) => typeAge(setMonths)(e.target.value)} placeholder="0" autoComplete="off" />
                </Field>
              </div>
            </fieldset>
          ) : (
            <Field label="Birthday (optional)" hint="A guess is fine.">
              <input
                className={inputClass}
                type="date"
                value={shownDate}
                max={toYmd(now)}
                onChange={(e) => {
                  setBirthDate(e.target.value);
                  setPartial(null);
                  setPicked(true);
                }}
              />
            </Field>
          )}
        </div>
        {youngDays !== null && youngDays >= 0 && youngDays < 91 && (
          <p role="status" className="text-base text-muted">
            That makes {who} {youngDays < 7 ? `${youngDays} day${youngDays === 1 ? '' : 's'}` : `${Math.floor(youngDays / 7)} week${youngDays < 14 ? '' : 's'}`} old — is the year right?
          </p>
        )}
        {byAge && (
          <p role="status" className="text-base text-muted">
            {!ageValid
              ? `Years from 0 to ${MAX_AGE}, and months from 0 to 11.`
              : `${ageDate ? `Shows as "${age(ageDate, now, true)}". ` : ''}No birthday reminder, since the day isn't known.`}
          </p>
        )}
        {!partial && (
          <button
            type="button"
            className="text-base font-medium text-link underline-offset-2 hover:underline"
            onClick={() => {
              setByAge((b) => !b);
              setPicked(false);
              if (byAge) setBirthDate(pet?.birthDateApprox ? '' : birthDate);
            }}
          >
            {byAge ? 'Know the birthday? Pick the date' : "Don't know the birthday? Enter an age"}
          </button>
        )}
        {partial && (
          <div>
            <Field
              label="Age or year born"
              hint={
                partial.suggestedYear !== undefined
                  ? `Your calendar entry starts in ${partial.suggestedYear} — use it if that's the year born.`
                  : `Your calendar has ${MONTHS[partial.month - 1]} ${partial.day} but not the year.`
              }
            >
              <input className={inputClass} inputMode="numeric" maxLength={9} value={ageOrYear} onChange={(e) => setAgeOrYear(e.target.value)} placeholder="6 or 2019" autoComplete="off" />
            </Field>
            {ageOrYear.trim() && (
              <p role="status" className="mt-1 text-base text-ink-soft">
                {fromAgeOrYear ? bornWords(fromAgeOrYear, now) : 'An age like 6, or a year like 2019.'}
              </p>
            )}
          </div>
        )}
        <BirthdayFind name={name} available={calendarAvailable} now={now} onPick={pickBirthday} />
        <fieldset>
          <legend className="mb-1.5 block text-sm font-medium text-ink-soft">Weigh in</legend>
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
        {pet && onDelete && <p className="text-base text-muted">Removing {pet.name} also removes their reminders, meals and feeds, medicine, weights and records. You can undo it right after.</p>}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
