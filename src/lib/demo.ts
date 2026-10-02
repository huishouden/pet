import type { Contact } from '@huishouden/pwa-kit/contacts';
import type { Appointment, Course, Dose, Feeding, Meal, MedDose, Pet, PetRecord, Reminder, Weight } from './model';
import { toYmd } from '@huishouden/pwa-kit/time';

// Invented sample data for the signed-out app: README screenshots and first impressions. Everything
// is relative to one fixed day in 2031 so nothing resembles a real household's dates.

/** Wednesday 14 May 2031, 10:30 local time (the suite's sample day). The demo's clock starts here. */
export const DEMO_NOW = new Date(2031, 4, 14, 10, 30).getTime();

export const DEMO_MEMBERS = ['sam@example.com', 'alex@example.com'];
const [SAM, ALEX] = DEMO_MEMBERS;

export interface PetHouseholdData {
  pets: Pet[];
  reminders: Reminder[];
  doses: Dose[];
  appointments: Appointment[];
  weights: Weight[];
  records: PetRecord[];
  meals: Meal[];
  feedings: Feeding[];
  courses: Course[];
  medDoses: MedDose[];
  /** The household's contacts shown in Pet. */
  contacts: Contact[];
}

export const emptyData = (): PetHouseholdData => ({ pets: [], reminders: [], doses: [], appointments: [], weights: [], records: [], meals: [], feedings: [], courses: [], medDoses: [], contacts: [] });

/** Local time on a 2031 day: month 1–12. */
const on = (month: number, day: number, hhmm = '12:00', year = 2031) => {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(year, month - 1, day, h, m).getTime();
};
const ymd = (month: number, day: number, year = 2031) => toYmd(on(month, day, '12:00', year));

const BISCUIT = 'demo-pet-biscuit';
const MISO = 'demo-pet-miso';
const VET = 'demo-contact-vet';
const ER = 'demo-contact-er';
const GROOMER = 'demo-contact-groomer';
const LODGE = 'demo-contact-lodge';

const CREATED = on(1, 5);

function pets(): Pet[] {
  return [
    {
      id: BISCUIT,
      name: 'Biscuit',
      species: 'dog',
      breed: 'Beagle',
      birthDate: ymd(3, 8, 2027),
      weightUnit: 'lb',
      notes: 'Allergic to chicken: lamb food and lamb treats only. Hides from the vacuum.',
      createdAt: CREATED,
      by: SAM,
    },
    {
      id: MISO,
      name: 'Miso',
      species: 'cat',
      breed: 'Domestic shorthair',
      birthDate: ymd(9, 20, 2029),
      weightUnit: 'lb',
      notes: 'Indoor only. Kidney diet: wet food twice a day, supplement with breakfast.',
      createdAt: CREATED,
      by: ALEX,
    },
  ];
}

type R = [string, string, Reminder['kind'], string, number | undefined, Reminder['unit'], string, number | undefined, string?];

function reminders(): Reminder[] {
  const rows: R[] = [
    ['demo-rem-1', BISCUIT, 'flea-tick', 'Flea and tick', 1, 'month', ymd(5, 12), on(4, 12, '08:10'), 'Chewable, with breakfast.'],
    ['demo-rem-2', BISCUIT, 'heartworm', 'Heartworm prevention', 1, 'month', ymd(5, 17), on(4, 17, '08:05')],
    ['demo-rem-3', MISO, 'medication', 'Kidney supplement', 1, 'day', ymd(5, 14), on(5, 13, '07:45'), 'Half a scoop mixed into breakfast.'],
    ['demo-rem-4', BISCUIT, 'vaccine', 'Rabies vaccine', 1, 'year', ymd(6, 10), on(6, 10, '09:30', 2030)],
    ['demo-rem-5', MISO, 'flea-tick', 'Flea treatment', 1, 'month', ymd(5, 26), on(4, 26, '19:00')],
    ['demo-rem-6', MISO, 'deworming', 'Deworming', 3, 'month', ymd(7, 2), on(4, 2, '19:00')],
    ['demo-rem-7', MISO, 'vaccine', 'FVRCP vaccine', 1, 'year', ymd(9, 22), on(9, 22, '10:00', 2030)],
    ['demo-rem-8', BISCUIT, 'vaccine', 'DHPP vaccine', 1, 'year', ymd(11, 3), on(11, 3, '11:00', 2030)],
    ['demo-rem-9', BISCUIT, 'medication', 'Ear drops, last day', undefined, undefined, ymd(5, 9), on(5, 9, '20:00')],
  ];
  return rows.map(([id, petId, kind, title, every, unit, due, lastDoneAt, notes], i) => ({
    id,
    petId,
    kind,
    title,
    ...(every ? { every, unit } : {}),
    due,
    ...(lastDoneAt ? { lastDoneAt } : {}),
    ...(notes ? { notes } : {}),
    createdAt: CREATED,
    by: i % 2 ? ALEX : SAM,
  }));
}

