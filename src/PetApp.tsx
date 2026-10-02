import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import type { Contact } from '@huishouden/pwa-kit/contacts';
import type { Appointment, Course, Feeding, Meal, Pet, PetRecord, Reminder } from './lib/model';
import { fedTodayFor, mealsOf } from './lib/feeding';
import { givenTodayFor } from './lib/courses';
import { sortPets } from './lib/pets';
import { isRecurring, markGiven } from './lib/schedule';
import { parseYmd } from './lib/time';
import { formatDayShort, formatTime } from './lib/format';
import { useClock } from './clock';
import type { PetStore } from './data/types';
import { calendarAvailable } from './data/calendar';
import { Header, type Tab } from './components/Header';
import { Toast, type ToastState } from './components/ui';
import { PetDialog } from './components/PetDialog';
import { ReminderDialog } from './components/ReminderDialog';
import { AppointmentDialog } from './components/AppointmentDialog';
import { WeightDialog } from './components/WeightDialog';
import { RecordDialog } from './components/RecordDialog';
import { ContactDialog } from './components/ContactDialog';
import { MealDialog } from './components/MealDialog';
import { FeedingDialog } from './components/FeedingDialog';
import { CourseDialog } from './components/CourseDialog';
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
  pet: (pet: Pet | null) => void;
  reminder: (reminder: Reminder | null, petId?: string) => void;
  appointment: (appointment: Appointment | null, petId?: string) => void;
  weight: (petId: string) => void;
  record: (record: PetRecord | null, petId: string) => void;
  contact: (contact: Contact | null, role?: string) => void;
  meal: (meal: Meal | null, petId: string) => void;
  feeding: (feeding: Feeding | null, petId: string) => void;
  course: (course: Course | null, petId: string) => void;
  /** Shows one pet on the Pets tab. */
  showPet: (petId: string) => void;
}

/** Everything inside the frame once there is data to show (live or sample). */
export function PetApp({ store, user, onSignIn, onSignOut, signingIn, toast, notify, clearToast, banner, deviceSettings }: Props) {
  const { now, read } = useClock();
  const [tab, setTab] = useState<TabId>(() => initialTab());
  const [petDialog, setPetDialog] = useState<{ pet: Pet | null } | null>(null);
  const [reminder, setReminder] = useState<{ reminder: Reminder | null; petId?: string } | null>(null);
  const [appointment, setAppointment] = useState<{ appointment: Appointment | null; petId?: string } | null>(null);
  const [weightFor, setWeightFor] = useState<string | null>(null);
  const [record, setRecord] = useState<{ record: PetRecord | null; petId: string } | null>(null);
  const [contact, setContact] = useState<{ contact: Contact | null; role?: string } | null>(null);
  const [shownPet, setShownPet] = useState<string | null>(() => new URLSearchParams(location.search).get('pet'));
  const [meal, setMeal] = useState<{ meal: Meal | null; petId: string } | null>(null);
  const [feeding, setFeeding] = useState<{ feeding: Feeding | null; petId: string } | null>(null);
  const [course, setCourse] = useState<{ course: Course | null; petId: string } | null>(null);
  const pets = useMemo(() => sortPets(store.data.pets), [store.data.pets]);
  const calendar = calendarAvailable(user);
  const { actions } = store;

  useEffect(() => {
    document.title = 'Huishouden Pet';
  }, []);

  const chooseTab = (id: TabId) => {
    setTab(id);
    const url = new URL(location.href);
    if (id === 'today') url.searchParams.delete('tab');
    else url.searchParams.set('tab', id);
    history.replaceState(null, '', url);
  };

  const open: Open = {
    tab: chooseTab,
    pet: (pet) => setPetDialog({ pet }),
    reminder: (r, petId) => setReminder({ reminder: r, petId }),
    appointment: (a, petId) => setAppointment({ appointment: a, petId }),
    weight: (petId) => setWeightFor(petId),
    record: (r, petId) => setRecord({ record: r, petId }),
    contact: (c, role) => setContact({ contact: c, role }),
    meal: (m, petId) => setMeal({ meal: m, petId }),
    feeding: (f, petId) => setFeeding({ feeding: f, petId }),
    course: (c, petId) => setCourse({ course: c, petId }),
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

  // The board: a tap ticks a meal or a dose (now, by me); a tap on a ticked one un-ticks it. Both undo.
  const toggleMeal = (pet: Pet, m: Meal) => {
    const at = read();
    const done = fedTodayFor(store.data.feedings, m.id, at);
    if (done.length) {
      actions.deleteFeedings(done);
      notify(`${pet.name} ${m.name}: not fed`, () => actions.restoreFeedings(done));
    } else {
      const f = actions.logFeeding({ petId: pet.id, mealId: m.id, at, portion: m.portion });
      notify(`${pet.name} ${m.name}: fed at ${formatTime(f.at)}`, () => actions.deleteFeedings([f]));
    }
  };
  const toggleDose = (pet: Pet, c: Course, slot: number) => {
    const at = read();
    const done = givenTodayFor(store.data.medDoses, c.id, slot, at);
    if (done.length) {
      actions.deleteMedDoses(done);
      notify(`${pet.name} ${c.name}: not given`, () => actions.restoreMedDoses(done));
    } else {
      const d = actions.giveMedDose(c, slot, at);
      notify(`${pet.name} ${c.name}: given at ${formatTime(d.at)}`, () => actions.deleteMedDoses([d]));
    }
  };

  let content: ReactNode;
  if (!store.ready) content = <p className="p-2 text-lg text-stone-600">Loading the pets</p>;
  else if (tab === 'care') content = <Care store={store} pets={pets} open={open} onGive={give} notify={notify} deviceSettings={deviceSettings} />;
  else if (tab === 'appointments') content = <Appointments store={store} pets={pets} open={open} calendarAvailable={calendar} notify={notify} />;
  else if (tab === 'pets') content = <Pets store={store} pets={pets} open={open} shown={shownPet} onShow={setShownPet} onGive={give} notify={notify} />;
  else if (tab === 'contacts') content = <Contacts store={store} open={open} notify={notify} />;
  else content = <Today store={store} pets={pets} open={open} onGive={give} onToggleMeal={toggleMeal} onToggleDose={toggleDose} />;

  return (
    <div className="flex min-h-dvh flex-col bg-cream font-sans text-stone-800 antialiased lg:h-dvh lg:overflow-hidden">
      <Header tabs={TABS} tab={tab} onTab={(id) => chooseTab(id as TabId)} user={user} onSignIn={onSignIn} onSignOut={onSignOut} signingIn={signingIn} />
      <main className="mx-auto flex w-full max-w-[1200px] min-h-0 flex-1 flex-col gap-4 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-6 sm:pb-6">
        {banner}
        <div className="min-h-0 flex-1">{content}</div>
      </main>

      {petDialog && (
        <PetDialog
          pet={petDialog.pet}
          now={now}
          onClose={() => setPetDialog(null)}
          onSave={(input) => {
            const id = actions.savePet(petDialog.pet?.id ?? null, input);
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
          role={contact.role}
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
            actions.saveCourse(course.course?.id ?? null, input);
            if (!course.course) notify(`Added ${input.name.trim()}`);
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
      <Toast toast={toast} onDone={clearToast} />
    </div>
  );
}

function initialTab(): TabId {
  const t = new URLSearchParams(location.search).get('tab');
  return TABS.some((x) => x.id === t) ? (t as TabId) : 'today';
}

