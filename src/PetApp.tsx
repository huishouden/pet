import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import type { Contact } from '@huishouden/pwa-kit/contacts';
import type { Appointment, Course, Feeding, Meal, Pet, PetRecord, Reminder } from './lib/model';
import { fedTodayFor, mealAt, mealsOf } from './lib/feeding';
import { givenOnFor, slotAt } from './lib/courses';
import { sortPets } from './lib/pets';
import { isRecurring, markGiven } from './lib/schedule';
import { addDays, formatDayShort, formatTime, longDate, parseYmd, shortDate, startOfDay, toYmd, type Ymd } from '@huishouden/pwa-kit/time';
import { useClock } from '@huishouden/pwa-kit/react/clock';
import type { PetStore } from './data/types';
import { CalendarSuggestions, calendarAvailable, useCalendarSuggestions } from '@huishouden/pwa-kit/react/calendar';
import { isImported, type CalendarMatch } from '@huishouden/pwa-kit/calendar';
import { PET_CALENDAR_QUERIES, fromCalendar } from './lib/calendarImport';
import { isBirthdayOf } from './lib/birthday';
import { auth } from './data/firebase';
import { Header, type Tab } from './components/Header';
import { Toast, type ToastState } from '@huishouden/pwa-kit/react/ui';
import { PetDialog } from './components/PetDialog';
import type { BirthdayGuess } from './lib/birthday';
import { ReminderDialog } from './components/ReminderDialog';
import { AppointmentDialog } from './components/AppointmentDialog';
import { WeightDialog } from './components/WeightDialog';
import { RecordDialog } from './components/RecordDialog';
import { ContactDialog } from '@huishouden/pwa-kit/react/contacts';
import { clearSharedPlace, readSharedPlace, type ParsedPlace } from '@huishouden/pwa-kit/places';
import { APP, ROLES } from './lib/contacts';
import { MealDialog } from './components/MealDialog';
import { FeedingDialog } from './components/FeedingDialog';
import { CourseDialog } from './components/CourseDialog';
import { DoseLogDialog } from './components/DoseLogDialog';
import { PetPhotos } from './components/PetAvatar';
import { ghostButton, secondaryButton } from '@huishouden/pwa-kit/react/ui';
import { Today } from './screens/Today';
import { Care } from './screens/Care';
import { Appointments } from './screens/Appointments';
import { Pets } from './screens/Pets';
import { Contacts } from './screens/Contacts';

export type TabId = 'today' | 'care' | 'appointments' | 'pets' | 'contacts';

const TABS: Tab[] = [
  { id: 'today', label: 'Today' },
  { id: 'care', label: 'Care' },
  { id: 'appointments', label: 'Appointments' },
  { id: 'pets', label: 'Pets' },
  { id: 'contacts', label: 'Contacts' },
];

interface Props {
  store: PetStore;
  user: User | null;
  onSignIn: () => void;
  onSignOut: () => void;
  signingIn: boolean;
  toast: ToastState | null;
  notify: (message: string, undo?: () => void) => void;
  clearToast: () => void;
  /** Shown above the content: the sample-data banner. */
  banner?: ReactNode;
  /** Per-device settings shown under Care: notifications, for a signed-in member. */
  deviceSettings?: ReactNode;
}

/** What the screens can ask the frame to open. */
export interface Open {
  tab: (id: TabId) => void;
  /** `birthday`: one found in the calendar without its year, to finish in the dialog. */
  pet: (pet: Pet | null, birthday?: BirthdayGuess) => void;
  reminder: (reminder: Reminder | null, petId?: string) => void;
  appointment: (appointment: Appointment | null, petId?: string) => void;
  weight: (petId: string) => void;
  record: (record: PetRecord | null, petId: string) => void;
  contact: (contact: Contact | null, role?: string) => void;
  meal: (meal: Meal | null, petId: string) => void;
  feeding: (feeding: Feeding | null, petId: string) => void;
  course: (course: Course | null, petId: string) => void;
  /** A course's doses day by day, to tick earlier days. */
  doseLog: (course: Course) => void;
  /** Shows one pet on the Pets tab. */
  showPet: (petId: string) => void;
}

