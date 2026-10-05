import { useState } from 'react';
import { Footprints, Trash2 } from 'lucide-react';
import type { Outing, Pet } from '../lib/model';
import { LIMITS } from '../lib/model';
import { OUTING_LIMITS } from '@huishouden/pwa-kit/pet-outings';
import { fromLocalInput, toLocalInput } from '@huishouden/pwa-kit/time';
import type { OutingInput } from '../lib/build';
import { WALK_PICKS } from '../lib/outings';
import { Chip, Dialog, Field, deleteButton, ghostButton, inputClass, primaryButton } from '@huishouden/pwa-kit/react/ui';
import { useT } from '../i18n';

export type OutingKind = 'bathroom' | 'walk';

/**
 * Logs an outing, or fixes one: when, and whether the pet peed and pooped. A walk stays out of the
 * way behind the small Walk chip, which opens its length (quick picks or minutes) and a note. "+
 * Outing" offers Walk as its own kind: a walk with no bathroom details is one tap and a length.
 * Who logged it stays.
 */
export function OutingDialog({ outing, pet, now, onSave, onDelete, onClose }: {
  outing: Outing | null;
  pet: Pet | undefined;
  now: number;
  onSave: (input: OutingInput) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const editingWalk = !!outing && outing.pee === undefined && outing.poop === undefined;
  const [kind, setKind] = useState<OutingKind>(editingWalk ? 'walk' : 'bathroom');
  const [when, setWhen] = useState(toLocalInput(outing?.at ?? now));
  const [pee, setPee] = useState(outing?.pee ?? true);
  const [poop, setPoop] = useState(outing?.poop ?? false);
  const [walkOpen, setWalkOpen] = useState(!!outing?.walkMin || !!outing?.note);
  const [minutes, setMinutes] = useState(outing?.walkMin ? String(outing.walkMin) : '');
  const [note, setNote] = useState(outing?.note ?? '');
  const at = fromLocalInput(when);
  const walkMin = Number(minutes);
  const hasWalk = Number.isInteger(walkMin) && walkMin > 0 && walkMin <= OUTING_LIMITS.walkMin;
  const walk = kind === 'walk';
  const showWalk = walk || walkOpen;
  const valid = !!pet && at !== null && at <= now + 60_000 && (walk ? hasWalk : minutes === '' || hasWalk);

  const save = () => {
    if (!valid || !pet || at === null) return;
    onSave({
      petId: pet.id,
      // A walk never answers a scheduled bathroom outing.
      slot: walk ? undefined : outing?.slot,
      at,
      ...(walk ? {} : { pee, poop }),
      ...(showWalk && hasWalk ? { walkMin } : {}),
      ...(showWalk && note.trim() ? { note } : {}),
    });
    onClose();
  };

  return (
    <Dialog
      title={outing ? t('outingDialog.edit') : pet ? t('outingDialog.newFor', { name: pet.name }) : t('outingDialog.new')}
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
        {!outing && (
          <div className="flex gap-1.5" role="group" aria-label={t('outingDialog.kind')}>
            <Chip active={!walk} onClick={() => setKind('bathroom')}>
              {t('outingDialog.bathroom')}
            </Chip>
            <Chip active={walk} onClick={() => setKind('walk')}>
              {t('outingDialog.walk')}
            </Chip>
          </div>
        )}
        <Field label={t('outingDialog.when')}>
          <input className={inputClass} type="datetime-local" value={when} max={toLocalInput(now)} onChange={(e) => setWhen(e.target.value)} />
        </Field>
        {!walk && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('outingDialog.what')}>
            <Chip active={pee} onClick={() => setPee(!pee)}>
              {t('outingDialog.peed')}
            </Chip>
            <Chip active={poop} onClick={() => setPoop(!poop)}>
              {t('outings.pooped')}
            </Chip>
            {!walkOpen && (
              <Chip onClick={() => setWalkOpen(true)} label={t('outingDialog.addWalk')}>
                <Footprints size={16} aria-hidden="true" /> {t('outingDialog.walk')}
              </Chip>
            )}
          </div>
        )}
        {showWalk && (
          <div className="space-y-3">
            <Field label={t('outingDialog.walkLength')}>
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t('outingDialog.walkLength')}>
                {WALK_PICKS.map((m) => (
                  <Chip key={m} active={minutes === String(m)} onClick={() => setMinutes(String(m))}>
                    {t('outings.minutes', { minutes: m })}
                  </Chip>
                ))}
                <input
                  className={`${inputClass} w-24`}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={OUTING_LIMITS.walkMin}
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  aria-label={t('outingDialog.walkMinutes')}
                />
              </div>
            </Field>
            <Field label={t('outingDialog.note')}>
              <input className={inputClass} value={note} maxLength={LIMITS.outingNote} onChange={(e) => setNote(e.target.value)} placeholder={t('outingDialog.notePlaceholder')} />
            </Field>
          </div>
        )}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
