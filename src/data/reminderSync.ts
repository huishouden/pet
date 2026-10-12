import { useEffect, useRef } from 'react';
import { t } from '../i18n';
import { householdRole, type Role } from '@huishouden/pwa-kit/roles';
import { toYmd } from '@huishouden/pwa-kit/time';
import type { PetHouseholdData } from '../lib/demo';
import { db } from './firebase';
import { publishReminderChanges, publishReminders, reminderSignatures } from './publish';

/**
 * Keeps the household's reminders for Pet in step with its data (`publishReminders`): each course's
 * remaining doses, each pet's untaken meal cut-offs, outings and next birthday, and each care
 * routine's due days. On open and when the day turns, all of them (`publishReminders`: one query of
 * Pet's reminders, none when this device published the same a short while ago); after a change
 * settles, only the records whose reminders changed (`publishReminderChanges`: one query each), and
 * a course, pet or routine that is gone has its reminders cancelled.
 */
export function useReminderSync(
  householdId: string,
  me: string,
  data: PetHouseholdData,
  ready: boolean,
  onError: (message: string) => void,
  restricted = false,
  household: { members: string[]; roles?: Record<string, Role> } = { members: [] },
) {
  // Outing reminders go to whoever may take a pet out: everyone but kids.
  const outers = household.members.map((m) => m.toLowerCase()).filter((m) => householdRole(household, m) !== 'kid');
  const outersKey = outers.join(',');
  const errorRef = useRef(onError);
  errorRef.current = onError;
  const written = useRef(new Map<string, string>());
  const syncedDay = useRef<string | null>(null);
  const day = toYmd(Date.now());

  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => {
      const now = Date.now();
      const today = toYmd(now);
      const failed = () => errorRef.current(t('sync.notifications'));
      // On open and when the day turns: all of Pet's reminders, in one query.
      if (syncedDay.current !== today) {
        syncedDay.current = today;
        written.current = reminderSignatures(data, now, outers);
        publishReminders(db, householdId, me, data, now, outers, { restricted }).catch(() => {
          syncedDay.current = null;
          written.current = new Map();
          failed();
        });
        return;
      }
      // After a change: only the records whose reminders changed, one query each.
      publishReminderChanges(db, householdId, me, written.current, data, now, outers, { restricted }).then((r) => r.failed && failed());
    }, 2000);
    return () => clearTimeout(id);
  }, [householdId, me, restricted, ready, day, data.courses, data.medDoses, data.pets, data.meals, data.feedings, data.outingPlans, data.outings, data.routines, data.routineLogs, outersKey]);
}
