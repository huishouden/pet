import { Plus, TriangleAlert } from 'lucide-react';
import type { Meal, Outing, OutingPlan, Pet } from '../lib/model';
import { dayCounts, outingFlag, outingWhat, poopLine, slotsOn, walkLine, type OutingSlot } from '../lib/outings';
import { formatTime } from '@huishouden/pwa-kit/time';
import { personName } from '@huishouden/pwa-kit/people';
import { CompleteButton, DoneBadge, completeButton, ghostButton, overline } from '@huishouden/pwa-kit/react/ui';
import { PetAvatar } from './PetAvatar';
import { useT } from '../i18n';

/**
 * Today's outings, for each pet with a plan: only its scheduled bathroom outings (AM and PM, or the
 * times set), each with two taps, Pooped and Pee only; the poops so far against the pet's minimum
 * (and the walk against a walk goal, when the pet has one); the gentle flag when yesterday, or
 * several days running, ended under the minimum; and "+ Outing" for an extra one or a walk. A
 * logged outing says how, who and when, opens to change it, and has Undo.
 */
export function OutingsBoard({ pets, plans, meals, outings, me, now, onLog, onUndo, onEdit, onAdd }: {
  pets: Pet[];
  plans: OutingPlan[];
  meals: Meal[];
  outings: Outing[];
  me: string;
  now: number;
  onLog: (pet: Pet, slot: OutingSlot, poop: boolean) => void;
  onUndo: (o: Outing) => void;
  onEdit: (o: Outing) => void;
  onAdd: (petId: string) => void;
}) {
  const t = useT();
  const shown = pets.map((pet) => ({ pet, plan: plans.find((p) => p.id === pet.id && p.on) })).filter((x): x is { pet: Pet; plan: OutingPlan } => !!x.plan);
  if (!shown.length) return null;
  return (
    <section className="rounded-2xl border border-line bg-surface px-5 py-4 shadow-sm sm:px-6" aria-label={t('outings.title')}>
      <h2 className={overline}>{t('outings.title')}</h2>
      <ul>
        {shown.map(({ pet, plan }) => {
          const slots = slotsOn(plan, meals, outings, now, now);
          const today = dayCounts(outings, pet.id, now);
          const flag = outingFlag(pet, plan, outings, now);
          const walk = plan.walkGoal ? walkLine(today.walkMin, plan.walkGoal) : null;
          const met = !!plan.poopMin && today.poops >= plan.poopMin;
          return (
            <li key={pet.id} className="border-b border-line py-3 last:border-b-0" aria-label={t('outings.petToday', { name: pet.name })}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <PetAvatar pet={pet} pets={pets} size={36} />
                <p className="text-lg font-semibold text-ink" translate="no">
                  {pet.name}
                </p>
                <p className={`text-base ${met ? 'font-semibold text-link' : 'text-muted'}`} data-testid="poop-count">
                  {poopLine(today.poops, plan.poopMin)}
                  {walk && <span className="font-normal text-muted"> · {walk}</span>}
                </p>
                <button type="button" className={`${ghostButton} ml-auto`} onClick={() => onAdd(pet.id)} aria-label={t('outings.addFor', { name: pet.name })}>
                  <Plus size={18} /> {t('outings.add')}
                </button>
              </div>
              {flag && (
                <p className={`mt-1 flex items-start gap-1.5 text-base ${flag.level === 'vet' ? 'font-medium text-attention' : 'text-muted'}`} role="note">
                  <TriangleAlert size={16} className="mt-1 shrink-0" aria-hidden="true" /> {flag.text}
                </p>
              )}
              {slots.length === 0 ? (
                <p className="mt-2 text-base text-muted">{t('outings.noSlots')}</p>
              ) : (
                <ul className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2">
                  {slots.map(({ slot, status }) => {
                    const name = t('outings.takeOut', { name: pet.name, slot: slot.label });
                    if (status.state === 'done') {
                      const o = status.outing;
                      const mine = o.by.toLowerCase() === me.toLowerCase();
                      return (
                        <li key={slot.key} data-completion="done" className="flex min-w-0 items-center gap-2 rounded-xl border border-line py-1 pr-1 pl-3">
                          <DoneBadge />
                          <button type="button" className="min-w-0 flex-1 py-1 text-left" onClick={() => onEdit(o)} aria-label={t('outings.editOne', { name })}>
                            <span className="block truncate text-base font-semibold text-muted sm:text-lg">{slot.label}</span>
                            <span className="block truncate text-sm text-muted sm:text-base">
                              {t('outings.doneLine', { what: outingWhat(o), who: mine ? t('outings.you') : personName(o.by), at: formatTime(o.at) })}
                            </span>
                          </button>
                          <CompleteButton done name={name} undoLabel={t('outings.undo', { name })} onDone={() => {}} onUndo={() => onUndo(o)} />
                        </li>
                      );
                    }
                    const late = status.state === 'late';
                    return (
                      <li key={slot.key} data-completion="open" className="flex min-w-0 flex-wrap items-center gap-2 rounded-xl border border-primary px-3 py-1.5">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-base font-semibold text-ink sm:text-lg">{slot.label}</span>
                          <span className={`block text-sm sm:text-base ${late ? 'font-semibold text-attention' : 'text-muted'}`}>
                            {late ? t('outings.notOutYet', { time: formatTime(status.at) }) : t('outings.at', { time: formatTime(status.at) })}
                          </span>
                        </span>
                        <span className="flex w-full gap-1.5 sm:w-auto [&>button]:flex-1 sm:[&>button]:flex-none">
                          <button type="button" className={completeButton} onClick={() => onLog(pet, slot, true)} aria-label={t('outings.logPooped', { name })}>
                            {t('outings.pooped')}
                          </button>
                          <button type="button" className={`${ghostButton} border border-line`} onClick={() => onLog(pet, slot, false)} aria-label={t('outings.logPee', { name })}>
                            {t('outings.peeOnly')}
                          </button>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
