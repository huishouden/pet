import { useState } from 'react';
import { Cake, CalendarArrowDown, CalendarPlus, ChevronDown, ChevronUp, ExternalLink, MapPin, Pencil, Phone, UserRound } from 'lucide-react';
import type { Contact } from '@huishouden/pwa-kit/contacts';
import { telHref } from '@huishouden/pwa-kit/places';
import type { Appointment, Pet } from '../lib/model';
import { PET_CALENDAR_QUERIES, fromCalendar } from '../lib/calendarImport';
import { APPOINTMENT_LABELS } from '../lib/care';
import { petNames } from '../lib/pets';
import { formatDayLong, formatTime, monthShort, relativeDay } from '@huishouden/pwa-kit/time';
import { useClock } from '@huishouden/pwa-kit/react/clock';
import type { PetStore } from '../data/types';
import { birthdayQueries, guessWords, isBirthdayOf } from '../lib/birthday';
import { petInputOf } from '../lib/build';
import { birthdayMatches, guessSource } from '../components/BirthdayFind';
import { CalendarHint, CalendarImportDialog, useCalendarSearch } from '@huishouden/pwa-kit/react/calendar';
import { auth } from '../data/firebase';
import type { Open } from '../PetApp';
import { PetAvatar, PetChips } from '../components/PetAvatar';
import { cardClass, ghostButton, iconButton, linkClass, primaryButton, secondaryButton } from '@huishouden/pwa-kit/react/ui';

