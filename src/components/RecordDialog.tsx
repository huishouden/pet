import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { Pet, PetRecord } from '../lib/model';
import { LIMITS } from '../lib/model';
import { isYmd, toYmd } from '@huishouden/pwa-kit/time';
import type { RecordInput } from '../lib/build';
import { Dialog, Field, ghostButton, inputClass, primaryButton } from '@huishouden/pwa-kit/react/ui';
import { useT } from '../i18n';

/** A dated record or note for one pet: a diagnosis, a diet change, where a certificate is kept. */
export function RecordDialog({ record, petId, pets, now, onSave, onDelete, onClose }: {
  record: PetRecord | null;
  petId: string;
  pets: Pet[];
  now: number;
  onSave: (input: RecordInput) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const [title, setTitle] = useState(record?.title ?? '');
  const [date, setDate] = useState(record?.date ?? toYmd(now));
  const [text, setText] = useState(record?.text ?? '');
  const pet = pets.find((p) => p.id === (record?.petId ?? petId));
  const valid = title.trim().length > 0 && isYmd(date);

  const save = () => {
    if (!valid) return;
    onSave({ petId: record?.petId ?? petId, title, date, text });
    onClose();
  };

  return (
    <Dialog
      title={record ? t('recordDialog.edit') : pet ? t('recordDialog.newFor', { name: pet.name }) : t('recordDialog.new')}
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
        <Field label={t('recordDialog.title')}>
          <input className={inputClass} value={title} maxLength={LIMITS.recordTitle} onChange={(e) => setTitle(e.target.value)} placeholder={t('recordDialog.placeholder')} />
        </Field>
        <Field label={t('common.date')}>
          <input className={inputClass} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label={t('recordDialog.details')}>
          <textarea className={`${inputClass} min-h-32`} maxLength={LIMITS.recordText} value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
