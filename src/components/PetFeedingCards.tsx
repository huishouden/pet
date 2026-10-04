import { History, Pencil, Pill, Plus } from 'lucide-react';
import type { Course, Feeding, Meal, MedDose, Pet } from '../lib/model';
import { mealsOf } from '../lib/feeding';
import { dailyCounts, recent as recentEntries } from '@huishouden/pwa-kit/log';
import { courseState, courseText, lastDay, progress, timesText } from '../lib/courses';
import { personInitial, personName } from '@huishouden/pwa-kit/people';
import { formatDayShort, formatTime, parseYmd, relativeDay, toYmd } from '@huishouden/pwa-kit/time';
import { formatClock, formatDateShort } from '../lib/format';
import type { Open } from '../PetApp';
import { courseRefusalText, type PetPermissions } from '../lib/permissions';
import { cardClass, ghostButton, iconButton, overline } from '@huishouden/pwa-kit/react/ui';
import { useT } from '../i18n';
import { atClock, toHhmm } from '@huishouden/pwa-kit/time';

const DAYS = 14;

/** The pet's meals (the board's toggles) and the last two weeks of feeds, one row per day. */
export function FeedingCard({ pet, meals, feedings, me, now, open }: { pet: Pet; meals: Meal[]; feedings: Feeding[]; me: string; now: number; open: Open }) {
  const t = useT();
  const mine = mealsOf(meals, pet.id);
  const ofPet = (f: Feeding) => f.petId === pet.id;
  const recent = recentEntries(feedings, now, DAYS, ofPet);
  const days = dailyCounts(feedings, now, DAYS, ofPet).reverse();
  const extrasOn = (day: string) => recent.filter((f) => !mine.some((m) => m.id === f.mealId) && toYmd(f.at) === day);

  return (
    <section className={`${cardClass} p-6`} aria-label={t('feedingCard.of', { name: pet.name })}>
      <div className="flex flex-wrap items-center justify-between gap-x-4">
        <h3 className={overline}>{t('board.feeding')}</h3>
        <div className="flex gap-1">
          <button type="button" className={`${ghostButton} whitespace-nowrap`} onClick={() => open.feeding(null, pet.id)}>
            <Plus size={18} /> {t('feedingDialog.new')}
          </button>
          <button type="button" className={`${ghostButton} whitespace-nowrap`} onClick={() => open.meal(null, pet.id)}>
            <Plus size={18} /> {t('feedingDialog.meal')}
          </button>
        </div>
      </div>
      {mine.length === 0 ? (
        <p className="mt-2 text-base text-muted">{t('feedingCard.noMeals', { name: pet.name })}</p>
      ) : (
        <ul className="mt-1">
          {mine.map((m) => (
            <li key={m.id} className="flex min-h-12 items-center gap-3 border-b border-line last:border-b-0">
              <span className="w-16 shrink-0 text-lg font-semibold text-ink">{m.name}</span>
              <span className="min-w-0 flex-1 text-base text-muted">
                {[t('feedingCard.cutoff', { time: formatClock(m.time) }), m.food, m.portion, m.note].filter(Boolean).join(' · ')}
              </span>
              <button type="button" className={iconButton} onClick={() => open.meal(m, pet.id)} aria-label={t('a11y.edit', { name: m.name })}>
                <Pencil size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <h4 className="mt-5 mb-1 text-sm font-medium text-ink-soft">{t('feedingCard.lastDays', { count: DAYS })}</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-base" aria-label={t('feedingCard.table', { name: pet.name, count: DAYS })}>
          <thead>
            <tr className="border-b border-line text-sm text-muted">
              <th scope="col" className="py-2 pr-3 font-medium">
                {t('weightDialog.day')}
              </th>
              {mine.map((m) => (
                <th key={m.id} scope="col" className="px-2 py-2 font-medium">
                  {m.name}
                </th>
              ))}
              <th scope="col" className="px-2 py-2 font-medium">
                {t('feedingDialog.extra')}
              </th>
              <th scope="col" className="py-2 pl-2 text-right font-medium">
                {t('feedingCard.feeds')}
              </th>
            </tr>
          </thead>
          <tbody>
            {days.map(({ day, count }) => {
              const dayAt = parseYmd(day)!;
              const extras = extrasOn(day);
              return (
                <tr key={day} className="border-b border-line last:border-b-0">
                  <th scope="row" className="py-1 pr-3 font-normal whitespace-nowrap text-ink-soft">
                    {Math.abs(dayAt - now) < 2 * 86_400_000 ? relativeDay(dayAt, now) : formatDayShort(dayAt)}
                  </th>
                  {mine.map((m) => {
                    const f = recent.filter((x) => x.mealId === m.id && toYmd(x.at) === day).sort((a, b) => b.at - a.at)[0];
                    return (
                      <td key={m.id} className="px-1 py-0.5">
                        {f ? (
                          <button
                            type="button"
                            className="-mx-1 inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-ink tabular-nums hover:bg-sunken"
                            onClick={() => open.feeding(f, pet.id)}
                            aria-label={t('feedingCard.fedLabel', { meal: m.name, day: formatDayShort(dayAt), at: atClock(toHhmm(f.at)), who: personName(f.by, { email: me }) })}
                          >
                            {formatTime(f.at)} <span className="text-sm text-muted">{personInitial(f.by, { email: me })}</span>
                          </button>
                        ) : (
                          <span className="px-1 text-muted">
                            <span aria-hidden="true">–</span>
                            <span className="sr-only">{t('feedingCard.notFed')}</span>
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-1 py-0.5">
                    {extras.map((f) => (
                      <button key={f.id} type="button" className="-mx-1 inline-flex min-h-11 items-center rounded-xl px-2 text-ink tabular-nums hover:bg-sunken" onClick={() => open.feeding(f, pet.id)} aria-label={t('feedingCard.extraLabel', { at: atClock(toHhmm(f.at)) })}>
                        {formatTime(f.at)}
                      </button>
                    ))}
                  </td>
                  <td className="py-1 pl-2 text-right font-semibold text-ink tabular-nums">{count}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}


/** Medicine courses: running and upcoming ones with their day and doses given, then finished ones. */
export function MedicineCard({ pet, courses, medDoses, now, open, perms }: { pet: Pet; courses: Course[]; medDoses: MedDose[]; now: number; open: Open; perms?: PetPermissions }) {
  const t = useT();
  const manages = perms?.managesCourses ?? true;
  const mine = courses.filter((c) => c.petId === pet.id).sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
  const current = mine.filter((c) => courseState(c, now) !== 'finished');
  const finished = mine.filter((c) => courseState(c, now) === 'finished');
  return (
    <section className={`${cardClass} p-6`} aria-label={t('medicineCard.of', { name: pet.name })}>
      <div className="flex items-center justify-between gap-4">
        <h3 className={overline}>{t('medicineCard.title')}</h3>
        {manages && (
          <button type="button" className={ghostButton} onClick={() => open.course(null, pet.id)}>
            <Plus size={18} /> {t('medicineCard.add')}
          </button>
        )}
      </div>
      {!manages && <p className="mt-1 text-sm text-muted">{courseRefusalText()}</p>}
      {mine.length === 0 && <p className="mt-2 text-base text-muted">{t('medicineCard.empty')}</p>}
      <ul>
        {current.map((c) => {
          const p = progress(c, medDoses);
          return (
            <li key={c.id} className="flex items-start gap-3 border-b border-line py-3 last:border-b-0">
              <Pill size={22} className="mt-1 shrink-0 text-link" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-lg font-semibold text-ink">
                  {c.name} <span className="font-normal text-muted">· {c.dose}</span>
                </p>
                <p className="text-base text-ink-soft">
                  <span className="font-semibold text-link">{courseText(c, now)}</span> · {timesText(c.times.length)}
                  {c.withFood ? ` ${t('course.withFood')}` : ''} · {t('doseLog.given', { given: p.given, total: p.total })} · {t('doseLog.complete', { complete: p.daysComplete, days: p.days })}
                </p>
                <p className="text-base text-muted">{t('medicineCard.lastDose', { date: formatDateShort(parseYmd(lastDay(c))!) })}</p>
                {c.notes && <p className="text-base text-muted">{c.notes}</p>}
                {perms && !perms.mayGiveCourse(c) && <p className="text-base font-medium text-attention">{perms.courseRefusal(c)}</p>}
                {courseState(c, now) === 'active' && (
                  <button type="button" className={`${ghostButton} -ml-2 mt-1`} onClick={() => open.doseLog(c)} aria-label={t('medicineCard.dosesByDayFor', { name: c.name })}>
                    <History size={18} /> {t('medicineCard.dosesByDay')}
                  </button>
                )}
              </div>
              {manages && (
                <button type="button" className={iconButton} onClick={() => open.course(c, pet.id)} aria-label={t('a11y.edit', { name: c.name })}>
                  <Pencil size={18} />
                </button>
              )}
            </li>
          );
        })}
        {finished.map((c) => (
          <li key={c.id} className="flex min-h-12 items-center gap-3 border-b border-line last:border-b-0">
            <span className="min-w-0 flex-1 text-base text-muted">
              <span className="font-medium text-ink">{c.name}</span> · {t('medicineCard.finished', { date: formatDateShort(parseYmd(lastDay(c))!), given: progress(c, medDoses).given, total: progress(c, medDoses).total })}
            </span>
            <button type="button" className={iconButton} onClick={() => open.doseLog(c)} aria-label={t('medicineCard.dosesByDayFor', { name: c.name })}>
              <History size={18} />
            </button>
            {manages && (
              <button type="button" className={iconButton} onClick={() => open.course(c, pet.id)} aria-label={t('a11y.edit', { name: c.name })}>
                <Pencil size={18} />
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
