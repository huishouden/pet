import type { CalendarMatch } from '@huishouden/pwa-kit/calendar';

// Invented events around the sample pets' 2031 dates, standing in for Google Calendar.
const at = (month: number, day: number, h: number, m = 0) => new Date(2031, month - 1, day, h, m).getTime();

export const calendarEvents: CalendarMatch[] = [
  {
    id: 'evt-vaccines',
    title: 'Biscuit vet: rabies vaccine',
    start: at(6, 9, 9, 30),
    end: at(6, 9, 10, 0),
    allDay: false,
    location: '25 Example Street, Springfield',
    description: '<p>Bring the vaccine card.</p>',
    link: 'https://calendar.example.com/event?eid=evt-vaccines',
    calendarName: 'Family',
  },
  {
    id: 'evt-groom',
    title: 'Miso grooming',
    start: at(6, 12, 15, 0),
    allDay: false,
    location: 'Example Grooming',
    description: '',
    link: 'https://calendar.example.com/event?eid=evt-groom',
    calendarName: 'Alex',
  },
  {
    id: 'evt-kennel',
    title: 'Kennel tour',
    start: at(6, 14, 11, 0),
    allDay: false,
    location: '',
    description: '',
    link: 'https://calendar.example.com/event?eid=evt-kennel',
    calendarName: 'Family',
  },
  // Already in the sample appointments (same title and time), so the import leaves it out.
  {
    id: 'evt-dental',
    title: 'Dental cleaning',
    start: at(6, 4, 8, 0),
    allDay: false,
    location: '25 Example Street, Springfield',
    description: '',
    link: 'https://calendar.example.com/event?eid=evt-dental',
    calendarName: 'Family',
  },
];

/** Run before the page loads: the app then treats the browser as able to read a calendar. */
export function mockCalendar(events: CalendarMatch[]) {
  (window as unknown as { __mockCalendarEvents: CalendarMatch[] }).__mockCalendarEvents = events;
}
