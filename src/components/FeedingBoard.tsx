import { useState, type CSSProperties, type ReactNode } from 'react';
import { Check, Pill, Plus } from 'lucide-react';
import type { Course, Feeding, Meal, MedDose, Pet } from '../lib/model';
import { mealsOf, mealsOn } from '../lib/feeding';
import { courseText, dosesOn, slotMealName } from '../lib/courses';
import { personName } from '@huishouden/pwa-kit/people';
import { addDays, atClock, formatDayLong, formatTime, toHhmm, toYmd, type Ymd } from '@huishouden/pwa-kit/time';
import { useT } from '../i18n';
import { formatClock } from '../lib/format';
import { PetAvatar } from './PetAvatar';
import { Chip, ghostButton, overline } from '@huishouden/pwa-kit/react/ui';

/**
 * The paper board, compact, for every pet at once: one small row per pet (photo and name), one
 * toggle per meal and per dose of a running medicine course. A done toggle says when and who; one
 * whose time has passed says "Not fed yet" or "Missed" in terracotta. The board is today's log, so it
 * starts empty each day; Yesterday switches it to the day before, to tick what was given but not
 * logged. Everything else about a pet is on its page.
 */
export function FeedingBoard({ pets, meals, feedings, courses, medDoses, me, now, onToggleMeal, onToggleDose, onAddMeal }: {
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
}) {
  const t = useT();
  const [yesterday, setYesterday] = useState(false);
  // "Biscuit AM", or "Biscuit AM yesterday" on the day before.
  const subject = (pet: string, thing: string) => (yesterday ? t('toast.whoYesterday', { who: t('toast.petMeal', { pet, meal: thing }) }) : t('toast.petMeal', { pet, meal: thing }));
  const at = (ms: number) => atClock(toHhmm(ms));
  // A moment on the shown day: now, or the same time yesterday.
  const day = yesterday ? addDays(now, -1) : now;
  const dayYmd = toYmd(day);
  const who = (email: string) => personName(email, { email: me });
  const dosesOf = (c: Course) => dosesOn(c, medDoses, dayYmd, now);
  const tilesOf = (pet: Pet) => mealsOf(meals, pet.id).length + courses.filter((c) => c.petId === pet.id).reduce((n, c) => n + dosesOf(c).length, 0);
  // One column count for the whole board, so AM sits above AM like on the paper one.
  const columns = Math.max(1, ...pets.map(tilesOf));
  return (
    <section className="rounded-2xl border border-line bg-surface px-5 py-4 shadow-sm sm:px-6" aria-label={t('board.feeding')}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 className={overline}>{t('board.title')}</h2>
        <div className="flex items-center gap-3">
          {yesterday && <p className="hidden text-base text-muted sm:block">{formatDayLong(day)}</p>}
          <div className="flex gap-1.5" role="group" aria-label={t('board.dayShown')}>
            <Chip active={!yesterday} onClick={() => setYesterday(false)}>
              {t('board.today')}
            </Chip>
            <Chip active={yesterday} onClick={() => setYesterday(true)}>
              {t('board.yesterday')}
            </Chip>
          </div>
        </div>
      </div>
      {yesterday && <p className="mt-1 text-base text-muted">{t('board.yesterdayHint')}</p>}
      <ul>
        {pets.map((pet) => {
          const today = mealsOn(meals, feedings, pet.id, day, now);
          const petMeals = mealsOf(meals, pet.id);
          const running = courses.filter((c) => c.petId === pet.id && dosesOf(c).length > 0);
          const doses = running.flatMap((c) => dosesOf(c).map((d) => ({ course: c, ...d })));
          const tiles = today.length + doses.length;
          return (
            <li key={pet.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line py-2.5 last:border-b-0 sm:flex-nowrap">
              <div className="flex min-w-0 basis-full items-center gap-2.5 sm:w-28 sm:shrink-0 sm:basis-auto">
                <PetAvatar pet={pet} pets={pets} size={36} />
                <p className="truncate text-lg font-semibold text-ink">{pet.name}</p>
              </div>
              {tiles === 0 ? (
                <button type="button" className={ghostButton} onClick={() => onAddMeal(pet.id)}>
                  <Plus size={18} /> {t('board.addMeal')}
                </button>
              ) : (
                <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-[repeat(var(--cols),minmax(0,1fr))]" style={{ '--cols': columns } as CSSProperties} role="group" aria-label={yesterday ? t('toast.whoYesterday', { who: pet.name }) : t('board.petToday', { name: pet.name })}>
                  {today.map(({ meal, status }) => {
                    const fed = status.state === 'fed';
                    const late = status.state === 'late';
                    return (
                      <Tile
                        key={meal.id}
                        small
                        done={fed}
                        late={late}
                        title={meal.name}
                        detail={fed ? `${formatTime(status.at)} · ${who(status.feeding.by)}` : late ? (yesterday ? t('board.notFed') : t('board.notFedYet')) : t('board.byTime', { time: formatTime(status.at) })}
                        label={
                          fed
                            ? t('board.fedLabel', { what: subject(pet.name, meal.name), at: at(status.at), who: who(status.feeding.by) })
                            : yesterday
                              ? t('board.notFedYesterdayLabel', { what: subject(pet.name, meal.name) })
                              : late
                                ? t('board.notFedYetLabel', { what: subject(pet.name, meal.name) })
                                : t('board.notYetMealLabel', { what: subject(pet.name, meal.name) })
                        }
                        onClick={() => onToggleMeal(pet, meal, day)}
                      />
                    );
                  })}
                  {doses.map(({ course, slot, time, status }) => {
                    const given = status.state === 'given';
                    const skipped = status.state === 'skipped';
                    const missed = status.state === 'missed';
                    const slotName = slotMealName(time, petMeals) ?? formatClock(time);
                    const title = course.times.length > 1 ? `${course.name} ${slotName}` : course.name;
                    return (
                      <Tile
                        key={`${course.id}-${slot}`}
                        small
                        done={given}
                        late={missed}
                        icon={<Pill size={20} className="shrink-0" aria-hidden="true" />}
                        compact
                        title={title}
                        detail={given ? `${formatTime(status.at)} · ${who(status.dose.by)}` : skipped ? t('board.skippedBy', { who: who(status.dose.by) }) : missed ? t('board.missed') : courseText(course, now)}
                        label={
                          given
                            ? t('board.givenLabel', { what: subject(pet.name, `${course.name} ${slotName}`), at: at(status.at), who: who(status.dose.by) })
                            : skipped
                              ? t('board.skippedLabel', { what: subject(pet.name, `${course.name} ${slotName}`), who: who(status.dose.by) })
                              : yesterday
                                ? t('board.missedYesterdayLabel', { what: subject(pet.name, `${course.name} ${slotName}`) })
                                : t(missed ? 'board.missedLabel' : 'board.notYetDoseLabel', { what: subject(pet.name, `${course.name} ${slotName}`), course: courseText(course, now) })
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

export function Tile({ done, late, title, detail, label, icon, compact, small, onClick }: {
  done: boolean;
  late: boolean;
  title: string;
  detail: string;
  label: string;
  icon?: ReactNode;
  /** Medicine tiles carry a longer title ("Antibiotic PM"), so it is a step smaller. */
  compact?: boolean;
  /** The Today board's size: a short tile, still a full tap target. */
  small?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={done}
      aria-label={label}
      onClick={onClick}
      className={`flex w-full min-w-0 flex-col justify-center text-left ${small ? 'min-h-14 rounded-xl px-3 py-1.5' : 'min-h-20 rounded-2xl px-4 py-2'} transition-colors duration-150 ${
        done
          ? 'bg-primary text-on-primary hover:bg-primary-hover'
          : late
            ? 'border-2 border-terracotta bg-attention-tint text-attention hover:bg-surface'
            : 'border border-line bg-surface text-ink hover:border-forest-400'
      }`}
    >
      <span className={`flex min-w-0 items-center gap-2 leading-tight font-semibold ${small ? 'text-base sm:text-lg' : compact ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl'}`}>
        {done ? (
          <Check size={24} className="shrink-0" aria-hidden="true" />
        ) : (
          icon ?? <span className={`h-5 w-5 shrink-0 rounded-md border-2 ${late ? 'border-terracotta-dark dark:border-terracotta-light' : 'border-stone-400'}`} aria-hidden="true" />
        )}
        <span className="truncate">{title}</span>
      </span>
      <span className={`mt-0.5 truncate ${small ? 'text-sm sm:text-base' : 'text-base sm:text-lg'} ${done ? 'text-forest-100 dark:text-forest-900' : late ? 'font-semibold' : 'text-muted'}`}>{detail}</span>
    </button>
  );
}
