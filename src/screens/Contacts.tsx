import { UserPlus } from 'lucide-react';
import { groupContacts, type Contact } from '@huishouden/pwa-kit/contacts';
import { ContactCard } from '@huishouden/pwa-kit/react/contacts';
import { ROLES, roleLabel } from '../lib/contacts';
import { useT } from '../i18n';
import { permissions } from '../lib/permissions';
import type { PetStore } from '../data/types';
import type { Open } from '../PetApp';
import { cardClass, primaryButton } from '@huishouden/pwa-kit/react/ui';

/** The pets' people: vet, emergency vet, groomer, boarding, one tap from a call or a map. */
export function Contacts({ store, open, notify }: { store: PetStore; open: Open; notify: (message: string, undo?: () => void) => void }) {
  const onAdd = () => open.contact(null);
  const onEdit = (c: Contact) => open.contact(c);
  const t = useT();
  const groups = groupContacts(store.data.contacts, ROLES, roleLabel);
  const perms = permissions(store.role, store.me);

  return (
    <div className="space-y-6 lg:h-full lg:overflow-y-auto">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold text-ink">{t('tab.contacts')}</h2>
        <button type="button" className={primaryButton} onClick={onAdd}>
          <UserPlus size={20} /> {t('contacts.add')}
        </button>
      </div>
      {groups.length === 0 && (
        <p className={`${cardClass} p-6 text-lg text-muted`}>{t('contacts.empty')}</p>
      )}
      <div className="grid items-start gap-6 md:grid-cols-2">
        {groups.flatMap((g) =>
          g.contacts.map((c) => (
            <ContactCard
              key={c.id}
              contact={c}
              role={roleLabel(g.role)}
              onEdit={perms.mayChange(c) ? () => onEdit(c) : undefined}
              onDelete={
                perms.mayChange(c)
                  ? () => {
                      store.actions.deleteContact(c);
                      notify(t('common.deleted', { name: c.name }), () => store.actions.restoreContact(c));
                    }
                  : undefined
              }
            />
          )),
        )}
      </div>
    </div>
  );
}
