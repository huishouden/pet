import { useState } from 'react';
import { Check, Pill } from 'lucide-react';
import type { Course, Meal, MedDose, Pet } from '../lib/model';
import { courseHistory, courseText, progress, slotAt, slotMealName } from '../lib/courses';
import { mealsOf } from '../lib/feeding';
import { formatClock } from '../lib/format';
import { personName } from '@huishouden/pwa-kit/people';
import { atClock, formatTime, longDate, toYmd, type Ymd, isHhmm, toHhmm } from '@huishouden/pwa-kit/time';
import { Dialog, ghostButton, inputClass, primaryButton, secondaryButton } from '@huishouden/pwa-kit/react/ui';
import { Tile } from './FeedingBoard';
import { useT } from '../i18n';
import { capitalize } from '@huishouden/pwa-kit/i18n';

/**
 * A medicine course day by day, from its first day through today: each dose as a toggle like the
 * board's. Earlier days can be ticked (logged at the dose's time that day) and a given dose's time
 * changed; doses not given on earlier days say "Missed". A dose can be skipped instead (handled,
 * not given: "Skipped"); a tap on a skipped one undoes the skip.
 */
export function DoseLogDialog({ course, pet, meals, medDoses, me, now, onToggle, onSkip, onMove, onClose }: {
  course: Course;
  pet: Pet | undefined;
  meals: Meal[];
  medDoses: MedDose[];
  me: string;
  now: number;
  onToggle: (slot: number, day: Ymd) => void;
  /** Marks a dose skipped; absent for those who may not give this course. */
  onSkip?: (slot: number, day: Ymd) => void;
  onMove: (dose: MedDose, at: number) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [editing, setEditing] = useState<{ dose: MedDose; time: string } | null>(null);
  const history = courseHistory(course, medDoses, now);
  const p = progress(course, medDoses);
  const petMeals = mealsOf(meals, course.petId);
  const who = (email: string) => personName(email, { email: me });
  const today = toYmd(now);
  const name = pet?.name;
  // "Antibiotic PM today", "Antibiotic PM on Tuesday, May 12"; with the pet's name first for the toggles.
  const whenOf = (title: string, day: Ymd) => (day === today ? t('doseLog.titleToday', { title }) : t('doseLog.titleOn', { title, date: longDate(day, today) }));
  const subject = (title: string, day: Ymd) => whenOf(name ? t('toast.petMeal', { pet: name, meal: title }) : title, day);

  return (
    <Dialog
      title={t('doseLog.title', { name: course.name })}
      onClose={onClose}
      footer={
        <button type="button" className={primaryButton} onClick={onClose}>
          {t('common.done')}
        </button>
      }
    >
      <p className="text-base text-ink-soft">
        <span className="font-semibold text-link">{courseText(course, now)}</span> · {t('doseLog.given', { given: p.given, total: p.total })} · {t('doseLog.complete', { complete: p.daysComplete, days: p.days })}
      </p>
      {history.length === 0 && <p className="mt-3 text-base text-muted">{t('doseLog.notStarted')}</p>}
      <ol className="mt-3" aria-label={t('courseDialog.days')}>
        {history.map(({ day, n, doses, complete }) => {
          const dayWords = day === today ? t('board.today') : capitalize(longDate(day, today));
          return (
            <li key={day} className="border-b border-line py-3 last:border-b-0" aria-label={t('doseLog.dayLabel', { n, day: dayWords })}>
              <p className="flex items-center gap-2 text-base font-semibold text-ink">
                {t('doseLog.day', { n, day: dayWords })}
                {complete && (
                  <span className="flex items-center gap-1 text-sm font-medium text-positive">
                    <Check size={16} aria-hidden="true" /> {t('doseLog.allGiven')}
                  </span>
                )}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {doses.map(({ slot, time, status }) => {
                  const given = status.state === 'given';
                  const skipped = status.state === 'skipped';
                  const missed = status.state === 'missed';
                  const slotName = slotMealName(time, petMeals) ?? formatClock(time);
                  const title = course.times.length > 1 ? `${course.name} ${slotName}` : course.name;
                  return (
                    <div key={slot} className="min-w-0">
                      <Tile
                        done={given}
                        late={missed}
                        compact
                        icon={<Pill size={20} className="shrink-0" aria-hidden="true" />}
                        title={course.times.length > 1 ? slotName : t('courseDialog.dose')}
                        detail={given ? `${formatTime(status.at)} · ${who(status.dose.by)}` : skipped ? t('board.skippedBy', { who: who(status.dose.by) }) : missed ? t('board.missed') : t('board.byTime', { time: formatTime(status.at) })}
                        label={
                          given
                            ? t('board.givenLabel', { what: subject(title, day), at: atClock(toHhmm(status.at)), who: who(status.dose.by) })
                            : skipped
                              ? t('board.skippedLabel', { what: subject(title, day), who: who(status.dose.by) })
                              : missed
                                ? t('board.missedYesterdayLabel', { what: subject(title, day) })
                                : t('doseLog.notYetLabel', { what: subject(title, day) })
                        }
                        onClick={() => {
                          setEditing(null);
                          onToggle(slot, day);
                        }}
                      />
                      {onSkip && (status.state === 'due' || missed) && (
                        <button
                          type="button"
                          className={`${ghostButton} mt-1 min-h-9 px-2 py-1 text-sm`}
                          onClick={() => {
                            setEditing(null);
                            onSkip(slot, day);
                          }}
                          aria-label={t('doseLog.skipName', { what: whenOf(title, day) })}
                        >
                          {t('todo.skip')}
                        </button>
                      )}
                      {given && editing?.dose.id !== status.dose.id && (
                        <button
                          type="button"
                          className={`${ghostButton} mt-1 min-h-9 px-2 py-1 text-sm`}
                          onClick={() => setEditing({ dose: status.dose, time: toHhmm(status.at) })}
                          aria-label={t('doseLog.changeTimeOf', { what: whenOf(title, day) })}
                        >
                          {t('doseLog.changeTime')}
                        </button>
                      )}
                      {given && editing?.dose.id === status.dose.id && (
                        <form
                          className="mt-2 flex items-center gap-2"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const at = isHhmm(editing.time) ? slotAt(editing.time, day) : null;
                            if (at !== null && at <= now) onMove(editing.dose, at);
                            setEditing(null);
                          }}
                        >
                          <input
                            className={`${inputClass} min-w-0 flex-1`}
                            type="time"
                            value={editing.time}
                            onChange={(e) => setEditing({ ...editing, time: e.target.value })}
                            aria-label={day === today ? t('doseLog.timeGivenToday', { title }) : t('doseLog.timeGivenOn', { title, date: longDate(day, today) })}
                          />
                          <button type="submit" className={secondaryButton}>
                            {t('common.save')}
                          </button>
                        </form>
                      )}
                    </div>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ol>
    </Dialog>
  );
}