export function Appointments({ store, pets, open, calendarAvailable, notify }: {
  store: PetStore;
  pets: Pet[];
  open: Open;
  calendarAvailable: boolean;
  notify: (message: string, undo?: () => void) => void;
}) {
  const { now } = useClock();
  const [petId, setPetId] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [importing, setImporting] = useState(false);
  const scan = useCalendarSearch(auth, 'Pet');
  const all = store.data.appointments;
  const shown = all.filter((a) => !petId || a.petIds.includes(petId));
  const contacts = store.data.contacts;
  const upcoming = shown.filter((a) => a.at >= now - 3_600_000).sort((a, b) => a.at - b.at);
  const past = shown.filter((a) => a.at < now - 3_600_000).sort((a, b) => b.at - a.at);
  // Pets without a birthday (or with only an age) are looked for too; their birthday events are offered, not imported as visits.
  const unborn = pets.filter((p) => !p.birthDate || p.birthDateApprox);
  const runScan = () => void scan.run([...PET_CALENDAR_QUERIES, ...unborn.flatMap((p) => birthdayQueries(p.name))], { limit: 25, seriesStart: true });
  const found = scan.state.status === 'done' ? scan.state.matches : [];
  const birthdays = unborn.flatMap((pet) => birthdayMatches(found, pet.name, now).slice(0, 1).map((b) => ({ pet, ...b })));
  const visits = scan.state.status === 'done' ? { ...scan.state, matches: found.filter((m) => !pets.some((p) => isBirthdayOf(m.title, p.name))) } : scan.state;

  return (
    <div className="mx-auto max-w-4xl space-y-5 lg:h-full lg:overflow-y-auto">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <h2 className="text-2xl font-semibold text-stone-800">Appointments</h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={secondaryButton}
              disabled={!calendarAvailable}
              onClick={() => {
                setImporting(true);
                // Straight from the tap: the first search opens Google's permission window.
                runScan();
              }}
            >
              <CalendarArrowDown size={20} /> Import from calendar
            </button>
            <button type="button" className={primaryButton} onClick={() => open.appointment(null, petId ?? undefined)}>
              <CalendarPlus size={20} /> Add appointment
            </button>
          </div>
        </div>
        <div className="mt-1 flex justify-end text-right">
          <CalendarHint app="Pet" available={calendarAvailable} />
        </div>
      </div>
      {pets.length > 1 && <PetChips pets={pets} selected={petId} onSelect={setPetId} />}

      <section className={cardClass} aria-label="Upcoming appointments">
        {upcoming.length === 0 && <p className="p-6 text-lg text-stone-600">No appointments coming up.</p>}
        <ul>
          {upcoming.map((a, i) => (
            <Row key={a.id} a={a} now={now} pets={pets} contacts={contacts} first={i === 0} onEdit={() => open.appointment(a)} />
          ))}
        </ul>
      </section>

      {past.length > 0 && (
        <section aria-label="Past appointments">
          <button type="button" className={ghostButton} onClick={() => setShowPast((s) => !s)} aria-expanded={showPast}>
            {showPast ? <ChevronUp size={18} /> : <ChevronDown size={18} />} Past ({past.length})
          </button>
          {showPast && (
            <ul className={`${cardClass} mt-2`}>
              {past.map((a) => (
                <Row key={a.id} a={a} now={now} pets={pets} contacts={contacts} onEdit={() => open.appointment(a)} />
              ))}
            </ul>
          )}
        </section>
      )}

      {importing && (
        <CalendarImportDialog
          state={visits}
          intro="Vet, grooming, vaccine, boarding and kennel events from last week to a year ahead."
          noneFound="No pet events found in your calendars."
          allImported="Every pet event in your calendar is already in Pet."
          records={all}
          onRetry={runScan}
          onAdd={(list) => {
            for (const m of list) store.actions.saveAppointment(null, fromCalendar(m, pets));
            notify(list.length === 1 ? `Added ${list[0].title}` : `Added ${list.length} appointments`);
          }}
          onClose={() => {
            setImporting(false);
            scan.reset();
          }}
        >
          {birthdays.length > 0 && (
            <section className="mt-4" aria-label="Birthdays">
              <h3 className="text-sm font-medium text-stone-700">Birthdays</h3>
              <ul className="mt-1.5 divide-y divide-stone-200 rounded-2xl border border-stone-200">
                {birthdays.map(({ pet, match, guess }) => (
                  <li key={match.id} className="flex items-center gap-3 px-3 py-2">
                    <Cake size={20} className="shrink-0 text-forest-700" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-stone-800">
                        {pet.name}: {guessWords(guess)}
                      </p>
                      <p className="text-sm text-stone-600 [overflow-wrap:anywhere]">{guessSource({ match, guess })}</p>
                    </div>
                    {guess.date ? (
                      <button
                        type="button"
                        className={secondaryButton}
                        onClick={() => {
                          const before = pet;
                          store.actions.savePet(pet.id, { ...petInputOf(pet), birthDate: guess.date, birthDateApprox: undefined });
                          notify(`Saved ${pet.name}'s birthday`, () => store.actions.savePet(before.id, petInputOf(before)));
                        }}
                        aria-label={`Set ${pet.name}'s birthday`}
                      >
                        Set birthday
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={secondaryButton}
                        onClick={() => {
                          setImporting(false);
                          scan.reset();
                          open.pet(pet, guess);
                        }}
                        aria-label={`Add the year of ${pet.name}'s birthday`}
                      >
                        Add the year
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </CalendarImportDialog>
      )}
    </div>
  );
}

function Row({ a, now, pets, contacts, first, onEdit }: { a: Appointment; now: number; pets: Pet[]; contacts: Contact[]; first?: boolean; onEdit: () => void }) {
  const d = new Date(a.at);
  const who = a.contactId ? contacts.find((c) => c.id === a.contactId) : undefined;
  const forPets = a.petIds.map((id) => pets.find((p) => p.id === id)).filter((p): p is Pet => !!p);
  return (
    <li className="flex items-start gap-5 border-b border-stone-200 p-5 last:border-b-0">
      <div className={`flex w-16 shrink-0 flex-col items-center rounded-xl py-2 ${first ? 'bg-forest-700 text-white' : 'bg-forest-50 text-forest-700'}`}>
        <span className="text-sm font-medium">{monthShort(a.at)}</span>
        <span className="text-2xl font-semibold tabular-nums">{d.getDate()}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className={`${first ? 'text-2xl' : 'text-xl'} font-semibold text-stone-800`}>{a.title}</p>
        <p className="mt-0.5 text-base text-stone-700">
          <span className="font-medium text-forest-700">{relativeDay(a.at, now)}</span> · {formatDayLong(a.at)}, {formatTime(a.at)} · {APPOINTMENT_LABELS[a.kind]}
        </p>
        {forPets.length > 0 && (
          <p className="mt-1 flex items-center gap-2 text-base text-stone-700">
            <span className="flex -space-x-1.5">
              {forPets.map((p) => (
                <PetAvatar key={p.id} pet={p} pets={pets} size={24} />
              ))}
            </span>
            {petNames(a.petIds, pets)}
          </p>
        )}
        {who && (
          <div className="flex flex-wrap items-center gap-x-4 text-base text-stone-600">
            <span className="flex items-center gap-1.5">
              <UserRound size={16} aria-hidden="true" /> {who.name}
            </span>
            {who.phone && (
              <a className={`${linkClass} tabular-nums`} href={telHref(who.phone)} aria-label={`Call ${who.name}, ${who.phone}`}>
                <Phone size={16} aria-hidden="true" /> {who.phone}
              </a>
            )}
          </div>
        )}
        {a.location && (
          <p className="mt-0.5 flex items-center gap-1.5 text-base text-stone-600">
            <MapPin size={16} aria-hidden="true" /> {a.location}
          </p>
        )}
        {a.notes && <p className="mt-1 text-base whitespace-pre-line text-stone-600">{a.notes}</p>}
        {a.calendarLink && (
          <a className={linkClass} href={a.calendarLink} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={16} aria-hidden="true" /> Open in Calendar
          </a>
        )}
      </div>
      <button type="button" className={iconButton} onClick={onEdit} aria-label={`Edit ${a.title}`}>
        <Pencil size={18} />
      </button>
    </li>
  );
}
