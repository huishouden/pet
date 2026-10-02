import { describe, expect, test } from 'bun:test';
import { birthdayFromMatch, birthdayQueries, birthdayReminder, birthdayText, guessWords, isBirthdayOf, nextBirthday } from './birthday';

const now = new Date(2031, 4, 14, 10, 30).getTime();
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d).getTime();

describe('finding birthdays in the calendar', () => {
  test('searches for the name with birthday, possessive and bday', () => {
    expect(birthdayQueries(' Biscuit ')).toEqual(['biscuit birthday', "biscuit's birthday", 'biscuit bday']);
    expect(birthdayQueries('')).toEqual([]);
  });

  test.each([
    ["Biscuit's birthday", true],
    ['Biscuit bday', true],
    ['Birthday: Biscuit', true],
    ['BISCUIT B-DAY', true],
    ['Biscuit vet: rabies vaccine', false],
    ["Sam's birthday", false],
    ['Biscuitine birthday', false],
  ])('%p is Biscuit’s birthday: %p', (title, yes) => expect(isBirthdayOf(title, 'Biscuit')).toBe(yes));

  test('a yearly series that began on the same day gives the birth year', () => {
    const g = birthdayFromMatch({ title: "Biscuit's birthday", start: day(2032, 3, 8), seriesStart: day(2027, 3, 8) }, now);
    expect(g).toEqual({ month: 3, day: 8, year: 2027, date: '2027-03-08', from: 'series' });
    expect(guessWords(g)).toBe('March 8, 2027');
  });

  test('a series started on another day (added later) does not', () => {
    const g = birthdayFromMatch({ title: "Biscuit's birthday", start: day(2031, 9, 20), seriesStart: day(2030, 1, 4) }, now);
    expect(g).toEqual({ month: 9, day: 20, from: null });
    expect(guessWords(g)).toBe('September 20');
  });

  test('an age or a year in the title wins', () => {
    expect(birthdayFromMatch({ title: 'Miso turns 2', start: day(2031, 9, 20), seriesStart: day(2030, 9, 20) }, now).date).toBe('2029-09-20');
    expect(birthdayFromMatch({ title: "Miso's 2nd birthday", start: day(2031, 9, 20) }, now).date).toBe('2029-09-20');
    expect(birthdayFromMatch({ title: 'Biscuit bday (born 2027)', start: day(2031, 3, 8) }, now)).toMatchObject({ date: '2027-03-08', from: 'year' });
  });

  test('a year that puts the birth in the future is dropped', () => {
    expect(birthdayFromMatch({ title: 'Pip turns 0', start: day(2031, 9, 20) }, now)).toEqual({ month: 9, day: 20, from: null });
  });

  test('29 February in a year without one falls on the 28th', () => {
    expect(birthdayFromMatch({ title: 'Pip turns 3', start: day(2032, 2, 29) }, now).date).toBe('2029-02-28');
  });
});

describe('the next birthday', () => {
  test.each([
    ['2027-03-08', 'Turns 5 on March 8'],
    ['2029-09-20', 'Turns 2 on September 20'],
    ['2027-05-14', 'Birthday today'],
    ['2030-05-15', 'Turns 1 on May 15'],
    ['2028-02-29', 'Turns 4 on February 29'],
  ])('born %s: %s', (born, text) => expect(birthdayText(born, now)).toBe(text));

  test('none without a date, or for a pet not born yet', () => {
    expect(birthdayText(undefined, now)).toBeNull();
    expect(birthdayText('2031-06-01', now)).toBeNull();
    expect(nextBirthday('2028-02-29', new Date(2031, 1, 1).getTime())).toEqual({ date: '2031-02-28', turns: 3, days: 27 });
  });

  test('the notification is at 9:00 on the day, the next year once it has passed', () => {
    const app = { app: 'pet', url: 'https://example-pet.web.app/?tab=pets&pet=p1', ref: 'pet:birthday:p1' };
    const pet = { id: 'p1', name: 'Biscuit', birthDate: '2027-05-14' };
    expect(birthdayReminder(pet, new Date(2031, 4, 14, 8).getTime(), app)).toMatchObject({ at: new Date(2031, 4, 14, 9).getTime(), title: "Biscuit's birthday", body: 'Biscuit turns 4 today.' });
    expect(birthdayReminder(pet, now, app)!.at).toBe(new Date(2032, 4, 14, 9).getTime());
    expect(birthdayReminder({ ...pet, birthDate: undefined }, now, app)).toBeNull();
  });
});
