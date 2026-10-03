// The Today screen's answer to "what needs doing for the pets right now?": every dose, meal and care
// reminder that is due or past due, most overdue first; what is left later today; and what is coming
// up (care due soon, visits, birthdays). Pure: every function takes `now`.

import { MINUTE, daysBetween, dueText, formatTime, parseYmd, relativeDay, startOfDay, toYmd } from '@huishouden/pwa-kit/time';
import type { Appointment, Course, Feeding, Meal, MedDose, Pet, Reminder } from './model';
import { dosesOn, isHandled } from './courses';
import { mealsOn } from './feeding';
import { dueState, headline } from './schedule';
import { birthdayCountdown, birthdayLine, turnsOn, type BirthdayCountdown } from './birthday';
import { petNames } from './pets';

export interface TodayData {
  meals: Meal[];
  feedings: Feeding[];
  courses: Course[];
  medDoses: MedDose[];
  reminders: Reminder[];
  appointments: Appointment[];
}

/** A dose or meal this close to its time is already "needs doing". */
export const DUE_NOW_MINUTES = 30;

interface NeedBase {
  key: string;
  petId: string;
  /** "Antibiotic for Biscuit", "Not fed yet: Miso PM", "Flea and tick for Biscuit". */
  title: string;
  /** "Due 9:00 AM · 1 hr 30 min ago", "Due 6:45 PM · in 15 min", "Overdue by 2 days", "Due today". */
  when: string;
  /** Past its time (or its day): shown in terracotta. */
  late: boolean;
  /** The moment it became due, for the order. */
  since: number;
  /** The one-tap action's label. */
  action: 'Given' | 'Fed' | 'Done';
}

export type Need =
  | (NeedBase & { kind: 'dose'; course: Course; slot: number })
  | (NeedBase & { kind: 'meal'; meal: Meal })
  | (NeedBase & { kind: 'care'; reminder: Reminder });

/** "just now", "25 min ago", "1 hr ago", "1 hr 30 min ago". */
export function sinceWords(ms: number): string {
  if (ms < MINUTE) return 'just now';
  return `${span(ms)} ago`;
}

/** "in 15 min", "in 1 hr 5 min"; "now" under a minute. */
export function untilWords(ms: number): string {
  if (ms < MINUTE) return 'now';
  return `in ${span(ms)}`;
}

