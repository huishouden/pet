import { useState } from 'react';
import { Check, Pill } from 'lucide-react';
import type { Course, Meal, MedDose, Pet } from '../lib/model';
import { courseHistory, courseText, progress, slotAt, slotMealName } from '../lib/courses';
import { mealsOf } from '../lib/feeding';
import { formatClock } from '../lib/format';
import { personName } from '@huishouden/pwa-kit/people';
import { formatTime, longDate, toYmd, type Ymd, isHhmm, toHhmm } from '@huishouden/pwa-kit/time';
import { Dialog, ghostButton, inputClass, primaryButton, secondaryButton } from '@huishouden/pwa-kit/react/ui';
import { Tile } from './FeedingBoard';

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
  const [editing, setEditing] = useState<{ dose: MedDose; time: string } | null>(null);
  const history = courseHistory(course, medDoses, now);
  const p = progress(course, medDoses);
  const petMeals = mealsOf(meals, course.petId);
  const who = (email: string) => personName(email, { email: me });
  const today = toYmd(now);
  const name = pet?.name ?? 'the pet';

  return (
    <Dialog
      title={`${course.name}: doses by day`}
      onClose={onClose}
      footer={
        <button type="button" className={primaryButton} onClick={onClose}>
          Done
        </button>
      }
    >
      <p className="text-base text-stone-700">
        <span className="font-semibold text-forest-700">{courseText(course, now)}</span> · {p.given} of {p.total} doses given · {p.daysComplete} of {p.days} days complete
      </p>
      {history.length === 0 && <p className="mt-3 text-base text-stone-600">The course hasn't started yet.</p>}
      <ol className="mt-3" aria-label="Days">
        {history.map(({ day, n, doses, complete }) => {
          const dayWords = day === today ? 'Today' : longDate(day, today);
          return (
            <li key={day} className="border-b border-stone-200 py-3 last:border-b-0" aria-label={`Day ${n}, ${dayWords}`}>
              <p className="flex items-center gap-2 text-base font-semibold text-stone-800">
                Day {n} · {dayWords}
                {complete && (
                  <span className="flex items-center gap-1 text-sm font-medium text-forest-600">
                    <Check size={16} aria-hidden="true" /> All given
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
                  const when = day === today ? 'today' : `on ${longDate(day, today)}`;
                  return (
                    <div key={slot} className="min-w-0">
                      <Tile
                        done={given}
                        late={missed}
                        compact
                        icon={<Pill size={20} className="shrink-0" aria-hidden="true" />}
                        title={course.times.length > 1 ? slotName : 'Dose'}
                        detail={given ? `${formatTime(status.at)} · ${who(status.dose.by)}` : skipped ? `Skipped · ${who(status.dose.by)}` : missed ? 'Missed' : `by ${formatTime(status.at)}`}
                        label={
                          given
                            ? `${name} ${title} ${when}: given at ${formatTime(status.at)} by ${who(status.dose.by)}. Tap to undo.`
                            : skipped
                              ? `${name} ${title} ${when}: skipped by ${who(status.dose.by)}. Tap to undo.`
                              : `${name} ${title} ${when}: ${missed ? 'missed' : 'not yet'}. Tap if given.`
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
                          aria-label={`Skip ${title} ${when}`}
                        >
                          Skip
                        </button>
                      )}
                      {given && editing?.dose.id !== status.dose.id && (
                        <button
                          type="button"
                          className={`${ghostButton} mt-1 min-h-9 px-2 py-1 text-sm`}
                          onClick={() => setEditing({ dose: status.dose, time: toHhmm(status.at) })}
                          aria-label={`Change the time of ${title} ${when}`}
                        >
                          Change time
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
                            aria-label={`Time ${title} was given ${when}`}
                          />
                          <button type="submit" className={secondaryButton}>
                            Save
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
