import { useEffect, useRef } from 'react';
import { cancelReminders, replaceReminders, type ReminderInput } from '@huishouden/pwa-kit/reminders';
import { courseRef, courseReminders, mealReminders, mealsRef } from '../lib/notify';
import { toYmd } from '@huishouden/pwa-kit/time';
import type { PetHouseholdData } from '../lib/demo';
import { db } from './firebase';

/**
 * Keeps the household's reminders for Pet in step with its data: each course's remaining doses
 * and each pet's untaken meal cut-offs. Runs when the app opens, after changes settle, and when the
 * day turns. Only refs whose reminders changed since the last write are rewritten, and refs whose
 * course or pet disappeared are cancelled.
 */
export function useReminderSync(householdId: string, me: string, data: PetHouseholdData, ready: boolean, onError: (message: string) => void) {
  const written = useRef(new Map<string, string>());
  const errorRef = useRef(onError);
  errorRef.current = onError;
  const day = toYmd(Date.now());

  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => {
      const now = Date.now();
      const wanted = new Map<string, ReminderInput[]>();
      for (const c of data.courses) wanted.set(courseRef(c.id), courseReminders(c, data.pets.find((p) => p.id === c.petId), data.medDoses, now));
      for (const p of data.pets) wanted.set(mealsRef(p.id), mealReminders(p, data.meals, data.feedings, now));
      const jobs: Promise<unknown>[] = [];
      for (const [ref, list] of wanted) {
        const signature = JSON.stringify(list.map((r) => [r.id, r.at, r.title, r.body]));
        if (written.current.get(ref) === signature) continue;
        written.current.set(ref, signature);
        jobs.push(
          replaceReminders(db, householdId, ref, list, me, now).catch((e) => {
            written.current.delete(ref);
            throw e;
          }),
        );
      }
      for (const ref of [...written.current.keys()]) {
        if (wanted.has(ref)) continue;
        written.current.delete(ref);
        jobs.push(cancelReminders(db, householdId, ref));
      }
      Promise.all(jobs).catch(() => errorRef.current("Couldn't update the notifications. They will catch up next time Pet opens."));
    }, 2000);
    return () => clearTimeout(id);
  }, [householdId, me, ready, day, data.courses, data.medDoses, data.pets, data.meals, data.feedings]);
}
