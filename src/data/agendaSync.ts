import { useEffect, useRef, useState } from 'react';
import { removeAgenda, replaceAgenda, syncAgenda } from '@huishouden/pwa-kit/agenda';
import { addDays, toYmd } from '@huishouden/pwa-kit/time';
import { AGENDA_APP, agendaByRef, agendaChanges, type AgendaData } from '../lib/agenda';
import { db } from './firebase';
import type { DataKey } from './types';

/** The lists the agenda is built from; all must have loaded before anything is published. */
export const AGENDA_SOURCES: readonly DataKey[] = ['pets', 'appointments', 'reminders', 'courses', 'medDoses', 'meals', 'feedings'];

const warn = (e: unknown) => console.warn("Couldn't update the household agenda", e);

/**
 * Keeps Pet's items on the household agenda (households/{id}/agenda) in step with its data. On open
 * and when the day turns: `syncAgenda` with everything, which repairs what another device or an older
 * version left, moves care reminders to overdue and replaces yesterday's meals with today's. After
 * changes settle (2 seconds, so a tick on a meal or a dose reaches the portal within seconds): `replaceAgenda` for each record whose items changed and `removeAgenda` for each one
 * that is gone. A failure never fails a save; the next open repairs it.
 */
export function useAgendaSync(householdId: string, me: string, data: AgendaData, ready: boolean) {
  const written = useRef(new Map<string, string>());
  const syncedDay = useRef<string | null>(null);
  const day = useToday();

  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => {
      const now = Date.now();
      const today = toYmd(now);
      const wanted = agendaByRef(data, now);

      if (syncedDay.current !== today) {
        syncedDay.current = today;
        written.current = new Map([...wanted].map(([ref, items]) => [ref, JSON.stringify(items)]));
        const items = [...wanted].flatMap(([ref, list]) => list.map((i) => ({ ...i, ref })));
        syncAgenda(db, householdId, AGENDA_APP, items, { by: me, now }).catch((e) => {
          syncedDay.current = null;
          written.current = new Map();
          warn(e);
        });
        return;
      }

      const { replace, remove } = agendaChanges(written.current, wanted);
      for (const [ref, items, signature] of replace) {
        written.current.set(ref, signature);
        replaceAgenda(db, householdId, AGENDA_APP, ref, items, { by: me, now }).catch((e) => {
          written.current.delete(ref);
          warn(e);
        });
      }
      for (const ref of remove) {
        written.current.delete(ref);
        removeAgenda(db, householdId, AGENDA_APP, ref).catch(warn);
      }
    }, 2000);
    return () => clearTimeout(id);
  }, [householdId, me, ready, day, data.pets, data.appointments, data.reminders, data.courses, data.medDoses, data.meals, data.feedings]);
}

/** Today's date, changing at midnight and when the app comes back into view on a later day. */
function useToday(): string {
  const [day, setDay] = useState(() => toYmd(Date.now()));
  useEffect(() => {
    const check = () => setDay(toYmd(Date.now()));
    const id = setTimeout(check, addDays(Date.now(), 1) - Date.now() + 1000);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearTimeout(id);
      document.removeEventListener('visibilitychange', check);
    };
  }, [day]);
  return day;
}
