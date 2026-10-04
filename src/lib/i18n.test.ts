import { afterEach, describe, expect, test } from 'bun:test';
import { setLangForTests } from '@huishouden/pwa-kit/i18n';
import { localizeReminders } from '@huishouden/pwa-kit/reminders';
import { DEMO_NOW, demoData } from './demo';
import { courseReminders, mealReminders } from './notify';
import { birthdayQueries, birthDateFromAgeOrYear, isBirthdayOf, turnsOn } from './birthday';
import { calendarWords, guessKind } from './calendarImport';
import { knownRole, roleLabel } from './contacts';
import { dueText, headline } from './schedule';
import { formatWeight } from './weight';
import { defaultMeals } from './feeding';
import { petNames } from './pets';

// Spanish and Dutch: what Pet writes in each, and the household's own words it understands in any language.
// Back to English after each (resetI18nForTests would also forget the app's catalogue).
afterEach(() => setLangForTests('en'));

const d = demoData();
const biscuit = d.pets.find((p) => p.name === 'Biscuit')!;
const antibiotic = d.courses.find((c) => c.name === 'Antibiotic')!;

describe('notifications in every language', () => {
  test('dose reminders say the time the reader’s way, not 19:00', async () => {
    const [r] = await localizeReminders(() => courseReminders(antibiotic, biscuit, d.medDoses, DEMO_NOW));
    expect(r.texts.en?.body).toContain('at 7 PM');
    expect(r.texts.en?.body).not.toContain('19:00');
    expect(r.texts.es?.body).toContain('a las 7 p.m.');
    expect(r.texts.nl?.body).toContain('om 19:00');
    expect(r.texts.es?.body).toContain('con comida');
  });

  test('meal reminders and the pet’s name stay as entered', async () => {
    const list = await localizeReminders(() => mealReminders(biscuit, d.meals, d.feedings, DEMO_NOW));
    expect(list[0].texts.es?.title).toMatch(/^Biscuit: .+ sin comer todavía$/);
    expect(list[0].texts.nl?.title).toMatch(/^Biscuit: .+ nog niet gegeten$/);
  });
});

describe('in Spanish and Dutch', () => {
  test('due words, weights, lists and birthdays', async () => {
    await setLangForTests('es', ['es-MX']);
    expect(dueText({ due: '2031-05-17' }, DEMO_NOW)).toBe('Vence en 3 días');
    expect(headline({ due: '2031-05-12', title: 'Pulgas y garrapatas' }, DEMO_NOW)).toBe('Atrasado: pulgas y garrapatas');
    expect(petNames([biscuit.id, d.pets[1].id], d.pets)).toBe(`Biscuit y ${d.pets[1].name}`);
    expect(turnsOn({ turns: 5, date: '2031-06-04' })).toBe('Cumple 5 el 4 de junio');
    expect(roleLabel('vet')).toBe('Veterinario');
    expect(defaultMeals('p1').map((m) => m.name)).toEqual(['Mañana', 'Noche']);

    await setLangForTests('nl', ['nl-NL']);
    expect(dueText({ due: '2031-05-17' }, DEMO_NOW)).toBe('Over 3 dagen');
    expect(formatWeight(11.8, 'kg')).toBe('11,8 kg');
    expect(petNames([biscuit.id, d.pets[1].id], d.pets)).toBe(`Biscuit en ${d.pets[1].name}`);
  });
});

describe('the household’s own words, in any app language', () => {
  test('calendar events, roles and ages in Spanish and Dutch', () => {
    expect(guessKind('Vacuna antirrábica de Biscuit')).toBe('vet');
    expect(guessKind('Peluquería canina')).toBe('grooming');
    expect(guessKind('Dierenarts controle')).toBe('vet');
    expect(guessKind('Trimsalon Miso')).toBe('grooming');
    expect(guessKind('Dierenpension')).toBe('boarding');
    expect(knownRole('Veterinaria del barrio')).toBe('Vet');
    expect(knownRole('Spoedkliniek voor dieren')).toBe('Emergency vet');
    expect(knownRole('Hondenuitlaatservice')).toBe('Pet sitter');
    expect(isBirthdayOf('Cumpleaños de Biscuit', 'Biscuit')).toBe(true);
    expect(isBirthdayOf('Biscuit jarig', 'Biscuit')).toBe(true);
    expect(birthdayQueries('Biscuit', 'es')).toContain('cumpleaños de biscuit');
    expect(birthdayQueries('Biscuit', 'nl')).toContain('biscuit verjaardag');
    expect(birthDateFromAgeOrYear('6 años', 3, 8, DEMO_NOW)).toBe('2025-03-08');
    expect(birthDateFromAgeOrYear('6 jaar', 3, 8, DEMO_NOW)).toBe('2025-03-08');
    expect(calendarWords('es')).toEqual(expect.arrayContaining(['vet', 'veterinario', 'vacuna']));
    expect(calendarWords('nl')).toEqual(expect.arrayContaining(['vet', 'dierenarts', 'trimsalon']));
  });
});
