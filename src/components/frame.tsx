import { CalendarDays, Contact as ContactIcon, PawPrint, Pill, Sun } from 'lucide-react';
import type { User } from 'firebase/auth';
import { AppOpening, type AppFrameProps, type OpeningPhase } from '@huishouden/pwa-kit/react/frame';
import { trackView } from '@huishouden/pwa-kit/observability';
import type { Tab } from '@huishouden/pwa-kit/react/ui';
import { useUrlTab } from '@huishouden/pwa-kit/react/url-state';
import { PORTAL_URL } from '../lib/portal';
import { useT } from '../i18n';

export type TabId = 'today' | 'care' | 'appointments' | 'pets' | 'contacts';
export const TAB_IDS: readonly TabId[] = ['today', 'care', 'appointments', 'pets', 'contacts'];

// On phones Today, Care, Visits and Pets sit in the bottom bar; Contacts is under More.
export const tabs = (t: ReturnType<typeof useT>): Tab[] => [
  { id: 'today', label: t('tab.today'), icon: Sun, primary: true },
  { id: 'care', label: t('tab.care'), icon: Pill, primary: true },
  { id: 'appointments', label: t('tab.appointments'), short: t('tab.visits'), icon: CalendarDays, primary: true },
  { id: 'pets', label: t('tab.pets'), icon: PawPrint, primary: true },
  { id: 'contacts', label: t('tab.contacts'), icon: ContactIcon },
];

/** The tab on screen, in the address (`?tab=care`), so a reload and Back return to it. */
export const usePetTab = () => useUrlTab(TAB_IDS, 'today');

/** Who is signed in and the app bar's sign-in controls. `user` is undefined while the session restores. */
export interface Account {
  user: User | null | undefined;
  signingIn: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
}

const VERSION = `${import.meta.env.VITE_APP_VERSION} (${import.meta.env.VITE_BUILD_SHA})`;

/**
 * Pet's frame (the kit's `AppFrame`): the same props while the app opens and once it has loaded, so
 * nothing moves between them. Without `tab`, no tabs (a note outside the app's sections).
 */
export function petFrame(t: ReturnType<typeof useT>, account: Account, tab?: { id: TabId; choose: (id: TabId) => void }): AppFrameProps {
  return {
    app: t('app.name'),
    glyph: 'paw',
    portalUrl: PORTAL_URL,
    version: VERSION,
    ...account,
    onView: trackView,
    layout: 'fit',
    ...(tab && { tabs: tabs(t), tab: tab.id, onTab: (id: string) => tab.choose(id as TabId) }),
  };
}

/** The app while it opens: the kit's opening frame with Pet's tabs and the one in the address. */
export function PetOpening({ phase, ...account }: Account & { phase: OpeningPhase }) {
  const t = useT();
  const [tab, setTab] = usePetTab();
  return <AppOpening {...petFrame(t, account, { id: tab, choose: setTab })} phase={phase} />;
}
