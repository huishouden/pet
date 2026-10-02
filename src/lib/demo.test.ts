import { expect, test } from 'bun:test';
import { DEMO_NOW, demoData } from './demo';
import { dueState, needsAttention, headline } from './schedule';
import { trend } from './weight';
import { isYmd } from './time';

test('the sample day is in 2031 and the care list leads with an overdue flea treatment', () => {
  expect(new Date(DEMO_NOW).getFullYear()).toBe(2031);
  const d = demoData();
  const attention = needsAttention(d.reminders, DEMO_NOW);
  expect(headline(attention[0], DEMO_NOW)).toBe('Overdue: flea and tick');
  expect(attention.map((r) => headline(r, DEMO_NOW))).toContain('Heartworm prevention due in 3 days');
  expect(d.reminders.some((r) => dueState(r, DEMO_NOW) === 'done')).toBe(true);
});

test('sample data is invented and self-consistent', () => {
  const d = demoData();
  const petIds = new Set(d.pets.map((p) => p.id));
  const reminderIds = new Set(d.reminders.map((r) => r.id));
  const contactIds = new Set(d.contacts.map((c) => c.id));
  for (const x of [...d.reminders, ...d.doses, ...d.weights, ...d.records]) expect(petIds.has(x.petId)).toBe(true);
  for (const dose of d.doses) expect(reminderIds.has(dose.reminderId)).toBe(true);
  for (const a of d.appointments) {
    for (const id of a.petIds) expect(petIds.has(id)).toBe(true);
    if (a.contactId) expect(contactIds.has(a.contactId)).toBe(true);
  }
  for (const r of d.reminders) expect(isYmd(r.due)).toBe(true);
  for (const x of [...d.pets, ...d.reminders, ...d.doses, ...d.appointments, ...d.weights, ...d.records, ...d.contacts]) expect(x.by).toMatch(/@example\.com$/);
  for (const c of d.contacts) {
    expect(c.apps).toContain('pet');
    expect(c.name).toMatch(/^Example /);
    if (c.phone) expect(c.phone).toMatch(/\(555\) 010-01\d\d/);
    if (c.website) expect(new URL(c.website).hostname).toMatch(/example\.com$/);
    if (c.email) expect(c.email).toMatch(/example\.com$/);
  }
  const all = [...Object.values(d)].flat().map((x) => JSON.stringify(x));
  for (const s of all) for (const n of s.match(/\b\d{4}\b(?=-\d{2}-\d{2})/g) ?? []) expect(Number(n)).toBeGreaterThanOrEqual(2027);
});

test('one pet gains and the other loses weight', () => {
  const d = demoData();
  const [biscuit, miso] = d.pets;
  expect(trend(d.weights.filter((w) => w.petId === biscuit.id), 'lb')?.direction).toBe('up');
  expect(trend(d.weights.filter((w) => w.petId === miso.id), 'lb')?.direction).toBe('down');
});
