import { useId, useState, type CSSProperties, type ReactNode } from 'react';
import { Pill, Plus, Utensils } from 'lucide-react';
import type { Course, Feeding, Meal, MedDose, Pet } from '../lib/model';
import { mealsOf, mealsOn } from '../lib/feeding';
import { courseText, dosesOn, slotMealName } from '../lib/courses';
import { personName } from '@huishouden/pwa-kit/people';
import { addDays, formatDayLong, formatTime, toYmd, type Ymd } from '@huishouden/pwa-kit/time';
import { useT } from '../i18n';
import { formatClock } from '../lib/format';
import { PetAvatar } from './PetAvatar';
import { Chip, CompleteButton, DoneBadge, doneLine, ghostButton, overline } from '@huishouden/pwa-kit/react/ui';

/**
 * The paper board, compact, for every pet at once: one small row per pet (photo and name), one
 * tile per meal and per dose of a running medicine course (`Tile`). A done tile says who and when,
 * with Undo; an open one whose time has passed says "Not fed yet" or "Missed" in terracotta. The board is today's log, so it
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
                        state={fed ? 'done' : late ? 'late' : 'open'}
                        title={meal.name}
                        verb={t('done.feed')}
                        detail={fed ? t('done.fedByAt', { name: who(status.feeding.by), at: formatTime(status.at) }) : late ? (yesterday ? t('board.notFed') : t('board.notFedYet')) : t('board.byTime', { time: formatTime(status.at) })}
                        label={t('done.feedName', { name: subject(pet.name, meal.name) })}
                        undoLabel={t('done.undoFed', { name: subject(pet.name, meal.name) })}
                        onDo={() => onToggleMeal(pet, meal, day)}
                        onUndo={() => onToggleMeal(pet, meal, day)}
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
                        state={given ? 'done' : skipped ? 'skipped' : missed ? 'late' : 'open'}
                        icon={<Pill size={20} className="shrink-0 text-link" aria-hidden="true" />}
                        compact
                        title={title}
                        verb={t('done.give')}
                        detail={given ? t('done.givenByAt', { name: who(status.dose.by), at: formatTime(status.at) }) : skipped ? doneLine({ by: who(status.dose.by), at: formatTime(status.at), skipped: true }) : missed ? t('board.missed') : courseText(course, now)}
                        label={t('done.giveName', { name: subject(pet.name, `${course.name} ${slotName}`) })}
                        undoLabel={t(skipped ? 'done.undoSkipped' : 'done.undoGiven', { name: subject(pet.name, `${course.name} ${slotName}`) })}
                        onDo={() => onToggleDose(pet, course, slot, dayYmd)}
                        onUndo={() => onToggleDose(pet, course, slot, dayYmd)}
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

/**
 * One meal or dose on the board or a course's log. Open: an outlined forest tile that is the button,
 * its title, then the verb and when ("Feed · by 7:00 PM"; past its time, "Not fed yet" in
 * terracotta). Done: not a button any more: the check badge, the title muted, "Fed by You · 7:04 AM"
 * and a small Undo (the board is the day's log, so Undo stays). Skipped: the quiet skip badge.
 */
export function Tile({ state, title, verb, detail, label, undoLabel, icon, compact, small, onDo, onUndo }: {
  state: 'open' | 'late' | 'done' | 'skipped';
  title: string;
  /** The open tile's verb: "Feed", "Give". */
  verb: string;
  /** Open: when it is due or that it is late. Done: who and when. */
  detail: string;
  /** The open tile's name: "Feed Biscuit AM". */
  label: string;
  /** Undo's name: "Undo fed for Biscuit AM". */
  undoLabel: string;
  icon?: ReactNode;
  /** Medicine tiles carry a longer title ("Antibiotic PM"), so it is a step smaller. */
  compact?: boolean;
  /** The Today board's size: a short tile, still a full tap target. */
  small?: boolean;
  onDo: () => void;
  onUndo: () => void;
}) {
  const detailId = useId();
  const done = state === 'done' || state === 'skipped';
  const heading = `leading-tight font-semibold ${small ? 'text-base sm:text-lg' : compact ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl'}`;
  const sub = small ? 'text-sm sm:text-base' : 'text-base sm:text-lg';
  if (done)
    return (
      <div data-completion={state} className={`flex w-full min-w-0 flex-col justify-center border border-line bg-surface ${small ? 'rounded-xl py-1 pr-1 pl-3' : 'rounded-2xl py-1.5 pr-1 pl-4'}`}>
        <div className="flex min-w-0 items-center gap-2">
          <span className="[&>span]:h-7 [&>span]:w-7 [&_svg]:h-4 [&_svg]:w-4">
            <DoneBadge skipped={state === 'skipped'} />
          </span>
          <span className={`min-w-0 flex-1 truncate text-muted ${heading}`}>{title}</span>
          <CompleteButton done name={title} undoLabel={undoLabel} onDone={onDo} onUndo={onUndo} />
        </div>
        <span className={`-mt-1 pb-1 leading-snug text-muted ${sub}`}>{detail}</span>
      </div>
    );
  const late = state === 'late';
  return (
    <button
      type="button"
      data-completion="open"
      aria-label={label}
      aria-describedby={detailId}
      onClick={onDo}
      className={`flex w-full min-w-0 flex-col justify-center border border-primary bg-surface text-left text-ink transition-colors duration-150 hover:bg-tint ${small ? 'min-h-14 rounded-xl px-3 py-1.5' : 'min-h-20 rounded-2xl px-4 py-2'}`}
    >
      <span className={`flex min-w-0 items-center gap-2 ${heading}`}>
        {icon ?? <Utensils size={20} className="shrink-0 text-link" aria-hidden="true" />}
        <span className="truncate">{title}</span>
      </span>
      <span id={detailId} className={`mt-0.5 truncate ${sub}`}>
        <span className="font-semibold text-link">{verb}</span>
        <span className={late ? 'font-semibold text-attention' : 'text-muted'}> · {detail}</span>
      </span>
    </button>
  );
}
