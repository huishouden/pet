import { useState } from 'react';
import { Settings2 } from 'lucide-react';
import type { Pet, Routine, RoutineLog } from '../lib/model';
import { LIMITS } from '../lib/model';
import { dueLine, historyOf, petsLabel, scheduleText, statusOf } from '../lib/routines';
import { doneBy } from '../lib/format';
import { personName } from '@huishouden/pwa-kit/people';
import { formatTime, relativeDay } from '@huishouden/pwa-kit/time';
import { CompleteButton, Dialog, DoneBadge, Field, canUndoDone, ghostButton, inputClass, primaryButton } from '@huishouden/pwa-kit/react/ui';
import { useT } from '../i18n';
import { RoutineIcon } from './RoutineIcon';

/**
 * One care routine: whom it is for, how it repeats and where it stands; Mark done with an optional
 * note when it is open (or who did it today, with Undo); the history of the last times; and for
 * admins and members its settings.
 */
export function RoutineSheet({ routine, pets, logs, me, now, managesRoutines, onDone, onUndo, onEdit, onClose }: {
  routine: Routine;
  pets: Pet[];
  logs: RoutineLog[];
  me: string;
  now: number;
  managesRoutines: boolean;
  onDone: (r: Routine, due: string, note?: string) => void;
  onUndo: (log: RoutineLog, r: Routine) => void;
  onEdit: (r: Routine) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [note, setNote] = useState('');
  const status = statusOf(routine, logs, now);
  const open = status.state === 'due' || status.state === 'overdue';
  const history = historyOf(routine.id, logs);
  return (
    <Dialog
      title={routine.name}
      onClose={onClose}
      footer={
        <>
          {managesRoutines && (
            <button type="button" className={`${ghostButton} mr-auto`} onClick={() => onEdit(routine)}>
              <Settings2 size={18} /> {t('routines.settings')}
            </button>
          )}
          <button type="button" className={ghostButton} onClick={onClose}>
            {t('common.close')}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <RoutineIcon kind={routine.kind} size={24} className="mt-0.5 shrink-0 text-link" />
          <div>
            <p className="text-lg text-ink">{petsLabel(routine, pets)}</p>
            <p className="text-base text-muted">{scheduleText(routine)}</p>
          </div>
        </div>
        {open && (
          <div className="space-y-3">
            <p className={`text-lg font-semibold ${status.state === 'overdue' ? 'text-attention' : 'text-ink'}`}>{dueLine({ routine, status }, now)}</p>
            <Field label={t('routines.note')}>
              <input className={inputClass} value={note} maxLength={LIMITS.routineNote} placeholder={t('routines.notePlaceholder')} onChange={(e) => setNote(e.target.value)} />
            </Field>
            <button
              type="button"
              className={primaryButton}
              onClick={() => {
                onDone(routine, status.due, note);
                onClose();
              }}
              aria-label={t('routines.markName', { name: routine.name })}
            >
              {t('routines.markDone')}
            </button>
          </div>
        )}
        {status.log && (
          <div className="flex items-center gap-3" data-completion="done">
            <DoneBadge />
            <p className="min-w-0 flex-1 text-base text-ink">{doneBy('done', status.log.by, me, status.log.at)}</p>
            {canUndoDone(status.log.at, now) && <CompleteButton done name={routine.name} onDone={() => {}} onUndo={() => onUndo(status.log!, routine)} />}
          </div>
        )}
        {status.state === 'later' && <p className="text-lg text-ink">{dueLine({ routine, status }, now)}</p>}
        <section aria-label={t('routines.history')}>
          <h3 className="mb-1 text-sm font-medium text-ink-soft">{t('routines.history')}</h3>
          {history.length === 0 ? (
            <p className="text-base text-muted">{t('routines.noHistory')}</p>
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {history.map((l) => (
                <li key={l.id} className="py-2">
                  <p className="text-base text-ink">
                    {relativeDay(l.at, now)} · {formatTime(l.at)}
                  </p>
                  <p className="text-sm text-muted">{l.by.toLowerCase() === me.toLowerCase() ? t('outings.you') : personName(l.by)}{l.note ? ` · ${l.note}` : ''}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Dialog>
  );
}
