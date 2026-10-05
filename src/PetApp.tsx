import { CalendarDays, Contact as ContactIcon, PawPrint, Pill, Sun } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { clearSharedImages, readSharedImages } from '@huishouden/pwa-kit/shared-images';
import { clearSharedContact, readSharedContact, type Contact, type ParsedContact } from '@huishouden/pwa-kit/contacts';
import type { Appointment, Course, Feeding, Meal, Outing, Pet, PetRecord, Reminder } from './lib/model';
import { outingWhat, type OutingSlot } from './lib/outings';
import { OutingDialog } from './components/OutingDialog';
import { OutingPlanDialog } from './components/OutingPlanDialog';
import { fedTodayFor, mealAt, mealsOf } from './lib/feeding';
import { givenOnFor, slotAt } from './lib/courses';
import { sortPets } from './lib/pets';
import { isRecurring, markGiven } from './lib/schedule';
import { addDays, atClock, formatDayShort, longDate, parseYmd, shortDate, startOfDay, toHhmm, toYmd, type Ymd } from '@huishouden/pwa-kit/time';
import { useClock } from '@huishouden/pwa-kit/react/clock';
import type { PetStore } from './data/types';
import { CalendarSuggestions, calendarAvailable, useCalendarSuggestions } from '@huishouden/pwa-kit/react/calendar';
import { isImported, type CalendarMatch } from '@huishouden/pwa-kit/calendar';
import { calendarWords, fromCalendar } from './lib/calendarImport';
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
import { APP, ROLES, roleLabel } from './lib/contacts';
import { useT } from './i18n';
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
import { courseRefusalText, permissions } from './lib/permissions';
import { helpersOf, refusal } from '@huishouden/pwa-kit/roles';
import { personName } from '@huishouden/pwa-kit/people';
import { formatWeight } from './lib/weight';

export type TabId = 'today' | 'care' | 'appointments' | 'pets' | 'contacts';

// On phones Today, Care, Visits and Pets sit in the bottom bar; Contacts is under More.
const tabs = (t: ReturnType<typeof useT>): Tab[] => [
  { id: 'today', label: t('tab.today'), icon: Sun, primary: true },
  { id: 'care', label: t('tab.care'), icon: Pill, primary: true },
  { id: 'appointments', label: t('tab.appointments'), short: t('tab.visits'), icon: CalendarDays, primary: true },
  { id: 'pets', label: t('tab.pets'), icon: PawPrint, primary: true },
  { id: 'contacts', label: t('tab.contacts'), icon: ContactIcon },
];
const TAB_IDS: readonly TabId[] = ['today', 'care', 'appointments', 'pets', 'contacts'];

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
  /** Logs an extra outing or a walk (`null`), or fixes one. */
  outing: (outing: Outing | null, petId: string) => void;
  /** A pet's outing plan: admins and members. */
  outingPlan: (petId: string) => void;
  /** Shows one pet on the Pets tab. */
  showPet: (petId: string) => void;
}