/** Everything inside the frame once there is data to show (live or sample). */
export function PetApp({ store, user, onSignIn, onSignOut, signingIn, toast, notify, clearToast, banner, deviceSettings }: Props) {
  const { now, read } = useClock();
  // Opened from another app's Share menu (Google Maps → Share → Pet): a new contact, prefilled.
  const [shared] = useState(() => readSharedPlace(location));
  const [tab, setTab] = useState<TabId>(() => (shared ? 'contacts' : initialTab()));
  const [petDialog, setPetDialog] = useState<{ pet: Pet | null; birthday?: BirthdayGuess } | null>(null);
  const [reminder, setReminder] = useState<{ reminder: Reminder | null; petId?: string } | null>(null);
  const [appointment, setAppointment] = useState<{ appointment: Appointment | null; petId?: string } | null>(null);
  const [weightFor, setWeightFor] = useState<string | null>(null);
  const [record, setRecord] = useState<{ record: PetRecord | null; petId: string } | null>(null);
  const [contact, setContact] = useState<{ contact: Contact | null; role?: string; prefill?: ParsedPlace } | null>(() =>
    shared ? { contact: null, prefill: shared.place } : null,
  );
  const [shownPet, setShownPet] = useState<string | null>(() => new URLSearchParams(location.search).get('pet'));
  const [meal, setMeal] = useState<{ meal: Meal | null; petId: string } | null>(null);
  const [feeding, setFeeding] = useState<{ feeding: Feeding | null; petId: string } | null>(null);
  const [course, setCourse] = useState<{ course: Course | null; petId: string } | null>(null);
  const [doseLog, setDoseLog] = useState<string | null>(null);
  // A course saved with a start date in the past: offer to mark the doses already given.
  const [backfill, setBackfill] = useState<string | null>(null);
  const pets = useMemo(() => sortPets(store.data.pets), [store.data.pets]);
  const photos = useMemo(() => new Map(store.data.photos.map((p) => [p.id, p.data])), [store.data.photos]);
  const calendar = calendarAvailable(user);
  const { actions } = store;
  // Birthday events keep their own flow (Set birthday in Import from calendar), so they are never suggested as visits.
  const suggested = useCalendarSuggestions({
    auth,
    words: PET_CALENDAR_QUERIES,
    isImported: (m) => isImported(m, store.data.appointments) || pets.some((p) => isBirthdayOf(m.title, p.name)),
    app: 'Pet',
  });

  /** Calendar events in as appointments: Import from calendar and the new-in-your-calendar card. */
  const importEvents = (list: CalendarMatch[]) => {
    for (const m of list) actions.saveAppointment(null, fromCalendar(m, pets));
    notify(list.length === 1 ? `Added ${list[0].title}` : `Added ${list.length} appointments`);
  };

  useEffect(() => {
    document.title = 'Huishouden Pet';
  }, []);

  useEffect(() => {
    if (!shared) return;
    clearSharedPlace();
    chooseTab('contacts');
  }, [shared]);

  const chooseTab = (id: TabId) => {
    setTab(id);
    const url = new URL(location.href);
    if (id === 'today') url.searchParams.delete('tab');
    else url.searchParams.set('tab', id);
    history.replaceState(null, '', url);
  };

  const open: Open = {
    tab: chooseTab,
    pet: (pet, birthday) => setPetDialog({ pet, birthday }),
    reminder: (r, petId) => setReminder({ reminder: r, petId }),
    appointment: (a, petId) => setAppointment({ appointment: a, petId }),
    weight: (petId) => setWeightFor(petId),
    record: (r, petId) => setRecord({ record: r, petId }),
    contact: (c, role) => setContact({ contact: c, role }),
    meal: (m, petId) => setMeal({ meal: m, petId }),
    feeding: (f, petId) => setFeeding({ feeding: f, petId }),
    course: (c, petId) => setCourse({ course: c, petId }),
    doseLog: (c) => {
      setBackfill(null);
      setDoseLog(c.id);
    },
    showPet: (petId) => {
      setShownPet(petId);
      chooseTab('pets');
    },
  };

  const give = (r: Reminder) => {
    const dose = actions.giveDose(r, read());
    const pet = pets.find((p) => p.id === r.petId);
    const next = isRecurring(r) ? parseYmd(markGiven(r, dose.at).due) : null;
    const after = next === null ? '' : ` Next due ${formatDayShort(next)}.`;
    notify(`${r.title} given${pet ? ` to ${pet.name}` : ''}.${after}`, () => actions.undoDose(dose, r));
  };

  // "yesterday", or "on May 12" for an earlier day; nothing for today.
  const onDay = (day: Ymd) => {
    const today = toYmd(now);
    if (day === today) return '';
    return day === toYmd(addDays(startOfDay(now), -1)) ? ' yesterday' : ` on ${shortDate(day, today)}`;
  };

  // The board: a tap ticks a meal or a dose (now, by me); a tap on a ticked one un-ticks it. Both undo.
  // On an earlier day the tick is logged at the meal's or dose's own time that day.
  const toggleMeal = (pet: Pet, m: Meal, day: number = now) => {
    const at = read();
    const past = startOfDay(day) < startOfDay(at);
    const done = fedTodayFor(store.data.feedings, m.id, past ? day : at);
    const when = onDay(toYmd(day));
    if (done.length) {
      actions.deleteFeedings(done);
      notify(`${pet.name} ${m.name}${when}: not fed`, () => actions.restoreFeedings(done));
    } else {
      const f = actions.logFeeding({ petId: pet.id, mealId: m.id, at: past ? mealAt(m.time, day) : at, portion: m.portion });
      notify(`${pet.name} ${m.name}${when}: fed at ${formatTime(f.at)}`, () => actions.deleteFeedings([f]));
    }
  };
  const toggleDose = (pet: Pet | undefined, c: Course, slot: number, day?: Ymd) => {
    const at = read();
    const d = day ?? toYmd(at);
    const past = d < toYmd(at);
    const done = givenOnFor(store.data.medDoses, c.id, slot, d);
    const who = pet ? `${pet.name} ${c.name}` : c.name;
    if (done.length) {
      actions.deleteMedDoses(done);
      notify(`${who}${onDay(d)}: not given`, () => actions.restoreMedDoses(done));
    } else {
      const given = actions.giveMedDose(c, slot, past ? slotAt(c.times[slot], d) : at);
      notify(`${who}${onDay(d)}: given at ${formatTime(given.at)}`, () => actions.deleteMedDoses([given]));
    }
  };

  const backfillCourse = backfill ? store.data.courses.find((c) => c.id === backfill) : undefined;
  const logCourse = doseLog ? store.data.courses.find((c) => c.id === doseLog) : undefined;

  let content: ReactNode;
  if (!store.ready) content = <p className="p-2 text-lg text-stone-600">Loading the pets</p>;
  else if (tab === 'care') content = <Care store={store} pets={pets} open={open} onGive={give} notify={notify} deviceSettings={deviceSettings} />;
  else if (tab === 'appointments') content = <Appointments store={store} pets={pets} open={open} calendarAvailable={calendar} notify={notify} onImport={importEvents} />;
  else if (tab === 'pets') content = <Pets store={store} pets={pets} open={open} shown={shownPet} onShow={setShownPet} onGive={give} notify={notify} />;
  else if (tab === 'contacts') content = <Contacts store={store} open={open} notify={notify} />;
  else
    content = (
      <Today
        store={store}
        pets={pets}
        open={open}
        onGive={give}
        onToggleMeal={toggleMeal}
        onToggleDose={(pet, c, slot, day) => toggleDose(pet, c, slot, day)}
        afterNeeds={<CalendarSuggestions suggestions={suggested.suggestions} now={now} onAdd={(m) => importEvents([m])} onDismiss={suggested.dismiss} />}
      />
    );

  return (
    <PetPhotos.Provider value={photos}>
    <div className="flex min-h-dvh flex-col bg-cream font-sans text-stone-800 antialiased lg:h-dvh lg:overflow-hidden">
      <Header tabs={TABS} tab={tab} onTab={(id) => chooseTab(id as TabId)} user={user} onSignIn={onSignIn} onSignOut={onSignOut} signingIn={signingIn} />
      <main className="mx-auto flex w-full max-w-[1200px] min-h-0 flex-1 flex-col gap-4 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-6 sm:pb-6">
        {banner}
        {backfillCourse && (
          <div role="status" className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-stone-200 bg-white px-5 py-3 shadow-sm">
            <p className="min-w-0 flex-1 text-base text-stone-800">
              Started on {longDate(backfillCourse.startDate, toYmd(now))}. Mark the doses already given?
            </p>
            <button type="button" className={secondaryButton} onClick={() => open.doseLog(backfillCourse)}>
              Mark doses
            </button>
            <button type="button" className={ghostButton} onClick={() => setBackfill(null)}>
              Not now
            </button>
          </div>
        )}
        <div className="min-h-0 flex-1">{content}</div>
      </main>

      {petDialog && (
        <PetDialog
          pet={petDialog.pet}
          pets={pets}
          now={now}
          calendarAvailable={calendar}
          birthday={petDialog.birthday}
          onClose={() => setPetDialog(null)}
          onSave={(input, photo) => {
            const id = actions.savePet(petDialog.pet?.id ?? null, input);
            if (photo !== undefined) {
              const name = input.name.trim();
              const before = photo ? actions.savePetPhoto(id, photo) : actions.removePetPhoto(id);
              if (petDialog.pet) notify(photo ? `Saved ${name}'s photo` : `Removed ${name}'s photo`, () => actions.restorePetPhoto(id, before));
            }
            if (!petDialog.pet) {
              notify(`Added ${input.name.trim()}`);
              open.showPet(id);
            }
          }}
          onDelete={
            petDialog.pet
              ? () => {
                  const bundle = actions.removePet(petDialog.pet!);
                  if (shownPet === bundle.pet.id) setShownPet(null);
                  notify(`Removed ${bundle.pet.name}`, () => actions.restorePet(bundle));
                }
              : undefined
          }
        />
      )}
      {reminder && (
        <ReminderDialog
          reminder={reminder.reminder}
          petId={reminder.petId ?? reminder.reminder?.petId ?? pets[0]?.id}
          pets={pets}
          doses={store.data.doses}
          members={store.members}
          me={store.me}
          now={now}
          onClose={() => setReminder(null)}
          onSave={(input) => {
            actions.saveReminder(reminder.reminder?.id ?? null, input);
            if (!reminder.reminder) notify(`Added ${input.title.trim()}`);
          }}
          onDelete={
            reminder.reminder
              ? () => {
                  const gone = reminder.reminder!;
                  actions.deleteReminder(gone);
                  notify(`Deleted ${gone.title}`, () => actions.restoreReminder(gone));
                }
              : undefined
          }
        />
      )}
      {appointment && (
        <AppointmentDialog
          appointment={appointment.appointment}
          petId={appointment.petId}
          pets={pets}
          now={now}
          contacts={store.data.contacts}
          calendarAvailable={calendar}
          onClose={() => setAppointment(null)}
          onSave={(input) => {
            actions.saveAppointment(appointment.appointment?.id ?? null, input);
            if (!appointment.appointment) notify(`Added ${input.title.trim()}`);
          }}
          onDelete={
            appointment.appointment
              ? () => {
                  const gone = appointment.appointment!;
                  actions.deleteAppointment(gone);
                  notify(`Deleted ${gone.title}`, () => actions.restoreAppointment(gone));
                }
              : undefined
          }
        />
      )}
      {weightFor && (
        <WeightDialog
          pet={pets.find((p) => p.id === weightFor)}
          now={now}
          onClose={() => setWeightFor(null)}
          onSave={(input) => {
            const w = actions.logWeight(input);
            const pet = pets.find((p) => p.id === w.petId);
            notify(`Logged ${pet?.name ?? 'weight'}: ${w.value} ${w.unit}`, () => actions.deleteWeight(w));
          }}
        />
      )}
      {record && (
        <RecordDialog
          record={record.record}
          petId={record.petId}
          pets={pets}
          now={now}
          onClose={() => setRecord(null)}
          onSave={(input) => {
            actions.saveRecord(record.record?.id ?? null, input);
            if (!record.record) notify(`Added ${input.title.trim()}`);
          }}
          onDelete={
            record.record
              ? () => {
                  const gone = record.record!;
                  actions.deleteRecord(gone);
                  notify(`Deleted ${gone.title}`, () => actions.restoreRecord(gone));
                }
              : undefined
          }
        />
      )}
      {contact && (
        <ContactDialog
          contact={contact.contact}
          app={APP}
          roles={ROLES}
          role={contact.role}
          prefill={contact.prefill}
          searchPlaceholder="Clinic or business, and town"
          namePlaceholder="Example Vet Clinic"
          onClose={() => setContact(null)}
          onSave={(input) => {
            actions.saveContact(contact.contact?.id ?? null, input);
            if (!contact.contact) notify(`Added ${input.name}`);
          }}
          onDelete={
            contact.contact
              ? () => {
                  const gone = contact.contact!;
                  actions.deleteContact(gone);
                  notify(`Deleted ${gone.name}`, () => actions.restoreContact(gone));
                }
              : undefined
          }
        />
      )}
      {meal && (
        <MealDialog
          meal={meal.meal}
          pet={pets.find((p) => p.id === meal.petId)}
          onClose={() => setMeal(null)}
          onSave={(input) => {
            actions.saveMeal(meal.meal?.id ?? null, input);
            if (!meal.meal) notify(`Added ${input.name.trim()}`);
          }}
          onDelete={
            meal.meal
              ? () => {
                  const gone = meal.meal!;
                  actions.deleteMeal(gone);
                  notify(`Removed ${gone.name}`, () => actions.restoreMeal(gone));
                }
              : undefined
          }
        />
      )}
      {feeding && (
        <FeedingDialog
          feeding={feeding.feeding}
          pet={pets.find((p) => p.id === feeding.petId)}
          meals={mealsOf(store.data.meals, feeding.petId)}
          me={store.me}
          now={now}
          onClose={() => setFeeding(null)}
          onSave={(input) => {
            if (feeding.feeding) actions.updateFeeding(feeding.feeding, input);
            else {
              const f = actions.logFeeding(input);
              notify(`Logged a feed at ${formatTime(f.at)}`, () => actions.deleteFeedings([f]));
            }
          }}
          onDelete={
            feeding.feeding
              ? () => {
                  const gone = feeding.feeding!;
                  actions.deleteFeedings([gone]);
                  notify(`Deleted the feed at ${formatTime(gone.at)}`, () => actions.restoreFeedings([gone]));
                }
              : undefined
          }
        />
      )}
      {course && (
        <CourseDialog
          course={course.course}
          pet={pets.find((p) => p.id === course.petId)}
          meals={store.data.meals}
          now={now}
          onClose={() => setCourse(null)}
          onSave={(input) => {
            const id = actions.saveCourse(course.course?.id ?? null, input);
            if (!course.course) notify(`Added ${input.name.trim()}`);
            const startChanged = !course.course || course.course.startDate !== input.startDate;
            if (startChanged && input.startDate < toYmd(read())) setBackfill(id);
          }}
          onDelete={
            course.course
              ? () => {
                  const gone = course.course!;
                  actions.deleteCourse(gone);
                  notify(`Deleted ${gone.name}`, () => actions.restoreCourse(gone));
                }
              : undefined
          }
        />
      )}
      {logCourse && (
        <DoseLogDialog
          course={logCourse}
          pet={pets.find((p) => p.id === logCourse.petId)}
          meals={store.data.meals}
          medDoses={store.data.medDoses}
          me={store.me}
          now={now}
          onToggle={(slot, day) => toggleDose(pets.find((p) => p.id === logCourse.petId), logCourse, slot, day)}
          onMove={(d, at) => {
            actions.moveMedDose(d, at);
            notify(`${logCourse.name}${onDay(toYmd(at))}: given at ${formatTime(at)}`, () => actions.moveMedDose(d, d.at));
          }}
          onClose={() => setDoseLog(null)}
        />
      )}
      <Toast toast={toast} onDone={clearToast} />
    </div>
    </PetPhotos.Provider>
  );
}

function initialTab(): TabId {
  const t = new URLSearchParams(location.search).get('tab');
  return TABS.some((x) => x.id === t) ? (t as TabId) : 'today';
}

