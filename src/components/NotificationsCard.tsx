import { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import type { User } from 'firebase/auth';
import { disablePush, enablePush, pushEnabled, pushSupport } from '@huishouden/pwa-kit/push';
import { db } from '../data/firebase';
import { cardClass, overline, primaryButton, secondaryButton } from './ui';

/** The VAPID key the shared sender signs with; the toggle is hidden until the repo sets it. */
export const VAPID_PUBLIC_KEY: string = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '';

type State = { status: 'checking' } | { status: 'off' } | { status: 'on' } | { status: 'working' };

/**
 * "Notifications on this device": medicine doses and meals nobody has ticked, as notifications on
 * this phone or tablet for the signed-in member. Each person turns it on per device.
 */
export function NotificationsCard({ householdId, user }: { householdId: string; user: User }) {
  const support = pushSupport();
  const [state, setState] = useState<State>({ status: 'checking' });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    pushEnabled(db, householdId, user)
      .then((on) => live && setState({ status: on ? 'on' : 'off' }))
      .catch(() => live && setState({ status: 'off' }));
    return () => {
      live = false;
    };
  }, [householdId, user]);

  const turnOn = async () => {
    setError(null);
    setState({ status: 'working' });
    try {
      await enablePush(db, householdId, user, VAPID_PUBLIC_KEY, { app: 'pet' });
      setState({ status: 'on' });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't turn on notifications.");
      setState({ status: 'off' });
    }
  };

  const turnOff = async () => {
    setError(null);
    setState({ status: 'working' });
    try {
      await disablePush(db, householdId, user);
      setState({ status: 'off' });
    } catch {
      setError("Couldn't turn off notifications. Try again.");
      setState({ status: 'on' });
    }
  };

  return (
    <section className={`${cardClass} p-6`} aria-label="Notifications on this device">
      <h3 className={overline}>Notifications on this device</h3>
      {!support.supported ? (
        <p className="mt-2 text-base text-stone-600">{support.message}</p>
      ) : (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 flex-1 text-base text-stone-600">
            {state.status === 'on'
              ? 'On. This device tells you when a medicine dose is due and when a meal has not been ticked by its time.'
              : 'Get a notification here when a medicine dose is due or a meal has not been ticked by its time.'}
          </p>
          {state.status === 'on' ? (
            <button type="button" className={secondaryButton} onClick={() => void turnOff()}>
              <BellOff size={18} /> Turn off
            </button>
          ) : (
            <button type="button" className={primaryButton} disabled={state.status !== 'off'} onClick={() => void turnOn()}>
              <Bell size={18} /> {state.status === 'working' ? 'Asking the browser' : 'Turn on'}
            </button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-base text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
