import { useEffect, useRef, useState } from 'react';
import { localizeAgenda, removeAgenda, replaceAgenda, syncAgenda } from '@huishouden/pwa-kit/agenda';
import { localizeTodos, syncTodos } from '@huishouden/pwa-kit/todos';
import { addDays, toYmd } from '@huishouden/pwa-kit/time';
import { AGENDA_APP, agendaByRef, agendaChanges, type AgendaData } from '../lib/agenda';
import { todoItems } from '../lib/todos';
import { db } from './firebase';
import type { DataKey } from './types';

/** The lists the agenda is built from; all must have loaded before anything is published. */
export const AGENDA_SOURCES: readonly DataKey[] = ['pets', 'appointments', 'reminders', 'courses', 'medDoses', 'meals', 'feedings'];

const warn = (e: unknown) => console.warn("Couldn't update the household agenda", e);
const warnTodos = (e: unknown) => console.warn("Couldn't update the household to-do list", e);

/**
 * Keeps Pet's items on the household agenda (households/{id}/agenda) in step with its data. On open
 * and when the day turns: `syncAgenda` with everything, which repairs what another device or an older
 * version left, moves care reminders to overdue and replaces yesterday's meals and doses with today's and tomorrow's. After
 * changes settle (2 seconds, so a tick on a meal or a dose reaches the portal within seconds): `replaceAgenda` for each record whose items changed and `removeAgenda` for each one
 * that is gone. A failure never fails a save; the next open repairs it.
 *
 * The household to-do list (households/{id}/todos) follows the same timing: `syncTodos` with care
 * due today or overdue and today's doses not yet given or skipped, writing only what changed, so one
 * given or dismissed here or in the portal leaves the list within seconds.
 */
export function useAgendaSync(householdId: string, me: string, data: AgendaData, ready: boolean, restricted = false) {
  const written = useRef(new Map<string, string>());
  const syncedDay = useRef<string | null>(null);
  const day = useToday();

  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => {
      const now = Date.now();
      const today = toYmd(now);
      const wanted = agendaByRef(data, now);
      // Every language's words (localizeTodos, localizeAgenda), so the portal shows each member their own.
      localizeTodos(() => todoItems(data, now))
        .then((todos) => syncTodos(db, householdId, AGENDA_APP, todos, { by: me, now, restricted }))
        .catch(warnTodos);

      if (syncedDay.current !== today) {
        syncedDay.current = today;
        written.current = new Map([...wanted].map(([ref, items]) => [ref, JSON.stringify(items)]));
        const all = () => [...agendaByRef(data, now)].flatMap(([ref, list]) => list.map((i) => ({ ...i, ref })));
        localizeAgenda(all).then((items) => syncAgenda(db, householdId, AGENDA_APP, items, { by: me, now, restricted })).catch((e) => {
          syncedDay.current = null;
          written.current = new Map();
          warn(e);
        });
        return;
      }

      const { replace, remove } = agendaChanges(written.current, wanted);
      for (const [ref, , signature] of replace) {
        written.current.set(ref, signature);
        localizeAgenda(() => agendaByRef(data, now).get(ref) ?? [])
          .then((items) => replaceAgenda(db, householdId, AGENDA_APP, ref, items, { by: me, now, restricted }))
          .catch((e) => {
            written.current.delete(ref);
            warn(e);
          });
      }
      for (const ref of remove) {
        written.current.delete(ref);
        removeAgenda(db, householdId, AGENDA_APP, ref, { restricted }).catch(warn);
      }
    }, 2000);
    return () => clearTimeout(id);
  }, [householdId, me, restricted, ready, day, data.pets, data.appointments, data.reminders, data.courses, data.medDoses, data.meals, data.feedings]);
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
