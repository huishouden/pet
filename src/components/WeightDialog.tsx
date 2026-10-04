import { useState } from 'react';
import type { Pet } from '../lib/model';
import { WEIGHT_UNITS, parseWeight, type WeightUnit } from '../lib/weight';
import { parseYmd, startOfDay, toYmd } from '@huishouden/pwa-kit/time';
import { Chip, Dialog, Field, ghostButton, inputClass, primaryButton } from '@huishouden/pwa-kit/react/ui';
import { useT } from '../i18n';
import { formatNumber } from '@huishouden/pwa-kit/i18n';

/** Logs one weighing: today by default, in the pet's unit. */
export function WeightDialog({ pet, now, onSave, onClose }: {
  pet: Pet | undefined;
  now: number;
  onSave: (input: { petId: string; at: number; value: number; unit: WeightUnit }) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState<WeightUnit>(pet?.weightUnit ?? 'lb');
  const [date, setDate] = useState(toYmd(now));
  const parsed = parseWeight(value);
  const day = parseYmd(date);
  const valid = !!pet && parsed !== null && day !== null && day <= now;

  const save = () => {
    if (!valid || !pet || parsed === null || day === null) return;
    // Today keeps the time it was logged; an earlier day is recorded at noon.
    const at = day === startOfDay(now) ? now : day + 12 * 3_600_000;
    onSave({ petId: pet.id, at, value: parsed, unit });
    onClose();
  };

  return (
    <Dialog
      title={pet ? t('weightDialog.weigh', { name: pet.name }) : t('pets.logWeight')}
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
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="flex items-end gap-3">
          <Field label={t('pets.weight')}>
            <input
              className={`${inputClass} max-w-40 text-2xl tabular-nums`}
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value.replace(/[^\d.,]/g, '').slice(0, 7))}
              placeholder={formatNumber(0, undefined, { minimumFractionDigits: 1 })}
              autoComplete="off"
            />
          </Field>
          <div className="flex gap-2 pb-0.5" role="group" aria-label={t('weightDialog.unit')}>
            {WEIGHT_UNITS.map((u) => (
              <Chip key={u} active={unit === u} onClick={() => setUnit(u)}>
                {u}
              </Chip>
            ))}
          </div>
        </div>
        <Field label={t('weightDialog.day')}>
          <input className={inputClass} type="date" value={date} max={toYmd(now)} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
