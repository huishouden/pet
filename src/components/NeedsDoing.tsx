import { Fragment } from 'react';
import { Check, Pill, Utensils, Syringe } from 'lucide-react';
import { CompletionList, CompletionRow, canUndoDone, cardClass } from '@huishouden/pwa-kit/react/ui';
import type { Pet } from '../lib/model';
import { needActionLabel, type Need } from '../lib/today';
import { useT } from '../i18n';
import { doneBy } from '../lib/format';
import { PetAvatar } from './PetAvatar';

const KIND_ICON = { dose: Pill, meal: Utensils, care: Syringe } as const;

/**
 * The top of Today: everything due now or past due, most overdue first, each with its one tap
 * (Give, Feed). Late ones say how late in terracotta. What was done of them today follows, with who
 * and when and, for a few hours, Undo; once everything is done the card folds to one line. With
 * nothing due or done, one calm line and what is next.
 */
export function NeedsDoing({ needs, done = [], pets, me, now, allDone, onDo, onUndo, onOpen }: {
  needs: Need[];
  /** Done today (`doneNow`), shown after the open ones. */
  done?: Need[];
  pets: Pet[];
  me: string;
  now: number;
  /** "All done for now · next: …", shown when nothing is due. */
  allDone: string;
  onDo: (need: Need) => void;
  /** Un-ticks a done meal or dose (a care dose is undone from its toast). */
  onUndo?: (need: Need) => void;
  /** Opens the thing itself (the reminder, the course's doses by day, the pet). */
  onOpen: (need: Need) => void;
}) {
  const t = useT();
  const late = needs.filter((n) => n.late).length;
  const items = [...needs, ...done];
  return (
    <section className={`${cardClass} px-4 py-4 sm:px-6 sm:py-5`} aria-label={t('needs.title')}>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-xl font-semibold text-ink sm:text-2xl">{t('needs.title')}</h2>
        {late > 0 && <p className="text-base font-medium text-attention sm:text-lg">{t('needs.pastDue', { count: late })}</p>}
      </div>
      {items.length === 0 ? (
        <p className="mt-2 flex items-center gap-3 text-xl font-medium text-link sm:text-2xl" aria-live="polite">
          <Check size={28} className="shrink-0" aria-hidden="true" /> {allDone}
        </p>
      ) : (
        <CompletionList items={items} isDone={(n) => !!n.done} label={t('needs.dueNow')} allDone={allDone} className="mt-1">
          {(n) => (
            <NeedRow
              key={n.key}
              need={n}
              pet={pets.find((p) => p.id === n.petId)}
              pets={pets}
              me={me}
              now={now}
              onDo={() => onDo(n)}
              onUndo={onUndo && n.kind !== 'care' ? () => onUndo(n) : undefined}
              onOpen={() => onOpen(n)}
            />
          )}
        </CompletionList>
      )}
    </section>
  );
}

function NeedRow({ need, pet, pets, me, now, onDo, onUndo, onOpen }: { need: Need; pet: Pet | undefined; pets: Pet[]; me: string; now: number; onDo: () => void; onUndo?: () => void; onOpen: () => void }) {
  const t = useT();
  const Icon = need.kind === 'care' && need.reminder.kind === 'medication' ? Pill : KIND_ICON[need.kind];
  const verb = needActionLabel(need.action);
  const done = need.done;
  const status = !done ? undefined : doneBy(done.skipped ? 'skipped' : need.action === 'fed' ? 'fed' : need.action === 'given' ? 'given' : 'done', done.by, me, done.at);
  const undoLabel = !done || done.skipped ? undefined : need.action === 'fed' ? t('done.undoFed', { name: need.title }) : need.action === 'given' ? t('done.undoGiven', { name: need.title }) : undefined;
  return (
    <CompletionRow
      name={need.title}
      title={
        <span className="flex items-center gap-2">
          <Icon size={20} className="hidden shrink-0 sm:block" aria-hidden="true" />
          <span className="min-w-0">{need.title}</span>
        </span>
      }
      meta={need.when.split(' · ').map((part, i) => (
        <Fragment key={i}>
          {i > 0 && ' · '}
          <span className="whitespace-nowrap">{part}</span>
        </Fragment>
      ))}
      attention={need.late}
      status={status}
      skipped={done?.skipped}
      done={!!done}
      leading={
        <>
          <span className={`h-12 w-1.5 shrink-0 rounded-full ${need.late ? 'bg-attention-fill' : 'bg-forest-200 dark:bg-forest-600'}`} aria-hidden="true" />
          <span className="hidden sm:block">
            <PetAvatar pet={pet} pets={pets} size={44} />
          </span>
        </>
      }
      onOpen={onOpen}
      openLabel={done ? need.title : t('needs.open', { title: need.title, when: need.when })}
      verb={verb}
      label={verb ? t('today.actionName', { action: verb, name: need.title }) : undefined}
      undoLabel={undoLabel}
      onDone={onDo}
      onUndo={done && onUndo && canUndoDone(done.at, now) ? onUndo : undefined}
    />
  );
}
