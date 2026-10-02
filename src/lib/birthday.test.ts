import { describe, expect, test } from 'bun:test';
import { ageParts, approxBirthDate, birthDateFromAgeOrYear, birthdayFromMatch, birthdayQueries, birthdayReminder, birthdayText, bornWords, guessWords, isBirthdayOf, nextBirthday } from './birthday';

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

  test('a yearly series only suggests its first year: it is when the event was added, not a birth', () => {
    const g = birthdayFromMatch({ title: "Biscuit's birthday", start: day(2032, 3, 8), seriesStart: day(2027, 3, 8) }, now);
    expect(g).toEqual({ month: 3, day: 8, suggestedYear: 2027, from: null });
    expect(guessWords(g)).toBe('March 8');
  });

  test('a series begun this year suggests nothing', () => {
    expect(birthdayFromMatch({ title: "Biscuit's birthday", start: day(2031, 9, 20), seriesStart: day(2031, 9, 20) }, now)).toEqual({ month: 9, day: 20, from: null });
  });

  test('a series started on another day (added later) does not', () => {
    const g = birthdayFromMatch({ title: "Biscuit's birthday", start: day(2031, 9, 20), seriesStart: day(2030, 1, 4) }, now);
    expect(g).toEqual({ month: 9, day: 20, from: null });
    expect(guessWords(g)).toBe('September 20');
  });

  test('an age or a year in the title wins', () => {
    expect(birthdayFromMatch({ title: 'Miso turns 2', start: day(2031, 9, 20), seriesStart: day(2030, 9, 20) }, now)).toEqual({ month: 9, day: 20, year: 2029, date: '2029-09-20', from: 'age' });
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

describe('age or year born, for a birthday without its year', () => {
  // now is May 14, 2031.
  test.each([
    ['2019', 3, 8, '2019-03-08'],
    ['6', 3, 8, '2025-03-08'], // birthday passed this year: turned 6 in March
    ['6', 9, 20, '2024-09-20'], // not yet: turns 7 in September
    ['6', 5, 14, '2025-05-14'], // today counts as passed
    [' 6 years old ', 3, 8, '2025-03-08'],
    ['0', 3, 8, '2031-03-08'],
    ['0', 9, 20, '2030-09-20'],
    ['3', 2, 29, '2028-02-29'],
  ])('%p for %i/%i is %s', (text, m, d, date) => expect(birthDateFromAgeOrYear(text, m, d, now)).toBe(date));

  test.each([['2032', 3, 8], ['2031', 9, 20], ['1900', 3, 8], ['61', 3, 8], ['six', 3, 8], ['', 3, 8], ['20199', 3, 8]])('%p for %i/%i is not a birth date', (text, m, d) =>
    expect(birthDateFromAgeOrYear(text, m, d, now)).toBeNull(),
  );

  test('the confirmation says the date and the next age', () => {
    expect(bornWords('2025-03-08', now)).toBe('Born March 8, 2025 · turns 7 next');
    expect(bornWords('2024-09-20', now)).toBe('Born September 20, 2024 · turns 7 next');
    expect(bornWords('2027-05-14', now)).toBe('Born May 14, 2027 · turns 4 today');
  });
});

describe('an age without a birthday', () => {
  test('is saved as that long before today', () => {
    expect(approxBirthDate(6, 0, now)).toBe('2025-05-14');
    expect(approxBirthDate(1, 6, now)).toBe('2029-11-14');
    expect(approxBirthDate(0, 3, now)).toBe('2031-02-14');
  });

  test.each([[0, 0], [-1, 0], [1.5, 0], [2, 12], [61, 0], [NaN, 0]])('%p years %p months is not an age', (y, m) => expect(approxBirthDate(y, m, now)).toBeNull());

  test('refills the years and months it was entered as', () => {
    expect(ageParts('2025-05-14', now)).toEqual({ years: 6, months: 0 });
    expect(ageParts('2029-11-14', now)).toEqual({ years: 1, months: 6 });
    expect(ageParts('2031-06-01', now)).toBeNull();
  });

  test('has no birthday line and no birthday notification', () => {
    const app = { app: 'pet', url: 'https://example-pet.web.app/?tab=pets&pet=p1', ref: 'pet:birthday:p1' };
    expect(birthdayText('2025-05-20', now, true)).toBeNull();
    expect(birthdayReminder({ id: 'p1', name: 'Pip', birthDate: '2025-05-20', birthDateApprox: true }, now, app)).toBeNull();
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
