import { Check } from 'lucide-react';
import type { Pet, Routine, RoutineLog } from '../lib/model';
import { dueLine, petsLabel, routinesToday, statusOf, type RoutineItem } from '../lib/routines';
import { doneBy } from '../lib/format';
import { CompletionList, CompletionRow, canUndoDone, cardClass } from '@huishouden/pwa-kit/react/ui';
import { dueText, toYmd } from '@huishouden/pwa-kit/time';
import { useT } from '../i18n';
import { RoutineIcon } from './RoutineIcon';

/**
 * Today's care routines (scoop the litter box, change the litter, brush): the ones due or overdue
 * with their one tap, Mark done, then the ones done today with who and when and, for a few hours,
 * Undo. Overdue ones say how late in terracotta. With none due, one calm line and what is next.
 * A tap on the name opens the routine (history, a note, and for admins and members its settings).
 */
export function RoutinesBoard({ routines, logs, pets, me, now, onDone, onUndo, onOpen }: {
  routines: Routine[];
  logs: RoutineLog[];
  pets: Pet[];
  me: string;
  now: number;
  onDone: (r: Routine, due: string) => void;
  onUndo: (log: RoutineLog, r: Routine) => void;
  onOpen: (r: Routine) => void;
}) {
  const t = useT();
  if (!routines.length) return null;
  const { open, done } = routinesToday(routines, logs, now);
  const items = [...open, ...done];
  const late = open.filter((x) => x.status.state === 'overdue').length;
  return (
    <section className={`${cardClass} px-4 py-4 sm:px-6 sm:py-5`} aria-label={t('routines.title')}>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-xl font-semibold text-ink sm:text-2xl">{t('routines.title')}</h2>
        {late > 0 && <p className="text-base font-medium text-attention sm:text-lg">{t('routines.pastDue', { count: late })}</p>}
      </div>
      {items.length === 0 ? (
        <p className="mt-2 flex items-center gap-3 text-lg font-medium text-link sm:text-xl" aria-live="polite">
          <Check size={26} className="shrink-0" aria-hidden="true" /> {nextLine(routines, logs, now, t)}
        </p>
      ) : (
        <CompletionList items={items} isDone={(x) => x.status.state === 'done'} label={t('routines.dueNow')} allDone={t('routines.allDone')} className="mt-1">
          {(x) => <Row key={x.routine.id} item={x} pets={pets} me={me} now={now} onDone={onDone} onUndo={onUndo} onOpen={onOpen} />}
        </CompletionList>
      )}
    </section>
  );
}

function Row({ item, pets, me, now, onDone, onUndo, onOpen }: { item: RoutineItem; pets: Pet[]; me: string; now: number; onDone: (r: Routine, due: string) => void; onUndo: (l: RoutineLog, r: Routine) => void; onOpen: (r: Routine) => void }) {
  const t = useT();
  const { routine, status } = item;
  const log = status.log;
  const overdue = status.state === 'overdue';
  return (
    <CompletionRow
      name={routine.name}
      title={
        <span className="flex items-center gap-2">
          <RoutineIcon kind={routine.kind} className="hidden shrink-0 sm:block" />
          <span className="min-w-0">{routine.name}</span>
        </span>
      }
      meta={log ? undefined : `${petsLabel(routine, pets)} · ${dueLine(item, now)}`}
      attention={overdue}
      status={log ? doneBy('done', log.by, me, log.at) : undefined}
      done={!!log}
      leading={<span className={`h-12 w-1.5 shrink-0 rounded-full ${overdue ? 'bg-attention-fill' : 'bg-tint'}`} aria-hidden="true" />}
      onOpen={() => onOpen(routine)}
      openLabel={t('routines.open', { name: routine.name })}
      onDone={() => onDone(routine, status.due)}
      onUndo={log && canUndoDone(log.at, now) ? () => onUndo(log, routine) : undefined}
    >
      {log?.note && <p className="mt-0.5 text-sm text-muted sm:text-base">{log.note}</p>}
    </CompletionRow>
  );
}

/** "All up to date · next: Change litter in 3 days" for a day with nothing due. */
function nextLine(routines: Routine[], logs: RoutineLog[], now: number, t: ReturnType<typeof useT>): string {
  const today = toYmd(now);
  const next = routines
    .map((r) => ({ r, s: statusOf(r, logs, now) }))
    .filter((x) => x.s.state === 'later')
    .sort((a, b) => a.s.due.localeCompare(b.s.due) || a.r.name.localeCompare(b.r.name))[0];
  return next ? t('routines.upToDate', { name: next.r.name, when: dueText(next.s.due, today).toLowerCase() }) : t('routines.allDone');
}