function span(ms: number): string {
  const total = Math.floor(ms / MINUTE);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

/** "Due 9:00 AM · 1 hr 30 min ago", or "Due 7:00 PM · in 20 min" just before. */
export function timedWhen(at: number, now: number): string {
  return `Due ${formatTime(at)} · ${now >= at ? sinceWords(now - at) : untilWords(at - now)}`;
}

/** "Flea and tick for Biscuit": what to do and for whom. */
export const forPet = (what: string, name: string | undefined) => (name ? `${what.trim()} for ${name}` : what.trim());

const nameOf = (pets: Pick<Pet, 'id' | 'name'>[], id: string) => pets.find((p) => p.id === id)?.name;

/**
 * Everything due now or past due, across all pets: today's doses and meals not yet given whose time
 * has come (or comes within `DUE_NOW_MINUTES`), and care reminders overdue or due today. Late ones
 * first, most overdue first; then the rest by when they fall due.
 */
export function needsDoing(data: TodayData, pets: Pet[], now: number): Need[] {
  const today = toYmd(now);
  const soon = now + DUE_NOW_MINUTES * MINUTE;
  const out: Need[] = [];
  for (const pet of pets) {
    for (const c of data.courses.filter((x) => x.petId === pet.id)) {
      for (const { slot, status } of dosesOn(c, data.medDoses, today, now)) {
        if (isHandled(status) || status.at > soon) continue;
        out.push({ kind: 'dose', key: `dose:${c.id}:${slot}`, petId: pet.id, course: c, slot, title: forPet(c.name, pet.name), when: timedWhen(status.at, now), late: status.state === 'missed', since: status.at, action: 'Given' });
      }
    }
    for (const { meal, status } of mealsOn(data.meals, data.feedings, pet.id, now, now)) {
      if (status.state === 'fed' || status.at > soon) continue;
      const late = status.state === 'late';
      out.push({ kind: 'meal', key: `meal:${meal.id}`, petId: pet.id, meal, title: late ? `Not fed yet: ${pet.name} ${meal.name}` : `${pet.name}'s ${meal.name} meal`, when: timedWhen(status.at, now), late, since: status.at, action: 'Fed' });
    }
  }
  for (const r of data.reminders) {
    const name = nameOf(pets, r.petId);
    if (!name) continue;
    const state = dueState(r, now);
    if (state !== 'overdue' && state !== 'today') continue;
    out.push({ kind: 'care', key: `care:${r.id}`, petId: r.petId, reminder: r, title: forPet(r.title, name), when: dueText(r.due, today), late: state === 'overdue', since: parseYmd(r.due) ?? startOfDay(now), action: r.kind === 'other' ? 'Done' : 'Given' });
  }
  return out.sort((a, b) => Number(b.late) - Number(a.late) || a.since - b.since || a.title.localeCompare(b.title));
}

export interface LaterItem {
  key: string;
  kind: 'dose' | 'meal' | 'appointment';
  at: number;
  /** "6:00 PM". */
  time: string;
  /** "Antibiotic for Biscuit", "Biscuit's PM meal", "PM meal for Biscuit and Miso", "Ear check for Biscuit". */
  title: string;
  petIds: string[];
  appointment?: Appointment;
}

/**
 * The rest of today, by time: doses and meals not yet due (past the "needs doing" window), and
 * appointments still to come. Meals of the same name at the same time are one line.
 */
export function laterToday(data: TodayData, pets: Pet[], now: number): LaterItem[] {
  const today = toYmd(now);
  const soon = now + DUE_NOW_MINUTES * MINUTE;
  const out: LaterItem[] = [];
  const meals = new Map<string, { at: number; name: string; petIds: string[] }>();
  for (const pet of pets) {
    for (const c of data.courses.filter((x) => x.petId === pet.id)) {
      for (const { slot, status } of dosesOn(c, data.medDoses, today, now)) {
        if (status.state !== 'due' || status.at <= soon) continue;
        out.push({ key: `dose:${c.id}:${slot}`, kind: 'dose', at: status.at, time: formatTime(status.at), title: forPet(c.name, pet.name), petIds: [pet.id] });
      }
    }
    for (const { meal, status } of mealsOn(data.meals, data.feedings, pet.id, now, now)) {
      if (status.state !== 'due' || status.at <= soon) continue;
      const k = `${meal.name.trim().toLowerCase()}@${status.at}`;
      const group = meals.get(k);
      if (group) group.petIds.push(pet.id);
      else meals.set(k, { at: status.at, name: meal.name.trim(), petIds: [pet.id] });
    }
  }
  for (const [k, g] of meals) {
    const title = g.petIds.length === 1 ? `${nameOf(pets, g.petIds[0])}'s ${g.name} meal` : `${g.name} meal for ${petNames(g.petIds, pets)}`;
    out.push({ key: `meal:${k}`, kind: 'meal', at: g.at, time: formatTime(g.at), title, petIds: g.petIds });
  }
  for (const a of data.appointments) {
    if (a.at < now || toYmd(a.at) !== today) continue;
    const who = petNames(a.petIds, pets);
    out.push({ key: `appointment:${a.id}`, kind: 'appointment', at: a.at, time: formatTime(a.at), title: forPet(a.title, who || undefined), petIds: a.petIds, appointment: a });
  }
  return out.sort((a, b) => a.at - b.at || a.title.localeCompare(b.title));
}

/** "All done for now · next: Biscuit's PM meal at 7:00 PM", or "All done for today". */
export function allDoneLine(later: LaterItem[]): string {
  const next = later[0];
  return next ? `All done for now · next: ${next.title} at ${next.time}` : 'All done for today';
}

export interface ComingItem {
  key: string;
  kind: 'care' | 'appointment' | 'birthday';
  /** Local midnight of its day, for the order. */
  day: number;
  /** "Heartworm prevention due in 3 days", "Yearly check-up", "Miso's birthday in 3 weeks". */
  title: string;
  /** "Biscuit", "In 6 days · 9:30 AM · Biscuit", "Turns 2 on June 4". */
  detail: string;
  petIds: string[];
  reminder?: Reminder;
  appointment?: Appointment;
}

/** How far ahead Coming up lists appointments. */
export const APPOINTMENT_AHEAD_DAYS = 14;

/**
 * After today: care due soon, appointments in the next two weeks, and birthdays within three months
 * (months, then weeks, then days away), soonest first.
 */
export function comingUp(data: Pick<TodayData, 'reminders' | 'appointments'>, pets: Pet[], now: number): ComingItem[] {
  const out: ComingItem[] = [];
  for (const r of data.reminders) {
    const name = nameOf(pets, r.petId);
    if (!name || dueState(r, now) !== 'soon') continue;
    out.push({ key: `care:${r.id}`, kind: 'care', day: parseYmd(r.due)!, title: headline(r, now), detail: name, petIds: [r.petId], reminder: r });
  }
  for (const a of data.appointments) {
    const days = daysBetween(now, a.at);
    if (days < 1 || days > APPOINTMENT_AHEAD_DAYS) continue;
    const who = petNames(a.petIds, pets);
    out.push({ key: `appointment:${a.id}`, kind: 'appointment', day: startOfDay(a.at), title: a.title, detail: [relativeDay(a.at, now), formatTime(a.at), who].filter(Boolean).join(' · '), petIds: a.petIds, appointment: a });
  }
  for (const pet of pets) {
    const c = birthdayCountdown(pet.birthDate, now, pet.birthDateApprox);
    if (!c || c.days === 0) continue;
    out.push({ key: `birthday:${pet.id}`, kind: 'birthday', day: parseYmd(c.date)!, title: birthdayLine(pet.name, c), detail: turnsOn(c), petIds: [pet.id] });
  }
  return out.sort((a, b) => a.day - b.day || a.title.localeCompare(b.title));
}

/** Pets whose birthday is today, with the age it brings. */
export function birthdaysToday(pets: Pet[], now: number): { pet: Pet; countdown: BirthdayCountdown }[] {
  return pets.flatMap((pet) => {
    const countdown = birthdayCountdown(pet.birthDate, now, pet.birthDateApprox);
    return countdown?.days === 0 ? [{ pet, countdown }] : [];
  });
}

/** "Happy birthday, Biscuit!" and "Biscuit turns 4 today": the one line in the suite allowed an exclamation mark (DESIGN.md, Celebrations). */
export const celebrationTitle = (name: string) => `Happy birthday, ${name}!`;
export const celebrationLine = (name: string, turns: number) => `${name} turns ${turns} today`;
