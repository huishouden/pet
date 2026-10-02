import { useMemo, useRef, useState } from 'react';
import { cleanContact } from '@huishouden/pwa-kit/contacts';
import { DEMO_MEMBERS, demoData, type PetHouseholdData } from '../lib/demo';
import { applyOps, createActions, type Backend } from './actions';
import type { PetStore } from './types';

/**
 * Sample data kept in memory: the signed-out app is fully clickable, nothing is saved, and a reload
 * starts over. `clock` is the sample's moving "now" (a fixed 2031 start plus time since load).
 */
export function useDemoStore(clock: () => number): PetStore {
  const [data, setData] = useState<PetHouseholdData>(demoData);
  const dataRef = useRef(data);
  dataRef.current = data;
  const me = DEMO_MEMBERS[0];

  const actions = useMemo(() => {
    let seq = 0;
    const set = (next: PetHouseholdData) => {
      dataRef.current = next;
      setData(next);
    };
    const backend: Backend = {
      me,
      now: clock,
      read: () => dataRef.current,
      newId: (key) => `local-${key}-${Date.now()}-${seq++}`,
      write: (ops) => set(applyOps(dataRef.current, ops)),
      contacts: {
        save: (id, input) => {
          const d = dataRef.current;
          const existing = id ? d.contacts.find((c) => c.id === id) : undefined;
          const now = clock();
          const contact = { id: id ?? `local-contact-${seq++}`, ...cleanContact(input), createdAt: existing?.createdAt ?? now, ...(existing ? { updatedAt: now } : {}), by: me };
          set({ ...d, contacts: [...d.contacts.filter((c) => c.id !== contact.id), contact].sort((a, b) => a.name.localeCompare(b.name)) });
        },
        remove: (c) => set({ ...dataRef.current, contacts: dataRef.current.contacts.filter((x) => x.id !== c.id) }),
        restore: (c) => set({ ...dataRef.current, contacts: [...dataRef.current.contacts.filter((x) => x.id !== c.id), c] }),
      },
    };
    return createActions(backend);
  }, [clock, me]);

  return { data, ready: true, actions, members: DEMO_MEMBERS, me };
}
