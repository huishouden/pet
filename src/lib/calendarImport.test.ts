import { describe, expect, test } from 'bun:test';
import type { CalendarMatch } from '@huishouden/pwa-kit/calendar';
import fixture from './__fixtures__/calendar-matches.json';
import { calendarError, fromCalendar, guessKind, guessPets, isImported, notImported, plainText } from './calendarImport';
import type { Appointment } from './model';
import { LIMITS } from './model';

const matches = fixture.matches as CalendarMatch[];
const [vaccines, groom, kennel] = matches;
const pets = [
  { id: 'p1', name: 'Biscuit' },
  { id: 'p2', name: 'Miso' },
];
const appt = (fields: Partial<Appointment>): Appointment => ({ id: 'a1', petIds: [], kind: 'other', title: 'Something', at: 1, createdAt: 1, by: 'sam@example.com', ...fields });

describe('notes from a calendar description', () => {
  test('HTML becomes plain text with line breaks', () => {
    expect(plainText(vaccines.description)).toBe('Bring the vaccine card.\nAsk about the ear drops & weight.');
  });

  test('long descriptions are cut to the notes limit', () => {
    const out = plainText('word '.repeat(400));
    expect(out.length).toBeLessThanOrEqual(LIMITS.notes);
    expect(out.endsWith('…')).toBe(true);
  });
});

describe('guessing from the words', () => {
  test('kind of visit', () => {
    expect(guessKind('Biscuit vet: rabies vaccine')).toBe('vet');
    expect(guessKind('Grooming')).toBe('grooming');
    expect(guessKind('Drop off at the kennel')).toBe('boarding');
    expect(guessKind('Dental cleaning')).toBe('vet');
    expect(guessKind('Puppy class')).toBe('other');
  });

  test('pets named in the title, or the only pet', () => {
    expect(guessPets('Biscuit vet', pets)).toEqual(['p1']);
    expect(guessPets('Biscuit and Miso to the kennel', pets)).toEqual(['p1', 'p2']);
    expect(guessPets('Grooming', pets)).toEqual([]);
    expect(guessPets('Grooming', pets.slice(0, 1))).toEqual(['p1']);
    expect(guessPets('Misonumber', pets)).toEqual([]);
  });
});

describe('an appointment from a calendar event', () => {
  test('fills title, time, kind, pets, place, notes and the link', () => {
    expect(fromCalendar(vaccines, pets)).toEqual({
      title: 'Biscuit vet: rabies vaccine',
      at: vaccines.start,
      kind: 'vet',
      petIds: ['p1'],
      location: 'Example Vet Clinic, 25 Example Street, Springfield',
      notes: 'Bring the vaccine card.\nAsk about the ear drops & weight.',
      calendarEventId: 'evt-vaccines',
      calendarLink: 'https://www.google.com/calendar/event?eid=evt-vaccines',
    });
  });

  test('leaves out empty place and notes', () => {
    const f = fromCalendar(groom, pets);
    expect('location' in f).toBe(false);
    expect('notes' in f).toBe(false);
    expect(f.kind).toBe('grooming');
  });
});

describe('import', () => {
  test('matches by event id, link, or same title and time', () => {
    expect(isImported(vaccines, [appt({ calendarEventId: 'evt-vaccines' })])).toBe(true);
    expect(isImported(groom, [appt({ calendarLink: groom.link })])).toBe(true);
    expect(isImported(kennel, [appt({ title: ' drop off at the KENNEL ', at: kennel.start })])).toBe(true);
    expect(isImported(kennel, [appt({ title: 'Drop off at the kennel', at: kennel.start + 1 })])).toBe(false);
  });

  test('new events once each, soonest first', () => {
    expect(notImported(matches, [appt({ calendarEventId: 'evt-groom' })]).map((m) => m.id)).toEqual(['evt-vaccines', 'evt-kennel']);
  });

  test('errors in words', () => {
    expect(calendarError({ code: 'auth/popup-closed-by-user' })).toMatch(/not allowed/);
    expect(calendarError({ code: 'auth/popup-blocked' })).toMatch(/blocked/);
    expect(calendarError(new Error('x'))).toMatch(/Couldn't search/);
  });
});
