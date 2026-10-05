import { describe, expect, test } from 'bun:test';
import { formatTime } from '@huishouden/pwa-kit/time';
import { DEMO_NOW, demoData } from './demo';
import { sortPets } from './pets';
import { allDoneLine, birthdaysToday, celebrationLine, celebrationTitle, comingUp, doneNow, laterToday, needsDoing, sinceWords, timedWhen, untilWords, type TodayData } from './today';
import type { Pet } from './model';

// The sample morning: Wednesday 14 May 2031, 10:30.
const at = (hhmm: string, d = 14) => {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(2031, 4, d, h, m).getTime();
};
const demo = demoData();
const pets = sortPets(demo.pets);
const t = (hhmm: string) => formatTime(at(hhmm));

describe('needs doing', () => {
  test('the sample morning leads with the overdue flea treatment, then the late dose and meal, then what is due today', () => {
    const list = needsDoing(demo, pets, DEMO_NOW);
    expect(list.map((n) => [n.title, n.when, n.late, n.action])).toEqual([
      ['Flea and tick for Biscuit', 'Overdue by 2 days', true, 'given'],
      ['Antibiotic for Biscuit', `Due ${t('09:00')} · 1 hr 30 min ago`, true, 'given'],
      ['Not fed yet: Miso AM', `Due ${t('09:00')} · 1 hr 30 min ago`, true, 'fed'],
      ['Kidney supplement for Miso', 'Due today', false, 'given'],
    ]);
  });

  test('a dose or meal within half an hour of its time is already there, not late; further off it is not', () => {
    const at1830 = needsDoing(demo, pets, at('18:30'));
    expect(at1830.find((n) => n.title === 'Antibiotic for Biscuit' && n.kind === 'dose' && n.slot === 1)).toMatchObject({ late: false, when: `Due ${t('19:00')} · in 30 min` });
    expect(at1830.some((n) => n.title === "Biscuit's PM meal")).toBe(true);
    expect(needsDoing(demo, pets, at('18:29')).some((n) => n.title === "Biscuit's PM meal")).toBe(false);
  });

  test('ticking a dose, a meal or giving the care takes it off', () => {
    const data: TodayData = {
      ...demo,
      medDoses: [...demo.medDoses, { id: 'x', petId: 'demo-pet-biscuit', courseId: 'demo-course-1', slot: 0, at: DEMO_NOW, by: 'sam@example.com', createdAt: DEMO_NOW }],
      feedings: [...demo.feedings, { id: 'y', petId: 'demo-pet-miso', mealId: 'demo-pet-miso-am', at: DEMO_NOW, by: 'sam@example.com', createdAt: DEMO_NOW }],
      reminders: demo.reminders.map((r) => (r.id === 'demo-rem-1' ? { ...r, due: '2031-06-14', lastDoneAt: DEMO_NOW } : r)),
    };
    expect(needsDoing(data, pets, DEMO_NOW).map((n) => n.title)).toEqual(['Kidney supplement for Miso']);
    const done = doneNow({ ...data, doses: [{ reminderId: 'demo-rem-1', at: DEMO_NOW, by: 'jo@example.com' }] }, pets, DEMO_NOW);
    const byKey = Object.fromEntries(done.map((n) => [n.key, [n.title, n.done?.by]]));
    expect(byKey['dose:demo-course-1:0']).toEqual(['Antibiotic for Biscuit', 'sam@example.com']);
    expect(byKey['meal:demo-pet-miso-am']).toEqual([expect.not.stringContaining('Not fed yet'), 'sam@example.com']);
    expect(byKey['care:demo-rem-1']).toEqual(['Flea and tick for Biscuit', 'jo@example.com']);
    expect(done.every((n) => n.done && !n.late)).toBe(true);
    expect(done.some((n) => n.title.startsWith('Not fed yet'))).toBe(false);
  });

  test('a reminder for a removed pet is left out; a one-off "other" is Done, not Given', () => {
    const data = { ...demo, reminders: [{ ...demo.reminders[0], petId: 'gone' }, { ...demo.reminders[0], id: 'o', kind: 'other' as const, title: 'Nail trim' }] };
    expect(needsDoing(data, pets, DEMO_NOW).filter((n) => n.kind === 'care').map((n) => [n.title, n.action])).toEqual([['Nail trim for Biscuit', 'done']]);
  });
});

