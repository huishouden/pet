import { useEffect, useRef } from 'react';
import { t } from '../i18n';
import { householdRole, type Role } from '@huishouden/pwa-kit/roles';
import { toYmd } from '@huishouden/pwa-kit/time';
import type { PetHouseholdData } from '../lib/demo';
import { db } from './firebase';
import { publishReminders } from './publish';

/**
 * Keeps the household's reminders for Pet in step with its data (`publishReminders`): each course's
 * remaining doses, each pet's untaken meal cut-offs, outings and next birthday, and each care
 * routine's due days. Runs when the app opens, after changes settle, and when the day turns: one
 * query of Pet's reminders, none when this device published the same a short while ago, and only
 * what changed is written; a course or pet that is gone has its reminders removed.
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
  const day = toYmd(Date.now());

  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => {
      publishReminders(db, householdId, me, data, Date.now(), outers, { restricted }).catch(() => errorRef.current(t('sync.notifications')));
    }, 2000);
    return () => clearTimeout(id);
  }, [householdId, me, restricted, ready, day, data.courses, data.medDoses, data.pets, data.meals, data.feedings, data.outingPlans, data.outings, data.routines, data.routineLogs, outersKey]);
}
