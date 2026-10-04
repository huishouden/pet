import { useEffect, useMemo, useState } from 'react';
import { setHome } from '@huishouden/pwa-kit/home';
import { sampleContacts } from '@huishouden/pwa-kit/contacts';
import { localIds } from '@huishouden/pwa-kit/store';
import { useSampleStore } from '@huishouden/pwa-kit/react/store';
import { DEMO_HELPER, DEMO_HOME, DEMO_MEMBERS, demoData, type PetHouseholdData, demoRole } from '../lib/demo';
import { createActions, type Backend } from './actions';
import type { DataKey, PetStore } from './types';

/**
 * Sample data kept in memory: the signed-out app is fully clickable, nothing is saved, and a reload
 * starts over. `clock` is the sample's moving "now" (a fixed 2031 start plus time since load).
 */
export function useDemoStore(clock: () => number): PetStore {
  const { data, read, patch, backend: memory } = useSampleStore<PetHouseholdData, DataKey>(demoData);
  // `?as=helper` or `?as=kid` shows the sample as the household's helper, Jo, would see it.
  const [role] = useState(() => demoRole(location.search));
  const me = role === 'admin' ? DEMO_MEMBERS[0] : DEMO_HELPER;
  // The sample's own home while it shows, so distances read as they would at home; gone on sign-in.
  useEffect(() => {
    setHome(DEMO_HOME);
    return () => setHome(undefined);
  }, []);
  const household = useMemo(() => ({ members: [...DEMO_MEMBERS, DEMO_HELPER], roles: { [DEMO_HELPER]: role === 'kid' ? ('kid' as const) : ('helper' as const) } }), [role]);

  const actions = useMemo(() => {
    const backend: Backend = {
      ...memory,
      me,
      now: clock,
      read,
      contacts: sampleContacts(() => read().contacts, (contacts) => patch((d) => ({ ...d, contacts })), { by: me, now: clock, newId: localIds() }),
    };
    return createActions(backend);
  }, [clock, me, memory, patch, read]);

  return { data, ready: true, actions, members: DEMO_MEMBERS, me, role, household };
}