function doses(rs: Reminder[]): Dose[] {
  const given: [string, number, string][] = [
    ['demo-rem-1', on(3, 11, '08:00'), SAM],
    ['demo-rem-1', on(4, 12, '08:10'), ALEX],
    ['demo-rem-2', on(3, 17, '08:00'), SAM],
    ['demo-rem-2', on(4, 17, '08:05'), SAM],
    ['demo-rem-3', on(5, 11, '07:40'), ALEX],
    ['demo-rem-3', on(5, 12, '07:50'), SAM],
    ['demo-rem-3', on(5, 13, '07:45'), ALEX],
    ['demo-rem-5', on(4, 26, '19:00'), ALEX],
    ['demo-rem-9', on(5, 9, '20:00'), SAM],
  ];
  return given.map(([reminderId, at, by], i) => {
    const r = rs.find((x) => x.id === reminderId)!;
    return { id: `demo-dose-${i + 1}`, petId: r.petId, reminderId, title: r.title, at, by, createdAt: at };
  });
}

function appointments(): Appointment[] {
  type Row = [number, number, string, string[], Appointment['kind'], string, string?, string?, string?];
  const clinic = '25 Example Street, Springfield';
  const rows: Row[] = [
    [5, 20, '09:30', [BISCUIT], 'vet', 'Yearly check-up', clinic, 'Ask about his weight and the ear drops.', VET],
    [5, 27, '14:00', [BISCUIT], 'grooming', 'Bath and nail trim', 'Example Grooming', undefined, GROOMER],
    [6, 4, '08:00', [MISO], 'vet', 'Dental cleaning', clinic, 'No food after midnight.', VET],
    [6, 21, '10:00', [BISCUIT, MISO], 'boarding', 'Boarding drop-off', '7 Kennel Lane, Springfield', 'Pick up 28 June. Pack the lamb food and the supplement.', LODGE],
    [4, 30, '16:15', [BISCUIT], 'vet', 'Ear check', clinic, undefined, VET],
    [4, 22, '11:00', [MISO], 'vet', 'Blood test', clinic, undefined, VET],
  ];
  return rows.map(([month, day, time, petIds, kind, title, location, notes, contactId], i) => ({
    id: `demo-appt-${i + 1}`,
    petIds,
    kind,
    title,
    at: on(month, day, time),
    ...(location ? { location } : {}),
    ...(notes ? { notes } : {}),
    ...(contactId ? { contactId } : {}),
    createdAt: CREATED,
    by: i % 2 ? ALEX : SAM,
  }));
}

function weights(): Weight[] {
  const biscuit: [number, number, number, number][] = [
    [11, 12, 2030, 24.2],
    [12, 15, 2030, 24.6],
    [1, 18, 2031, 24.9],
    [2, 14, 2031, 25.3],
    [3, 16, 2031, 25.1],
    [4, 13, 2031, 25.8],
    [5, 11, 2031, 26.1],
  ];
  const miso: [number, number, number, number][] = [
    [12, 2, 2030, 9.9],
    [1, 27, 2031, 9.8],
    [3, 3, 2031, 9.6],
    [4, 22, 2031, 9.3],
    [5, 10, 2031, 9.2],
  ];
  const rows = [...biscuit.map((r) => [BISCUIT, ...r] as const), ...miso.map((r) => [MISO, ...r] as const)];
  return rows.map(([petId, month, day, year, value], i) => {
    const at = on(month, day, '08:30', year);
    return { id: `demo-weight-${i + 1}`, petId, at, value, unit: 'lb' as const, by: i % 3 ? SAM : ALEX, createdAt: at };
  });
}

function records(): PetRecord[] {
  const rows: [string, string, string, string?][] = [
    [BISCUIT, 'Ear infection', ymd(4, 30), 'Left ear. Drops twice a day for 10 days; recheck if he scratches it again.'],
    [BISCUIT, 'Chicken allergy confirmed', ymd(11, 14, 2030), 'Skin test at Example Vet Clinic. Lamb-based food only, no chicken treats.'],
    [BISCUIT, 'Microchip registered', ymd(6, 1, 2027), 'The number is on the adoption papers in the blue folder.'],
    [MISO, 'Kidney diet started', ymd(4, 22), 'Blood test showed early kidney changes. Renal wet food twice a day and a supplement each morning. Recheck in 3 months.'],
    [MISO, 'Spayed', ymd(3, 10, 2030)],
  ];
  return rows.map(([petId, title, date, text], i) => ({
    id: `demo-record-${i + 1}`,
    petId,
    title,
    date,
    ...(text ? { text } : {}),
    createdAt: CREATED,
    by: i % 2 ? ALEX : SAM,
  }));
}

