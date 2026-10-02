import { History, Pencil, Pill, Plus } from 'lucide-react';
import type { Course, Feeding, Meal, MedDose, Pet } from '../lib/model';
import { dailyCounts, mealsOf, recentFeedings } from '../lib/feeding';
import { courseState, courseText, lastDay, progress, timesText } from '../lib/courses';
import { personInitial, personName } from '@huishouden/pwa-kit/people';
import { formatDayShort, formatTime, parseYmd, relativeDay, toYmd } from '@huishouden/pwa-kit/time';
import { formatClock, formatDateShort } from '../lib/format';
import type { Open } from '../PetApp';
import { COURSE_REFUSAL, type PetPermissions } from '../lib/permissions';
import { cardClass, ghostButton, iconButton, overline } from '@huishouden/pwa-kit/react/ui';

const DAYS = 14;

/** The pet's meals (the board's toggles) and the last two weeks of feeds, one row per day. */
export function FeedingCard({ pet, meals, feedings, me, now, open }: { pet: Pet; meals: Meal[]; feedings: Feeding[]; me: string; now: number; open: Open }) {
  const mine = mealsOf(meals, pet.id);
  const recent = recentFeedings(feedings, pet.id, now, DAYS);
  const days = dailyCounts(feedings, pet.id, now, DAYS).reverse();
  const extrasOn = (day: string) => recent.filter((f) => !mine.some((m) => m.id === f.mealId) && toYmd(f.at) === day);

  return (
    <section className={`${cardClass} p-6`} aria-label={`${pet.name}'s feeding`}>
      <div className="flex items-center justify-between gap-4">
        <h3 className={overline}>Feeding</h3>
        <div className="flex gap-1">
          <button type="button" className={ghostButton} onClick={() => open.feeding(null, pet.id)}>
            <Plus size={18} /> Log a feed
          </button>
          <button type="button" className={ghostButton} onClick={() => open.meal(null, pet.id)}>
            <Plus size={18} /> Meal
          </button>
        </div>
      </div>
      {mine.length === 0 ? (
        <p className="mt-2 text-base text-stone-600">No meals on {pet.name}'s board. Add one to tick it each day.</p>
      ) : (
        <ul className="mt-1">
          {mine.map((m) => (
            <li key={m.id} className="flex min-h-12 items-center gap-3 border-b border-stone-200 last:border-b-0">
              <span className="w-16 shrink-0 text-lg font-semibold text-stone-800">{m.name}</span>
              <span className="min-w-0 flex-1 text-base text-stone-600">
                {[`Not fed yet after ${formatClock(m.time)}`, m.food, m.portion, m.note].filter(Boolean).join(' · ')}
              </span>
              <button type="button" className={iconButton} onClick={() => open.meal(m, pet.id)} aria-label={`Edit ${m.name}`}>
                <Pencil size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <h4 className="mt-5 mb-1 text-sm font-medium text-stone-700">Last {DAYS} days</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-base" aria-label={`${pet.name}'s feeds, last ${DAYS} days`}>
          <thead>
            <tr className="border-b border-stone-200 text-sm text-stone-600">
              <th scope="col" className="py-2 pr-3 font-medium">
                Day
              </th>
              {mine.map((m) => (
                <th key={m.id} scope="col" className="px-2 py-2 font-medium">
                  {m.name}
                </th>
              ))}
              <th scope="col" className="px-2 py-2 font-medium">
                Extra
              </th>
              <th scope="col" className="py-2 pl-2 text-right font-medium">
                Feeds
              </th>
            </tr>
          </thead>
          <tbody>
            {days.map(({ day, count }) => {
              const t = parseYmd(day)!;
              const extras = extrasOn(day);
              return (
                <tr key={day} className="border-b border-stone-200 last:border-b-0">
                  <th scope="row" className="py-1 pr-3 font-normal whitespace-nowrap text-stone-700">
                    {Math.abs(t - now) < 2 * 86_400_000 ? relativeDay(t, now) : formatDayShort(t)}
                  </th>
                  {mine.map((m) => {
                    const f = recent.filter((x) => x.mealId === m.id && toYmd(x.at) === day).sort((a, b) => b.at - a.at)[0];
                    return (
                      <td key={m.id} className="px-1 py-0.5">
                        {f ? (
                          <button
                            type="button"
                            className="-mx-1 inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-stone-800 tabular-nums hover:bg-stone-100"
                            onClick={() => open.feeding(f, pet.id)}
                            aria-label={`${m.name} ${day}: fed at ${formatTime(f.at)} by ${personName(f.by, { email: me })}. Edit`}
                          >
                            {formatTime(f.at)} <span className="text-sm text-stone-600">{personInitial(f.by, { email: me })}</span>
                          </button>
                        ) : (
                          <span className="px-1 text-stone-500">
                            <span aria-hidden="true">–</span>
                            <span className="sr-only">not fed</span>
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-1 py-0.5">
                    {extras.map((f) => (
                      <button key={f.id} type="button" className="-mx-1 inline-flex min-h-11 items-center rounded-xl px-2 text-stone-800 tabular-nums hover:bg-stone-100" onClick={() => open.feeding(f, pet.id)} aria-label={`Extra feed at ${formatTime(f.at)}. Edit`}>
                        {formatTime(f.at)}
                      </button>
                    ))}
                  </td>
                  <td className="py-1 pl-2 text-right font-semibold text-stone-800 tabular-nums">{count}</td>
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
  const manages = perms?.managesCourses ?? true;
  const mine = courses.filter((c) => c.petId === pet.id).sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
  const current = mine.filter((c) => courseState(c, now) !== 'finished');
  const finished = mine.filter((c) => courseState(c, now) === 'finished');
  return (
    <section className={`${cardClass} p-6`} aria-label={`${pet.name}'s medicine`}>
      <div className="flex items-center justify-between gap-4">
        <h3 className={overline}>Medicine courses</h3>
        {manages && (
          <button type="button" className={ghostButton} onClick={() => open.course(null, pet.id)}>
            <Plus size={18} /> Add course
          </button>
        )}
      </div>
      {!manages && <p className="mt-1 text-sm text-stone-600">{COURSE_REFUSAL}</p>}
      {mine.length === 0 && <p className="mt-2 text-base text-stone-600">A short course ("1 tablet twice a day for 7 days") puts each dose on the Today board until it ends.</p>}
      <ul>
        {current.map((c) => {
          const p = progress(c, medDoses);
          return (
            <li key={c.id} className="flex items-start gap-3 border-b border-stone-200 py-3 last:border-b-0">
              <Pill size={22} className="mt-1 shrink-0 text-forest-700" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-lg font-semibold text-stone-800">
                  {c.name} <span className="font-normal text-stone-600">· {c.dose}</span>
                </p>
                <p className="text-base text-stone-700">
                  <span className="font-semibold text-forest-700">{courseText(c, now)}</span> · {timesText(c.times.length)}
                  {c.withFood ? ' with food' : ''} · {p.given} of {p.total} doses given · {p.daysComplete} of {p.days} days complete
                </p>
                <p className="text-base text-stone-600">Last dose {formatDateShort(parseYmd(lastDay(c))!)}</p>
                {c.notes && <p className="text-base text-stone-600">{c.notes}</p>}
                {perms && !perms.mayGiveCourse(c) && <p className="text-base font-medium text-terracotta-dark">{perms.courseRefusal(c)}</p>}
                {courseState(c, now) === 'active' && (
                  <button type="button" className={`${ghostButton} -ml-2 mt-1`} onClick={() => open.doseLog(c)} aria-label={`Doses by day for ${c.name}`}>
                    <History size={18} /> Doses by day
                  </button>
                )}
              </div>
              {manages && (
                <button type="button" className={iconButton} onClick={() => open.course(c, pet.id)} aria-label={`Edit ${c.name}`}>
                  <Pencil size={18} />
                </button>
              )}
            </li>
          );
        })}
        {finished.map((c) => (
          <li key={c.id} className="flex min-h-12 items-center gap-3 border-b border-stone-200 last:border-b-0">
            <span className="min-w-0 flex-1 text-base text-stone-600">
              <span className="font-medium text-stone-800">{c.name}</span> · finished {formatDateShort(parseYmd(lastDay(c))!)} · {progress(c, medDoses).given} of {progress(c, medDoses).total} doses
            </span>
            <button type="button" className={iconButton} onClick={() => open.doseLog(c)} aria-label={`Doses by day for ${c.name}`}>
              <History size={18} />
            </button>
            {manages && (
              <button type="button" className={iconButton} onClick={() => open.course(c, pet.id)} aria-label={`Edit ${c.name}`}>
                <Pencil size={18} />
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
