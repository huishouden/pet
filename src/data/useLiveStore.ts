import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, onSnapshot, query, where, writeBatch, type Query } from 'firebase/firestore';
import { addContact, removeContactFromApp, restoreContact, updateContact, watchContacts } from '@huishouden/pwa-kit/contacts';
import { APP } from '../lib/contacts';
import { emptyData, type PetHouseholdData } from '../lib/demo';
import { DAY } from '../lib/time';
import { db } from './firebase';
import { createActions, type Backend } from './actions';
import { useReminderSync } from './reminderSync';
import { COLLECTIONS, type DataKey, type PetStore } from './types';

/** How far back dose history reads: a year of daily medication, and every monthly one. */
const DOSE_HISTORY_DAYS = 400;
/** The feeding history the Pets tab shows (14 days), plus a day of margin. */
const FEEDING_HISTORY_DAYS = 15;

/**
 * Live household data from Firestore with onSnapshot listeners. Writes are fire-and-forget: the
 * persistent cache applies them locally at once (also offline) and syncs later.
 */
export function useLiveStore(householdId: string, me: string, members: string[], onError: (message: string) => void): PetStore {
  const [data, setData] = useState<PetHouseholdData>(emptyData);
  const [answered, setAnswered] = useState({ pets: false, reminders: false });
  const dataRef = useRef(data);
  dataRef.current = data;
  const errorRef = useRef(onError);
  errorRef.current = onError;

  const base = `households/${householdId}`;

  useEffect(() => {
    const fail = (what: string) => (e: Error) => errorRef.current(readError(e, `Couldn't load ${what}`));
    const listen = (key: DataKey, q: Query, what: string) =>
      onSnapshot(
        q,
        (s) => {
          setData((d) => ({ ...d, [key]: s.docs.map((x) => ({ id: x.id, ...x.data() })) }));
          if (key === 'pets' || key === 'reminders') setAnswered((a) => ({ ...a, [key]: true }));
        },
        (e) => {
          if (key === 'pets' || key === 'reminders') setAnswered((a) => ({ ...a, [key]: true }));
          fail(what)(e);
        },
      );
    const col = (key: DataKey) => collection(db, base, COLLECTIONS[key]);
    const unsubs = [
      listen('pets', col('pets'), 'the pets'),
      listen('reminders', col('reminders'), 'the reminders'),
      listen('doses', query(col('doses'), where('at', '>=', Date.now() - DOSE_HISTORY_DAYS * DAY)), 'the dose history'),
      listen('appointments', col('appointments'), 'the appointments'),
      listen('weights', col('weights'), 'the weights'),
      listen('records', col('records'), 'the records'),
      listen('meals', col('meals'), 'the meals'),
      listen('courses', col('courses'), 'the medicine courses'),
      listen('medDoses', query(col('medDoses'), where('at', '>=', Date.now() - DOSE_HISTORY_DAYS * DAY)), 'the medicine log'),
      listen('feedings', query(col('feedings'), where('at', '>=', Date.now() - FEEDING_HISTORY_DAYS * DAY)), 'the feeding log'),
      watchContacts(db, householdId, (contacts) => setData((d) => ({ ...d, contacts })), { app: APP, onError: fail('the contacts') }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [base, householdId]);

  const actions = useMemo(() => {
    const report = (p: Promise<unknown>) => void p.catch((e) => errorRef.current(readError(e, "Couldn't save")));
    const backend: Backend = {
      me,
      now: () => Date.now(),
      read: () => dataRef.current,
      newId: (key) => doc(collection(db, base, COLLECTIONS[key])).id,
      write: (ops) => {
        const batch = writeBatch(db);
        for (const op of ops) {
          const ref = doc(db, base, COLLECTIONS[op.key], op.id);
          if (op.data) batch.set(ref, op.data);
          else batch.delete(ref);
        }
        report(batch.commit());
      },
      contacts: {
        save: (id, input) => report(id ? updateContact(db, householdId, id, input, me) : addContact(db, householdId, input, me)),
        // A contact other apps also show stays for them; Pet only stops showing it.
        remove: (c) => report(removeContactFromApp(db, householdId, c, APP, me)),
        restore: (c) => report(restoreContact(db, householdId, c)),
      },
    };
    return createActions(backend);
  }, [base, householdId, me]);

  const ready = answered.pets && answered.reminders;
  // Push notifications for doses and meal cut-offs, delivered by the household's shared sender.
  useReminderSync(householdId, me, data, ready, onError);

  return { data, ready, actions, members, me };
}

export function readError(e: unknown, prefix: string): string {
  const code = (e as { code?: string })?.code;
  if (code === 'permission-denied') return `${prefix}: this household doesn't allow it yet.`;
  if (code === 'unavailable') return `${prefix}: offline. It will retry when the connection is back.`;
  return `${prefix}.`;
}
