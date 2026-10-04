import type { User } from 'firebase/auth';
import { NotificationsCard as KitNotificationsCard } from '@huishouden/pwa-kit/react/push';
import { db } from '../data/firebase';
import { useT } from '../i18n';

/** The VAPID key the shared sender signs with; the toggle is hidden until the repo sets it. */
export const VAPID_PUBLIC_KEY: string = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '';

/**
 * "Notifications on this device": medicine doses and meals nobody has ticked, as notifications on
 * this phone or tablet for the signed-in member. Each person turns it on per device. The kit's card,
 * which also keeps the device's subscription in the page's language, so reminders arrive in it.
 */
export function NotificationsCard({ householdId, user }: { householdId: string; user: User }) {
  const t = useT();
  return <KitNotificationsCard db={db} householdId={householdId} user={user} app="pet" vapidKey={VAPID_PUBLIC_KEY} offText={t('push.offText')} onText={t('push.onText')} />;
}