function meals(): Meal[] {
  const rows: [string, string, string, string, string, string, string?][] = [
    [`${BISCUIT}-am`, BISCUIT, 'AM', '09:00', 'Lamb kibble', '1 cup'],
    [`${BISCUIT}-pm`, BISCUIT, 'PM', '19:00', 'Lamb kibble', '1 cup', 'Heartworm chew with dinner on the 17th'],
    [`${MISO}-am`, MISO, 'AM', '09:00', 'Renal wet food', 'Half a can', 'Kidney supplement mixed in'],
    [`${MISO}-pm`, MISO, 'PM', '19:00', 'Renal wet food', 'Half a can'],
  ];
  return rows.map(([id, petId, name, time, food, portion, note]) => ({ id, petId, name, time, food, portion, ...(note ? { note } : {}), createdAt: CREATED, by: SAM }));
}

/**
 * Two weeks of feeds. Today Biscuit has had breakfast and Miso has not, so the sample shows both
 * "fed" and "Not fed yet". One evening Miso's dinner was missed, so her history has a short day.
 */
function feedings(ms: Meal[]): Feeding[] {
  const out: Feeding[] = [];
  let n = 0;
  for (let offset = -13; offset <= 0; offset++) {
    const day = new Date(DEMO_NOW);
    day.setDate(day.getDate() + offset);
    for (const m of ms) {
      if (offset === 0 && m.id !== `${BISCUIT}-am`) continue;
      if (offset === -6 && m.id === `${MISO}-pm`) continue;
      // Fed a while before the cut-off: AM around 7, PM around 6.
      const [h, min] = m.name === 'AM' ? [7, 0] : [18, 0];
      const late = [12, 4, 9, 21, 2, 15, 7][(n + offset + 13) % 7];
      const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, min + late).getTime();
      out.push({ id: `demo-feed-${++n}`, petId: m.petId, mealId: m.id, at, by: (n + offset) % 2 ? ALEX : SAM, createdAt: at });
    }
  }
  return out;
}

/** Biscuit is on day 3 of a week of antibiotics (morning dose given); Miso finished a short course in April. */
function courses(): Course[] {
  return [
    {
      id: 'demo-course-1',
      petId: BISCUIT,
      name: 'Antibiotic',
      dose: '1 tablet',
      timesPerDay: 2,
      times: ['09:00', '19:00'],
      startDate: ymd(5, 12),
      days: 7,
      withFood: true,
      notes: 'For the ear infection. Finish the whole course.',
      createdAt: on(5, 12, '09:00'),
      by: SAM,
    },
    {
      id: 'demo-course-2',
      petId: MISO,
      name: 'Anti-nausea',
      dose: 'Half a tablet',
      timesPerDay: 1,
      times: ['09:00'],
      startDate: ymd(4, 22),
      days: 5,
      withFood: false,
      createdAt: on(4, 22, '12:00'),
      by: ALEX,
    },
  ];
}

function medDoses(): MedDose[] {
  const out: MedDose[] = [];
  const add = (courseId: string, petId: string, month: number, day: number, slot: number, hhmm: string, by: string) => {
    const at = on(month, day, hhmm);
    out.push({ id: `demo-med-${out.length + 1}`, petId, courseId, slot, at, by, createdAt: at });
  };
  for (const day of [12, 13]) {
    add('demo-course-1', BISCUIT, 5, day, 0, '07:08', day % 2 ? ALEX : SAM);
    add('demo-course-1', BISCUIT, 5, day, 1, '18:05', day % 2 ? SAM : ALEX);
  }
  add('demo-course-1', BISCUIT, 5, 14, 0, '07:06', ALEX);
  for (const day of [22, 23, 24, 25, 26]) add('demo-course-2', MISO, 4, day, 0, '07:40', day % 2 ? ALEX : SAM);
  return out;
}

/** Invented businesses on invented streets; 555-01xx numbers are reserved for fiction. */
function contacts(): Contact[] {
  const base = { apps: ['pet'], createdAt: CREATED, by: SAM };
  return [
    {
      id: VET,
      name: 'Example Vet Clinic',
      role: 'Vet',
      phone: '(555) 010-0150',
      website: 'https://vet.example.com',
      address: '25 Example Street, Springfield',
      notes: 'Open Monday to Saturday, 8 to 6. Both pets are registered here.',
      ...base,
    },
    {
      id: ER,
      name: 'Example Emergency Animal Hospital',
      role: 'Emergency vet',
      phone: '(555) 010-0111',
      address: '90 Highway Road, Springfield',
      notes: 'Open all night and on holidays.',
      ...base,
    },
    {
      id: GROOMER,
      name: 'Example Grooming',
      role: 'Groomer',
      phone: '(555) 010-0164',
      email: 'hello@grooming.example.com',
      ...base,
    },
    {
      id: LODGE,
      name: 'Example Pet Lodge',
      role: 'Boarding',
      phone: '(555) 010-0178',
      website: 'https://lodge.example.com',
      address: '7 Kennel Lane, Springfield',
      ...base,
    },
  ];
}

export function demoData(): PetHouseholdData {
  const rs = reminders();
  const ms = meals();
  return {
    pets: pets(),
    reminders: rs,
    doses: doses(rs),
    appointments: appointments(),
    weights: weights(),
    records: records(),
    meals: ms,
    feedings: feedings(ms),
    courses: courses(),
    medDoses: medDoses(),
    contacts: contacts(),
  };
}
