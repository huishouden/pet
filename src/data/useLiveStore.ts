import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, getDocs, onSnapshot, query, where, type Query, type QuerySnapshot } from 'firebase/firestore';
import { commitOps } from '@huishouden/pwa-kit/firestore';
import { householdContacts, markUnflaggedOpen, watchContacts } from '@huishouden/pwa-kit/contacts';
import { can, householdRole, isRestricted, type Role } from '@huishouden/pwa-kit/roles';
import { readError } from '@huishouden/pwa-kit/feedback';
import { t } from '../i18n';
import { APP } from '../lib/contacts';
import { emptyData, type PetHouseholdData } from '../lib/demo';
import type { MedDose } from '../lib/model';
import { DAY } from '@huishouden/pwa-kit/time';
import { db } from './firebase';
import { createActions, type Backend } from './actions';
import { useReminderSync } from './reminderSync';
import { REMINDER_SOURCES } from '../lib/notify';
import { AGENDA_SOURCES, useAgendaSync } from './agendaSync';
import { COLLECTIONS, type DataKey, type PetStore } from './types';
import { logWindowStart } from '../lib/routines';
import { medDoseWindowStart } from '../lib/courses';

/** How far back the reminders' dose history reads: a year of every monthly one. */
const DOSE_HISTORY_DAYS = 400;
/** The feeding history the Pets tab shows (14 days), plus a day of margin. */
const FEEDING_HISTORY_DAYS = 15;

/** A query's documents with their ids. */
const entities = <T,>(s: QuerySnapshot): T[] => s.docs.map((x) => ({ id: x.id, ...x.data() }) as T);

/**
 * Live household data from Firestore with onSnapshot listeners. Writes are fire-and-forget: the
 * persistent cache applies them locally at once (also offline) and syncs later.
 */