describe('wording', () => {
  test('minutes and hours since and until', () => {
    expect(sinceWords(20_000)).toBe('just now');
    expect(sinceWords(25 * 60_000)).toBe('25 min ago');
    expect(sinceWords(60 * 60_000)).toBe('1 hr ago');
    expect(sinceWords(90 * 60_000)).toBe('1 hr 30 min ago');
    expect(untilWords(15 * 60_000)).toBe('in 15 min');
    expect(untilWords(10_000)).toBe('now');
    expect(timedWhen(at('08:00'), at('08:25'))).toBe(`Due ${t('08:00')} · 25 min ago`);
  });
});

describe('later today and coming up', () => {
  test("the evening's dose and both pets' dinner, one line for the meal", () => {
    const later = laterToday(demo, pets, DEMO_NOW);
    expect(later.map((l) => [l.time, l.title])).toEqual([
      [t('19:00'), 'Antibiotic for Biscuit'],
      [t('19:00'), 'PM meal for Biscuit and Miso'],
    ]);
    expect(allDoneLine(later)).toBe('All done for now · next: Antibiotic for Biscuit at 7 PM');
    expect(allDoneLine([])).toBe('All done for today');
  });

  test("one pet's meal reads as theirs; an appointment later today is listed with its pets", () => {
    const data = { ...demo, feedings: [...demo.feedings, { id: 'z', petId: 'demo-pet-miso', mealId: 'demo-pet-miso-pm', at: DEMO_NOW, by: 'sam@example.com', createdAt: DEMO_NOW }], appointments: [{ ...demo.appointments[0], at: at('16:15') }] };
    expect(laterToday(data, pets, DEMO_NOW).map((l) => l.title)).toEqual(['Yearly check-up for Biscuit', 'Antibiotic for Biscuit', "Biscuit's PM meal"]);
  });

  test('care due soon, visits in the next two weeks and the birthday three weeks away, soonest first', () => {
    expect(comingUp(demo, pets, DEMO_NOW).map((c) => [c.title, c.detail])).toEqual([
      ['Heartworm prevention due in 3 days', 'Biscuit'],
      ['Yearly check-up', `In 6 days · ${formatTime(new Date(2031, 4, 20, 9, 30).getTime())} · Biscuit`],
      ['Bath and nail trim', `In 13 days · ${formatTime(new Date(2031, 4, 27, 14, 0).getTime())} · Biscuit`],
      ["Miso's birthday in 3 weeks", 'Turns 2 on June 4'],
      ['Rabies vaccine due in 3 weeks', 'Biscuit'],
    ]);
  });
});

describe('birthdays', () => {
  const pet = (birthDate: string, birthDateApprox?: boolean): Pet => ({ ...pets[0], birthDate, ...(birthDateApprox ? { birthDateApprox } : {}) });
  const line = (birthDate: string) => comingUp({ reminders: [], appointments: [] }, [pet(birthDate)], DEMO_NOW).map((c) => c.title)[0] ?? null;

  test('counted down in months, then weeks, then days, only within three months', () => {
    expect(line('2027-08-15')).toBeNull();
    expect(line('2027-08-14')).toBe("Biscuit's birthday in 3 months");
    expect(line('2027-07-14')).toBe("Biscuit's birthday in 2 months");
    expect(line('2027-06-04')).toBe("Biscuit's birthday in 3 weeks");
    expect(line('2027-05-28')).toBe("Biscuit's birthday in 2 weeks");
    expect(line('2027-05-19')).toBe("Biscuit's birthday in 5 days");
    expect(line('2027-05-15')).toBe("Biscuit's birthday tomorrow");
  });

  test('on the day it is a celebration, not a line; never for an approximate age', () => {
    expect(line('2027-05-14')).toBeNull();
    const today = birthdaysToday(pets, DEMO_NOW);
    expect(today.map(({ pet, countdown }) => [celebrationTitle(pet.name), celebrationLine(pet.name, countdown.turns)])).toEqual([['Happy birthday, Biscuit!', 'Biscuit turns 4 today']]);
    expect(birthdaysToday([pet('2027-05-14', true)], DEMO_NOW)).toEqual([]);
  });
});