/** Everything inside the frame once there is data to show (live or sample). */
export function PetApp({ store, user, onSignIn, onSignOut, signingIn, toast, notify, clearToast, banner, deviceSettings }: Props) {
  const t = useT();
  const { now, read } = useClock();
  // Opened from another app's Share menu (Google Maps → Share → Pet): a new contact, prefilled.
  const [shared] = useState(() => readSharedPlace(location));
  const [tab, setTab] = useState<TabId>(() => (shared ? 'contacts' : initialTab()));
  const [petDialog, setPetDialog] = useState<{ pet: Pet | null; birthday?: BirthdayGuess } | null>(null);
  const [reminder, setReminder] = useState<{ reminder: Reminder | null; petId?: string } | null>(null);
  const [appointment, setAppointment] = useState<{ appointment: Appointment | null; petId?: string } | null>(null);
  const [weightFor, setWeightFor] = useState<string | null>(null);
  const [record, setRecord] = useState<{ record: PetRecord | null; petId: string } | null>(null);
  const [contact, setContact] = useState<{ contact: Contact | null; role?: string; prefill?: ParsedPlace; shared?: ParsedContact[] } | null>(() =>
    shared ? { contact: null, prefill: shared.place } : null,
  );
  const [shownPet, setShownPet] = useState<string | null>(() => new URLSearchParams(location.search).get('pet'));
  const [meal, setMeal] = useState<{ meal: Meal | null; petId: string } | null>(null);
  const [feeding, setFeeding] = useState<{ feeding: Feeding | null; petId: string } | null>(null);
  const [course, setCourse] = useState<{ course: Course | null; petId: string; images?: File[] } | null>(null);
  const [doseLog, setDoseLog] = useState<string | null>(null);
  const [outing, setOuting] = useState<{ outing: Outing | null; petId: string } | null>(null);
  const [planFor, setPlanFor] = useState<string | null>(null);
  // A course saved with a start date in the past: offer to mark the doses already given.
  const [backfill, setBackfill] = useState<string | null>(null);
  const pets = useMemo(() => sortPets(store.data.pets), [store.data.pets]);
  const photos = useMemo(() => new Map(store.data.photos.map((p) => [p.id, p.data])), [store.data.photos]);
  const calendar = calendarAvailable(user);
  const { actions } = store;
  const perms = useMemo(() => permissions(store.role, store.me), [store.role, store.me]);
  /** Opens a record's dialog, or says why not: helpers and kids change only what they added. */
  const editable = <T extends { by?: string }>(record: T | null, then: () => void) => {
    if (record && !perms.mayChange(record)) notify(refusal('edit-others'));
    else then();
  };
  // Birthday events keep their own flow (Set birthday in Import from calendar), so they are never suggested as visits.
  const suggested = useCalendarSuggestions({
    auth,
    words: calendarWords(),
    isImported: (m) => isImported(m, store.data.appointments) || pets.some((p) => isBirthdayOf(m.title, p.name)),
    app: 'Pet',
  });

  /** Calendar events in as appointments: Import from calendar and the new-in-your-calendar card. */
  const importEvents = (list: CalendarMatch[]) => {
    for (const m of list) actions.saveAppointment(null, fromCalendar(m, pets));
    notify(list.length === 1 ? t('common.added', { name: list[0].title }) : t('toast.addedAppointments', { count: list.length }));
  };

  useEffect(() => {
    document.title = t('app.documentTitle');
  }, [t]);

  // Opened from the Share menu with a contact card (Contacts → Share → Pet): a new contact, filled in.
  useEffect(() => {
    void readSharedContact().then((cards) => {
      if (!cards) return;
      clearSharedContact();
      chooseTab('contacts');
      setContact({ contact: null, shared: cards });
    });
  }, []);

  // Opened from the Share menu with a photo (Gallery → Share → Pet): Scan the label in a new course for the pet on screen.
  const [sharedImages, setSharedImages] = useState<File[] | null>(null);
  useEffect(() => {
    void readSharedImages().then((files) => {
      if (!files) return;
      clearSharedImages();
      if (files.length) setSharedImages(files);
    });
  }, []);
  useEffect(() => {
    if (!sharedImages) return;
    const pet = pets.find((p) => p.id === shownPet) ?? pets[0];
    if (!pet) return;
    setSharedImages(null);
    if (!perms.managesCourses) return notify(courseRefusalText());
    chooseTab('pets');
    setShownPet(pet.id);
    setCourse({ course: null, petId: pet.id, images: sharedImages });
  }, [sharedImages, pets, shownPet, perms.managesCourses]);

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
    pet: (pet, birthday) => editable(pet, () => setPetDialog({ pet, birthday })),
    reminder: (r, petId) => editable(r, () => setReminder({ reminder: r, petId })),
    appointment: (a, petId) => editable(a, () => setAppointment({ appointment: a, petId })),
    weight: (petId) => setWeightFor(petId),
    record: (r, petId) => editable(r, () => setRecord({ record: r, petId })),
    contact: (c, role) => editable(c, () => setContact({ contact: c, role })),
    meal: (m, petId) => editable(m, () => setMeal({ meal: m, petId })),
    feeding: (f, petId) => editable(f, () => setFeeding({ feeding: f, petId })),
    course: (c, petId) => (perms.managesCourses ? setCourse({ course: c, petId }) : notify(courseRefusalText())),
    doseLog: (c) => {
      setBackfill(null);
      setDoseLog(c.id);
    },
    outing: (o, petId) => editable(o, () => setOuting({ outing: o, petId })),
    outingPlan: (petId) => (perms.managesPlans ? setPlanFor(petId) : notify(refusal('change-settings'))),
    showPet: (petId) => {
      setShownPet(petId);
      chooseTab('pets');
    },
  };

  // An outing's two taps: Pooped or Pee only, now, by me, for that scheduled outing. Undo removes it.
  const logOuting = (pet: Pet, slot: OutingSlot, poop: boolean) => {
    const o = actions.logOuting({ petId: pet.id, slot: slot.key, at: read(), pee: true, poop });
    notify(t('toast.outing', { what: t('toast.petMeal', { pet: pet.name, meal: slot.label }), how: outingWhat(o), at: atTimeOf(o.at) }), () => actions.deleteOutings([o]));
  };
  const undoOuting = (o: Outing) => {
    if (!perms.mayChange(o)) return notify(refusal('edit-others'));
    const pet = pets.find((p) => p.id === o.petId);
    actions.deleteOutings([o]);
    notify(t('toast.outingRemoved', { name: pet?.name ?? '' }), () => actions.restoreOutings([o]));
  };

  const give = (r: Reminder) => {
    if (!perms.givesCare) return notify(refusal('give-medicine'));
    const dose = actions.giveDose(r, read());
    const pet = pets.find((p) => p.id === r.petId);
    const next = isRecurring(r) ? parseYmd(markGiven(r, dose.at).due) : null;
    const given = pet ? t('toast.givenTo', { title: r.title, pet: pet.name }) : t('toast.given', { title: r.title });
    notify(next === null ? given : t('toast.givenNext', { given, date: formatDayShort(next) }), () => actions.undoDose(dose, r));
  };

  // Dismiss stops a reminder coming due anywhere (Today, the agenda, the to-do list); it stays in the
  // care lists as Dismissed with Restore. Helpers and kids dismiss only what they added, as the rules.
  const dismiss = (r: Reminder) => {
    if (!perms.mayChange(r)) return notify(refusal('edit-others'));
    actions.dismissReminder(r);
    notify(t('toast.dismissed', { title: r.title }), () => actions.restoreReminder(r));
  };
  const undismiss = (r: Reminder) => {
    if (!perms.mayChange(r)) return notify(refusal('edit-others'));
    actions.undismissReminder(r);
    notify(t('toast.restored', { title: r.title }), () => actions.restoreReminder(r));
  };
  const reminderActions = { onGive: give, onRestore: (r: Reminder) => (perms.mayChange(r) ? () => undismiss(r) : undefined) };

  // "Biscuit AM", "Biscuit AM yesterday", "Biscuit AM on May 12": what a tick was, and on which day.
  const onDay = (who: string, day: Ymd) => {
    const today = toYmd(now);
    if (day === today) return who;
    return day === toYmd(addDays(startOfDay(now), -1)) ? t('toast.whoYesterday', { who }) : t('toast.whoOn', { who, date: shortDate(day, today) });
  };
  const atTimeOf = (at: number) => atClock(toHhmm(at));

  // The board: a tap ticks a meal or a dose (now, by me); a tap on a ticked one un-ticks it. Both undo.
  // On an earlier day the tick is logged at the meal's or dose's own time that day.
  const toggleMeal = (pet: Pet, m: Meal, day: number = now) => {
    const at = read();
    const past = startOfDay(day) < startOfDay(at);
    const done = fedTodayFor(store.data.feedings, m.id, past ? day : at);
    const what = onDay(t('toast.petMeal', { pet: pet.name, meal: m.name }), toYmd(day));
    if (done.some((f) => !perms.mayChange(f))) return notify(refusal('edit-others'));
    if (done.length) {
      actions.deleteFeedings(done);
      notify(t('toast.notFed', { what }), () => actions.restoreFeedings(done));
    } else {
      const f = actions.logFeeding({ petId: pet.id, mealId: m.id, at: past ? mealAt(m.time, day) : at, portion: m.portion });
      notify(t('toast.fedAt', { what, at: atTimeOf(f.at) }), () => actions.deleteFeedings([f]));
    }
  };
  const toggleDose = (pet: Pet | undefined, c: Course, slot: number, day?: Ymd) => {
    const at = read();
    const d = day ?? toYmd(at);
    const past = d < toYmd(at);
    const done = givenOnFor(store.data.medDoses, c.id, slot, d);
    const what = onDay(pet ? t('toast.petMeal', { pet: pet.name, meal: c.name }) : c.name, d);
    if (!perms.mayGiveCourse(c)) return notify(perms.courseRefusal(c));
    if (done.some((x) => !perms.mayChange(x))) return notify(refusal('edit-others'));
    if (done.length) {
      actions.deleteMedDoses(done);
      notify(done.every((x) => x.skipped) ? t('toast.notSkipped', { what }) : t('toast.notGiven', { what }), () => actions.restoreMedDoses(done));
    } else {
      const given = actions.giveMedDose(c, slot, past ? slotAt(c.times[slot], d) : at);
      notify(t('toast.givenAt', { what, at: atTimeOf(given.at) }), () => actions.deleteMedDoses([given]));
    }
  };

  // Skip: the dose is handled without being given (the vet said to leave it out), so it stops being due.
  const skipDose = (pet: Pet | undefined, c: Course, slot: number, day: Ymd) => {
    const at = read();
    if (!perms.mayGiveCourse(c)) return notify(perms.courseRefusal(c));
    if (givenOnFor(store.data.medDoses, c.id, slot, day).length) return;
    const what = onDay(pet ? t('toast.petMeal', { pet: pet.name, meal: c.name }) : c.name, day);
    const skipped = actions.skipMedDose(c, slot, day < toYmd(at) ? slotAt(c.times[slot], day) : at);
    notify(t('toast.skipped', { what }), () => actions.deleteMedDoses([skipped]));
  };

  const backfillCourse = backfill ? store.data.courses.find((c) => c.id === backfill) : undefined;
  const logCourse = doseLog ? store.data.courses.find((c) => c.id === doseLog) : undefined;

  let content: ReactNode;
  if (!store.ready) content = <p className="p-2 text-lg text-muted">{t('app.loading')}</p>;
  else if (tab === 'care') content = <Care store={store} pets={pets} open={open} {...reminderActions} notify={notify} deviceSettings={deviceSettings} />;
  else if (tab === 'appointments') content = <Appointments store={store} pets={pets} open={open} calendarAvailable={calendar} notify={notify} onImport={importEvents} />;
  else if (tab === 'pets') content = <Pets store={store} pets={pets} open={open} shown={shownPet} onShow={setShownPet} {...reminderActions} notify={notify} />;
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
        onLogOuting={logOuting}
        onUndoOuting={undoOuting}
        afterNeeds={<CalendarSuggestions suggestions={suggested.suggestions} now={now} onAdd={(m) => importEvents([m])} onDismiss={suggested.dismiss} />}
      />
    );

  return (
    <PetPhotos.Provider value={photos}>
    <div className="flex min-h-dvh flex-col bg-page font-sans text-ink antialiased lg:h-dvh lg:overflow-hidden">
      <Header tabs={tabs(t)} tab={tab} onTab={(id) => chooseTab(id as TabId)} user={user} onSignIn={onSignIn} onSignOut={onSignOut} signingIn={signingIn} />
      <main className="mx-auto flex w-full max-w-[1200px] min-h-0 flex-1 flex-col gap-4 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-6 sm:pb-6">
        {banner}
        {backfillCourse && (
          <div role="status" className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-line bg-surface px-5 py-3 shadow-sm">
            <p className="min-w-0 flex-1 text-base text-ink">{t('backfill.text', { date: longDate(backfillCourse.startDate, toYmd(now)) })}</p>
            <button type="button" className={secondaryButton} onClick={() => open.doseLog(backfillCourse)}>
              {t('backfill.mark')}
            </button>
            <button type="button" className={ghostButton} onClick={() => setBackfill(null)}>
              {t('backfill.notNow')}
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
              if (petDialog.pet) notify(photo ? t('toast.photoSaved', { name }) : t('toast.photoRemoved', { name }), () => actions.restorePetPhoto(id, before));
            }
            if (!petDialog.pet) {
              notify(t('common.added', { name: input.name.trim() }));
              open.showPet(id);
            }
          }}
          onDelete={
            petDialog.pet && perms.mayChange(petDialog.pet)
              ? () => {
                  const bundle = actions.removePet(petDialog.pet!);
                  if (shownPet === bundle.pet.id) setShownPet(null);
                  notify(t('toast.removed', { name: bundle.pet.name }), () => actions.restorePet(bundle));
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
            if (!reminder.reminder) notify(t('common.added', { name: input.title.trim() }));
          }}
          onDismiss={reminder.reminder ? () => dismiss(reminder.reminder!) : undefined}
          onRestore={reminder.reminder ? () => undismiss(reminder.reminder!) : undefined}
          onDelete={
            reminder.reminder
              ? () => {
                  const gone = reminder.reminder!;
                  actions.deleteReminder(gone);
                  notify(t('common.deleted', { name: gone.title }), () => actions.restoreReminder(gone));
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
          canMarkPrivate={perms.seesPrivate}
          onClose={() => setAppointment(null)}
          onSave={(input) => {
            actions.saveAppointment(appointment.appointment?.id ?? null, input);
            if (!appointment.appointment) notify(t('common.added', { name: input.title.trim() }));
          }}
          onDelete={
            appointment.appointment
              ? () => {
                  const gone = appointment.appointment!;
                  actions.deleteAppointment(gone);
                  notify(t('common.deleted', { name: gone.title }), () => actions.restoreAppointment(gone));
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
            notify(pet ? t('toast.weightLogged', { name: pet.name, weight: formatWeight(w.value, w.unit) }) : t('toast.weightLoggedNoPet', { weight: formatWeight(w.value, w.unit) }), () => actions.deleteWeight(w));
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
            if (!record.record) notify(t('common.added', { name: input.title.trim() }));
          }}
          onDelete={
            record.record
              ? () => {
                  const gone = record.record!;
                  actions.deleteRecord(gone);
                  notify(t('common.deleted', { name: gone.title }), () => actions.restoreRecord(gone));
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
          sharedContacts={contact.shared}
          auth={auth}
          roleLabel={roleLabel}
          searchPlaceholder={t('contacts.searchPlaceholder')}
          namePlaceholder={t('contacts.namePlaceholder')}
          canMarkPrivate={perms.seesPrivate}
          onClose={() => setContact(null)}
          onSave={(input) => {
            actions.saveContact(contact.contact?.id ?? null, input);
            if (!contact.contact) notify(t('common.added', { name: input.name }));
          }}
          onDelete={
            contact.contact
              ? () => {
                  const gone = contact.contact!;
                  actions.deleteContact(gone);
                  notify(t('common.deleted', { name: gone.name }), () => actions.restoreContact(gone));
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
            if (!meal.meal) notify(t('common.added', { name: input.name.trim() }));
          }}
          onDelete={
            meal.meal
              ? () => {
                  const gone = meal.meal!;
                  actions.deleteMeal(gone);
                  notify(t('toast.removed', { name: gone.name }), () => actions.restoreMeal(gone));
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
              notify(t('toast.feedLogged', { at: atTimeOf(f.at) }), () => actions.deleteFeedings([f]));
            }
          }}
          onDelete={
            feeding.feeding
              ? () => {
                  const gone = feeding.feeding!;
                  actions.deleteFeedings([gone]);
                  notify(t('toast.feedDeleted', { at: atTimeOf(gone.at) }), () => actions.restoreFeedings([gone]));
                }
              : undefined
          }
        />
      )}
      {outing && (
        <OutingDialog
          outing={outing.outing}
          pet={pets.find((p) => p.id === outing.petId)}
          now={now}
          onClose={() => setOuting(null)}
          onSave={(input) => {
            if (outing.outing) actions.updateOuting(outing.outing, input);
            else {
              const o = actions.logOuting(input);
              notify(t('toast.outingLogged', { how: outingWhat(o), at: atTimeOf(o.at) }), () => actions.deleteOutings([o]));
            }
          }}
          onDelete={
            outing.outing
              ? () => {
                  const gone = outing.outing!;
                  actions.deleteOutings([gone]);
                  notify(t('toast.outingDeleted', { at: atTimeOf(gone.at) }), () => actions.restoreOutings([gone]));
                }
              : undefined
          }
        />
      )}
      {planFor && pets.some((p) => p.id === planFor) && (
        <OutingPlanDialog
          plan={store.data.outingPlans.find((p) => p.id === planFor)}
          pet={pets.find((p) => p.id === planFor)!}
          meals={store.data.meals}
          onClose={() => setPlanFor(null)}
          onSave={(input) => {
            const pet = pets.find((p) => p.id === planFor)!;
            const before = actions.saveOutingPlan(planFor, input);
            notify(input.on ? t('toast.planSaved', { name: pet.name }) : t('toast.planOff', { name: pet.name }), () => actions.restoreOutingPlan(planFor, before));
          }}
        />
      )}
      {course && (
        <CourseDialog
          course={course.course}
          pet={pets.find((p) => p.id === course.petId)}
          meals={store.data.meals}
          now={now}
          images={course.images}
          helpers={helpersOf(store.household)}
          nameOf={(email) => personName(email)}
          onClose={() => setCourse(null)}
          onSave={(input) => {
            const id = actions.saveCourse(course.course?.id ?? null, input);
            if (!course.course) notify(t('common.added', { name: input.name.trim() }));
            const startChanged = !course.course || course.course.startDate !== input.startDate;
            if (startChanged && input.startDate < toYmd(read())) setBackfill(id);
          }}
          onDelete={
            course.course
              ? () => {
                  const gone = course.course!;
                  actions.deleteCourse(gone);
                  notify(t('common.deleted', { name: gone.name }), () => actions.restoreCourse(gone));
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
          onSkip={perms.mayGiveCourse(logCourse) ? (slot, day) => skipDose(pets.find((p) => p.id === logCourse.petId), logCourse, slot, day) : undefined}
          onMove={(d, at) => {
            actions.moveMedDose(d, at);
            notify(t('toast.givenAt', { what: onDay(logCourse.name, toYmd(at)), at: atTimeOf(at) }), () => actions.moveMedDose(d, d.at));
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
  return TAB_IDS.some((x) => x === t) ? (t as TabId) : 'today';
}

