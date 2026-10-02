import { useState, type CSSProperties, type ReactNode } from 'react';
import { Check, History, Pill, Plus } from 'lucide-react';
import type { Course, Feeding, Meal, MedDose, Pet } from '../lib/model';
import { formatAgo, lastFed, mealsOf, mealsOn } from '../lib/feeding';
import { courseText, dosesOn, slotMealName } from '../lib/courses';
import { personName } from '@huishouden/pwa-kit/people';
import { addDays, formatDayLong, formatTime, toYmd, type Ymd } from '@huishouden/pwa-kit/time';
import { formatClock } from '../lib/format';
import { PetAvatar } from './PetAvatar';
import { Chip, ghostButton, overline } from '@huishouden/pwa-kit/react/ui';

/**
 * The paper board, for every pet at once: one row per pet, one big toggle per meal and per dose of a
 * running medicine course. A done toggle says when and who; one whose time has passed says
 * "Not fed yet" or "Missed" in terracotta. The board is today's log, so it starts empty each day;
 * Yesterday switches it to the day before, to tick what was given but not logged.
 */
export function FeedingBoard({ pets, meals, feedings, courses, medDoses, me, now, onToggleMeal, onToggleDose, onAddMeal, onDoseLog }: {
  pets: Pet[];
  meals: Meal[];
  feedings: Feeding[];
  courses: Course[];
  medDoses: MedDose[];
  me: string;
  now: number;
  /** `day`: a moment on the day being ticked (today, or yesterday). */
  onToggleMeal: (pet: Pet, meal: Meal, day: number) => void;
  onToggleDose: (pet: Pet, course: Course, slot: number, day: Ymd) => void;
  onAddMeal: (petId: string) => void;
  /** Opens a course's doses day by day. */
  onDoseLog: (course: Course) => void;
}) {
  const [yesterday, setYesterday] = useState(false);
  // A moment on the shown day: now, or the same time yesterday.
  const day = yesterday ? addDays(now, -1) : now;
  const dayYmd = toYmd(day);
  const who = (email: string) => personName(email, { email: me });
  const dosesOf = (c: Course) => dosesOn(c, medDoses, dayYmd, now);
  const tilesOf = (pet: Pet) => mealsOf(meals, pet.id).length + courses.filter((c) => c.petId === pet.id).reduce((n, c) => n + dosesOf(c).length, 0);
  // One column count for the whole board, so AM sits above AM like on the paper one.
  const columns = Math.max(1, ...pets.map(tilesOf));
  return (
    <section className="rounded-2xl border border-stone-200 bg-white px-6 py-4 shadow-sm" aria-label="Feeding">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 className={overline}>Feeding and medicine</h2>
        <div className="flex items-center gap-3">
          <p className="hidden text-base text-stone-600 sm:block">{formatDayLong(day)}</p>
          <div className="flex gap-1.5" role="group" aria-label="Day shown">
            <Chip active={!yesterday} onClick={() => setYesterday(false)}>
              Today
            </Chip>
            <Chip active={yesterday} onClick={() => setYesterday(true)}>
              Yesterday
            </Chip>
          </div>
        </div>
      </div>
      {yesterday && <p className="mt-1 text-base text-stone-600">Ticking a meal or dose here logs it at its time yesterday.</p>}
      <ul>
        {pets.map((pet) => {
          const today = mealsOn(meals, feedings, pet.id, day, now);
          const petMeals = mealsOf(meals, pet.id);
          const running = courses.filter((c) => c.petId === pet.id && dosesOf(c).length > 0);
          const doses = running.flatMap((c) => dosesOf(c).map((d) => ({ course: c, ...d })));
          const last = lastFed(feedings, pet.id, now);
          const tiles = today.length + doses.length;
          return (
            <li key={pet.id} className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-stone-200 py-3 last:border-b-0 sm:flex-nowrap">
              <div className="flex min-w-0 basis-full items-center gap-3 sm:w-56 sm:shrink-0 sm:basis-auto">
                <PetAvatar pet={pet} pets={pets} size={48} />
                <div className="min-w-0">
                  <p className="truncate text-2xl font-semibold text-stone-800">{pet.name}</p>
                  <p className="text-base text-stone-600">{last ? `Last fed ${formatAgo(last.at, now)}` : 'No feeds logged'}</p>
                  {running.map((c) => (
                    <button key={c.id} type="button" className="-ml-1 flex min-h-9 items-center gap-1.5 rounded-lg px-1 text-base font-medium text-forest-700 hover:bg-forest-50" onClick={() => onDoseLog(c)} aria-label={`Doses by day for ${pet.name}'s ${c.name}`}>
                      <History size={16} aria-hidden="true" /> <span className="truncate">{c.name} by day</span>
                    </button>
                  ))}
                </div>
              </div>
              {tiles === 0 ? (
                <button type="button" className={ghostButton} onClick={() => onAddMeal(pet.id)}>
                  <Plus size={18} /> Add a meal
                </button>
              ) : (
                <div className="grid min-w-0 flex-1 grid-cols-2 gap-3 sm:grid-cols-[repeat(var(--cols),minmax(0,1fr))]" style={{ '--cols': columns } as CSSProperties} role="group" aria-label={`${pet.name} ${yesterday ? 'yesterday' : 'today'}`}>
                  {today.map(({ meal, status }) => {
                    const fed = status.state === 'fed';
                    const late = status.state === 'late';
                    return (
                      <Tile
                        key={meal.id}
                        done={fed}
                        late={late}
                        title={meal.name}
                        detail={fed ? `${formatTime(status.at)} · ${who(status.feeding.by)}` : late ? (yesterday ? 'Not fed' : 'Not fed yet') : `by ${formatTime(status.at)}`}
                        label={
                          fed
                            ? `${pet.name} ${meal.name}${yesterday ? ' yesterday' : ''}: fed at ${formatTime(status.at)} by ${who(status.feeding.by)}. Tap to undo.`
                            : yesterday
                              ? `${pet.name} ${meal.name} yesterday: not fed. Tap if fed.`
                              : `${pet.name} ${meal.name}: ${late ? 'not fed yet' : 'not yet'}. Tap when fed.`
                        }
                        onClick={() => onToggleMeal(pet, meal, day)}
                      />
                    );
                  })}
                  {doses.map(({ course, slot, time, status }) => {
                    const given = status.state === 'given';
                    const missed = status.state === 'missed';
                    const slotName = slotMealName(time, petMeals) ?? formatClock(time);
                    const title = course.times.length > 1 ? `${course.name} ${slotName}` : course.name;
                    return (
                      <Tile
                        key={`${course.id}-${slot}`}
                        done={given}
                        late={missed}
                        icon={<Pill size={20} className="shrink-0" aria-hidden="true" />}
                        compact
                        title={title}
                        detail={given ? `${formatTime(status.at)} · ${who(status.dose.by)}` : missed ? 'Missed' : courseText(course, now)}
                        label={
                          given
                            ? `${pet.name} ${course.name} ${slotName}${yesterday ? ' yesterday' : ''}: given at ${formatTime(status.at)} by ${who(status.dose.by)}. Tap to undo.`
                            : yesterday
                              ? `${pet.name} ${course.name} ${slotName} yesterday: missed. Tap if given.`
                              : `${pet.name} ${course.name} ${slotName}: ${missed ? 'missed' : 'not yet'}, ${courseText(course, now)}. Tap when given.`
                        }
                        onClick={() => onToggleDose(pet, course, slot, dayYmd)}
                      />
                    );
                  })}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function Tile({ done, late, title, detail, label, icon, compact, onClick }: {
  done: boolean;
  late: boolean;
  title: string;
  detail: string;
  label: string;
  icon?: ReactNode;
  /** Medicine tiles carry a longer title ("Antibiotic PM"), so it is a step smaller. */
  compact?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={done}
      aria-label={label}
      onClick={onClick}
      className={`flex min-h-20 w-full min-w-0 flex-col justify-center rounded-2xl px-4 py-2 text-left transition-colors duration-150 ${
        done
          ? 'bg-forest-700 text-white hover:bg-forest-600'
          : late
            ? 'border-2 border-terracotta bg-terracotta-light text-terracotta-dark hover:bg-white'
            : 'border border-stone-200 bg-white text-stone-800 hover:border-forest-400'
      }`}
    >
      <span className={`flex min-w-0 items-center gap-2 leading-tight font-semibold ${compact ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl'}`}>
        {done ? (
          <Check size={24} className="shrink-0" aria-hidden="true" />
        ) : (
          icon ?? <span className={`h-5 w-5 shrink-0 rounded-md border-2 ${late ? 'border-terracotta-dark' : 'border-stone-400'}`} aria-hidden="true" />
        )}
        <span className="truncate">{title}</span>
      </span>
      <span className={`mt-0.5 truncate text-base sm:text-lg ${done ? 'text-forest-100' : late ? 'font-semibold' : 'text-stone-600'}`}>{detail}</span>
    </button>
  );
}