export function useLiveStore(householdId: string, me: string, household: { members: string[]; roles?: Record<string, Role> }, onError: (message: string) => void): PetStore {
  const { members } = household;
  const role = householdRole(household, me);
  // Helpers and kids read only appointments and contacts not marked private, and must ask for just those.
  const restricted = isRestricted(role);
  const [data, setData] = useState<PetHouseholdData>(emptyData);
  // Which lists have answered once (from cache or server), error or not.
  const [answered, setAnswered] = useState<ReadonlySet<DataKey>>(() => new Set());
  const dataRef = useRef(data);
  dataRef.current = data;
  const errorRef = useRef(onError);
  errorRef.current = onError;

  const base = `households/${householdId}`;

  useEffect(() => {
    // i18n-dynamic: live.
    const fail = (key: DataKey | 'contacts') => (e: Error) => errorRef.current(readError(e, t(`live.${key}`)));
    const answer = (key: DataKey) => setAnswered((a) => (a.has(key) ? a : new Set(a).add(key)));
    const listen = (key: DataKey, q: Query) =>
      onSnapshot(
        q,
        (s) => {
          setData((d) => ({ ...d, [key]: entities(s) }));
          answer(key);
        },
        (e) => {
          answer(key);
          fail(key)(e);
        },
      );
    const col = (key: DataKey) => collection(db, base, COLLECTIONS[key]);
    const unsubs = [
      listen('pets', col('pets')),
      listen('reminders', col('reminders')),
      listen('doses', query(col('doses'), where('at', '>=', Date.now() - DOSE_HISTORY_DAYS * DAY))),
      listen('appointments', restricted ? query(col('appointments'), where('private', '==', false)) : col('appointments')),
      listen('weights', col('weights')),
      listen('records', col('records')),
      listen('meals', col('meals')),
      listen('courses', col('courses')),
      listen('photos', col('photos')),
      listen('feedings', query(col('feedings'), where('at', '>=', Date.now() - FEEDING_HISTORY_DAYS * DAY))),
      listen('outingPlans', col('outingPlans')),
      listen('routines', col('routines')),
      listen('outings', query(col('outings'), where('at', '>=', Date.now() - FEEDING_HISTORY_DAYS * DAY))),
      watchContacts(db, householdId, (contacts) => setData((d) => ({ ...d, contacts })), { app: APP, restricted, backfillPositions: true, onError: fail('contacts') }), // i18n-ignore: a key, not text
    ];
    return () => unsubs.forEach((u) => u());
  }, [base, householdId, restricted]);

  // Lists read from a window that hangs on other lists, once those are in; each listener starts
  // again only when its window's day moves. The course doses from `medDoseWindowStart` (the courses
  // running, to come or finished within a month); the routine logs from `logWindowStart` (the
  // slowest routine's history).
  const medDosesFrom = answered.has('courses') ? medDoseWindowStart(data.courses, Date.now()) : null;
  const logsFrom = answered.has('routines') ? logWindowStart(data.routines, Date.now()) : null;
  const listenFrom = (key: 'medDoses' | 'routineLogs', from: number | null) => {
    if (from === null) return;
    const answer = () => setAnswered((a) => (a.has(key) ? a : new Set(a).add(key)));
    return onSnapshot(
      query(collection(db, base, COLLECTIONS[key]), where('at', '>=', from)),
      (s) => {
        setData((d) => ({ ...d, [key]: entities(s) }));
        answer();
      },
      (e) => {
        answer();
        errorRef.current(readError(e, t(`live.${key}`))); // i18n-dynamic: live.
      },
    );
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => listenFrom('medDoses', medDosesFrom), [base, medDosesFrom]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => listenFrom('routineLogs', logsFrom), [base, logsFrom]);

  const watchCourseDoses = useCallback(
    (courseId: string, onChange: (doses: MedDose[]) => void) =>
      onSnapshot(
        query(collection(db, base, COLLECTIONS.medDoses), where('courseId', '==', courseId)),
        (s) => onChange(entities(s)),
        (e) => errorRef.current(readError(e, t('live.medDoses'))),
      ),
    [base],
  );

  // Appointments saved before the private flag are hidden from helpers and kids until written with
  // `private: false`; an admin's or member's device does that once.
  const seesPrivate = can(role, 'see-private');
  useEffect(() => {
    if (!seesPrivate || !data.appointments.some((a) => typeof a.private !== 'boolean')) return;
    markUnflaggedOpen(db, householdId, COLLECTIONS.appointments, data.appointments).catch(() => {});
  }, [householdId, seesPrivate, data.appointments]);

  const actions = useMemo(() => {
    const report = (p: Promise<unknown>) => void p.catch((e) => errorRef.current(readError(e, t('live.saveFailed'))));
    const backend: Backend = {
      me,
      now: () => Date.now(),
      read: () => dataRef.current,
      newId: (key) => doc(collection(db, base, COLLECTIONS[key])).id,
      write: (ops) => report(commitOps(db, base, ops, (key) => COLLECTIONS[key])),
      contacts: householdContacts(db, householdId, APP, me, report),
      allForPet: async (key, petId) => entities(await getDocs(query(collection(db, base, COLLECTIONS[key]), where('petId', '==', petId)))),
    };
    return createActions(backend);
  }, [base, householdId, me]);

  const ready = answered.has('pets') && answered.has('reminders');
  // What Pet publishes (push notifications for doses, meals, outings, birthdays and routines; the
  // household agenda and to-dos) waits for every list it is built from: publishing before one has
  // loaded would delete that list's items.
  useReminderSync(householdId, me, data, REMINDER_SOURCES.every((k) => answered.has(k)), onError, restricted, household);
  useAgendaSync(householdId, me, data, AGENDA_SOURCES.every((k) => answered.has(k)), restricted);

  return { data, ready, actions, members, me, role, household, medDosesFrom: medDosesFrom ?? Date.now(), watchCourseDoses };
}
