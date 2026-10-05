import { Footprints, Pencil, Plus, Settings2, TriangleAlert } from 'lucide-react';
import type { Meal, Outing, OutingPlan, Pet } from '../lib/model';
import { HISTORY_DAYS, history, outingFlag, outingWhat, scheduleText, slotsOf, underMinimum } from '../lib/outings';
import { formatDayShort, formatTime, parseYmd, relativeDay, weekdayShort } from '@huishouden/pwa-kit/time';
import { personName } from '@huishouden/pwa-kit/people';
import { cardClass, ghostButton, iconButton, overline, primaryButton } from '@huishouden/pwa-kit/react/ui';
import { useT } from '../i18n';

const RECENT = 6;

/**
 * A pet's outings on its page: the plan in a line (when, the poop minimum, reminders, a walk goal),
 * the flag when days end under the minimum, the last two weeks as a strip of poops a day with each
 * day's walk minutes under it, and the latest outings to fix. Without a plan, how to start one.
 */
export function OutingsCard({ pet, plan, meals, outings, me, now, managesPlan, onPlan, onAdd, onEdit }: {
  pet: Pet;
  plan: OutingPlan | undefined;
  meals: Meal[];
  outings: Outing[];
  me: string;
  now: number;
  /** Admins and members set the plan. */
  managesPlan: boolean;
  onPlan: () => void;
  onAdd: () => void;
  onEdit: (o: Outing) => void;
}) {
  const t = useT();
  const mine = outings.filter((o) => o.petId === pet.id);
  const on = !!plan?.on;
  const days = history(mine, pet.id, now);
  const tracked = days.some((d) => d.outings > 0);
  const flag = outingFlag(pet, plan, mine, now);
  const recent = [...mine].sort((a, b) => b.at - a.at).slice(0, RECENT);
  const facts =
    on && plan
      ? [
          scheduleText(plan, slotsOf(plan, meals)),
          plan.poopMin ? t('outings.minLine', { count: plan.poopMin }) : t('outings.noMin'),
          plan.remind ? t('outings.remindOn') : '',
          plan.walkGoal ? t('outings.walkGoalLine', { minutes: plan.walkGoal }) : '',
        ].filter(Boolean)
      : [];

  return (
    <section className={`${cardClass} p-6`} aria-label={t('outings.of', { name: pet.name })}>
      <div className="flex flex-wrap items-center justify-between gap-x-4">
        <h3 className={overline}>{t('outings.title')}</h3>
        <div className="flex gap-1">
          {(on || tracked) && (
            <button type="button" className={`${ghostButton} whitespace-nowrap`} onClick={onAdd} aria-label={t('outings.addFor', { name: pet.name })}>
              <Plus size={18} /> {t('outings.add')}
            </button>
          )}
          {on && managesPlan && (
            <button type="button" className={`${ghostButton} whitespace-nowrap`} onClick={onPlan} aria-label={t('outings.settingsFor', { name: pet.name })}>
              <Settings2 size={18} /> {t('outings.settings')}
            </button>
          )}
        </div>
      </div>
      {on ? (
        <p className="mt-1 text-base text-muted">{facts.join(' · ')}</p>
      ) : (
        <div className="mt-2">
          <p className="text-base text-muted">{pet.species === 'dog' ? t('outings.pitchDog', { name: pet.name }) : t('outings.pitch', { name: pet.name })}</p>
          {managesPlan ? (
            <button type="button" className={`${pet.species === 'dog' ? primaryButton : ghostButton} mt-3`} onClick={onPlan}>
              {t('outings.setUp')}
            </button>
          ) : (
            <p className="mt-1 text-sm text-muted">{t('outings.staffSetsUp')}</p>
          )}
        </div>
      )}
      {flag && (
        <p className={`mt-2 flex items-start gap-1.5 text-base ${flag.level === 'vet' ? 'font-medium text-attention' : 'text-muted'}`} role="note">
          <TriangleAlert size={16} className="mt-1 shrink-0" aria-hidden="true" /> {flag.text}
        </p>
      )}
      {tracked && (
        <>
          <h4 className="mt-5 mb-2 text-sm font-medium text-ink-soft">{t('outings.lastDays', { count: HISTORY_DAYS })}</h4>
          <ol className="grid grid-cols-7 gap-1.5 sm:grid-cols-14" aria-label={t('outings.strip', { name: pet.name, count: HISTORY_DAYS })}>
            {days.map((d, i) => {
              const at = parseYmd(d.day)!;
              // Today is still going: it shows its count, never as short.
              const under = i < days.length - 1 && underMinimum(d, plan?.poopMin);
              const met = !!plan?.poopMin && d.poops >= plan.poopMin;
              const tone = d.outings === 0 ? 'border border-dashed border-line text-muted' : under ? 'bg-attention-tint text-attention font-semibold' : met ? 'bg-primary text-on-primary font-semibold' : 'bg-tint text-link font-semibold';
              const words = [formatDayShort(at), d.outings ? t('outings.poopsDay', { count: d.poops }) : t('outings.nothingLogged'), d.walkMin ? t('outings.walked', { minutes: d.walkMin }) : ''].filter(Boolean).join(', ');
              return (
                <li key={d.day} className="flex flex-col items-center gap-0.5" aria-label={words} title={words}>
                  <span className="text-xs text-muted" aria-hidden="true">
                    {weekdayShort(at).slice(0, 2)}
                  </span>
                  <span className={`flex h-9 w-9 items-center justify-center rounded-full text-base tabular-nums ${tone}`} aria-hidden="true">
                    {d.outings ? d.poops : ''}
                  </span>
                  <span className="flex h-4 items-center gap-0.5 text-xs text-muted tabular-nums" aria-hidden="true">
                    {d.walkMin > 0 && (
                      <>
                        <Footprints size={11} />
                        {d.walkMin}
                      </>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
          <ul className="mt-3 border-t border-line" aria-label={t('outings.recent')}>
            {recent.map((o) => (
              <li key={o.id} className="flex min-h-12 items-center gap-3 border-b border-line py-1 last:border-b-0">
                <span className="min-w-0 flex-1">
                  <span className="block text-base text-ink">
                    {outingWhat(o)}
                    {o.note && <span className="text-muted"> · {o.note}</span>}
                  </span>
                  <span className="block text-sm text-muted">
                    {relativeDay(o.at, now)} · {formatTime(o.at)} · {o.by.toLowerCase() === me.toLowerCase() ? t('outings.you') : personName(o.by)}
                  </span>
                </span>
                <button type="button" className={iconButton} onClick={() => onEdit(o)} aria-label={t('outings.editAt', { time: formatTime(o.at) })}>
                  <Pencil size={18} />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
