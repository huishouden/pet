import { useEffect, useRef } from 'react';
import { cancelReminders, localizeReminders, replaceReminders, type ReminderInput } from '@huishouden/pwa-kit/reminders';
import { t } from '../i18n';
import { birthdayRef, birthdayReminders, courseRef, courseReminders, mealReminders, mealsRef } from '../lib/notify';
import { toYmd } from '@huishouden/pwa-kit/time';
import type { PetHouseholdData } from '../lib/demo';
import { db } from './firebase';

/**
 * Keeps the household's reminders for Pet in step with its data: each course's remaining doses
 * each pet's untaken meal cut-offs, and each pet's next birthday. Runs when the app opens, after changes settle, and when the
 * day turns. Only refs whose reminders changed since the last write are rewritten, and refs whose
 * course or pet disappeared are cancelled.
 */
export function useReminderSync(householdId: string, me: string, data: PetHouseholdData, ready: boolean, onError: (message: string) => void, restricted = false) {
  const written = useRef(new Map<string, string>());
  const errorRef = useRef(onError);
  errorRef.current = onError;
  const day = toYmd(Date.now());

  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => {
      const now = Date.now();
      // Each ref's builder, run once per language when written (localizeReminders), so every
      // member's device is notified in its own language.
      const builders = new Map<string, () => ReminderInput[]>();
      for (const c of data.courses) builders.set(courseRef(c.id), () => courseReminders(c, data.pets.find((p) => p.id === c.petId), data.medDoses, now));
      for (const p of data.pets) builders.set(mealsRef(p.id), () => mealReminders(p, data.meals, data.feedings, now));
      // Every pet, so a birthday removed or made approximate since the last open has its reminder cancelled.
      for (const p of data.pets) builders.set(birthdayRef(p.id), () => birthdayReminders(p, now));
      const jobs: Promise<unknown>[] = [];
      for (const [ref, build] of builders) {
        const signature = JSON.stringify(build().map((r) => [r.id, r.at, r.title, r.body]));
        if (written.current.get(ref) === signature) continue;
        written.current.set(ref, signature);
        jobs.push(
          localizeReminders(build)
            .then((list) => replaceReminders(db, householdId, ref, list, me, now, { restricted }))
            .catch((e) => {
              written.current.delete(ref);
              throw e;
            }),
        );
      }
      for (const ref of [...written.current.keys()]) {
        if (builders.has(ref)) continue;
        written.current.delete(ref);
        jobs.push(cancelReminders(db, householdId, ref, { restricted }));
      }
      Promise.all(jobs).catch(() => errorRef.current(t('sync.notifications')));
    }, 2000);
    return () => clearTimeout(id);
  }, [householdId, me, restricted, ready, day, data.courses, data.medDoses, data.pets, data.meals, data.feedings]);
}
