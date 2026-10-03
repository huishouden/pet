import { describe, expect, test } from 'bun:test';
import fixture from './__fixtures__/schedule.json';
import {
  addInterval,
  byUrgency,
  describeRecurrence,
  dueState,
  dueText,
  groupByDue,
  headline,
  inWords,
  lowerFirst,
  markGiven,
  needsAttention,
  type Scheduled,
  type Unit,
} from './schedule';
import { parseYmd } from '@huishouden/pwa-kit/time';

const now = new Date(fixture.now).getTime();
type Case = (typeof fixture.states)[number];
const toScheduled = (c: Case): Scheduled & { title: string } => ({
  title: c.title,
  due: c.due,
  ...('every' in c ? { every: c.every, unit: c.unit as Unit } : {}),
  ...('lastDoneAt' in c && c.lastDoneAt ? { lastDoneAt: new Date(c.lastDoneAt).getTime() } : {}),
});

describe('intervals', () => {
  for (const c of fixture.intervals)
    test(`${c.from} + ${c.every} ${c.unit}`, () => expect(addInterval(c.from, c.every, c.unit as Unit)).toBe(c.to));

  test('a malformed date is refused', () => expect(() => addInterval('2031-02-30', 1, 'day')).toThrow());
});

describe('due states and wording', () => {
  for (const c of fixture.states) {
    test(`${c.title} due ${c.due}`, () => {
      const s = toScheduled(c);
      expect(dueState(s, now)).toBe(c.state as ReturnType<typeof dueState>);
      expect(dueText(s, now)).toBe(c.text);
      expect(headline(s, now)).toBe(c.headline);
    });
  }

  test('distances people use', () => {
    expect([0, 1, 2, 20, 21, 59, 60, 400].map(inWords)).toEqual([
      'today',
      'tomorrow',
      'in 2 days',
      'in 20 days',
      'in 3 weeks',
      'in 8 weeks',
      'in 1 month',
      'in 13 months',
    ]);
  });

  test('acronyms keep their capitals after "Overdue:"', () => {
    expect(lowerFirst('FVRCP vaccine')).toBe('FVRCP vaccine');
    expect(lowerFirst('Flea and tick')).toBe('flea and tick');
  });

  test('recurrence in words', () => {
    expect(describeRecurrence({ every: 1, unit: 'month' })).toBe('Every month');
    expect(describeRecurrence({ every: 3, unit: 'month' })).toBe('Every 3 months');
    expect(describeRecurrence({ every: 1, unit: 'year' })).toBe('Every year');
    expect(describeRecurrence({})).toBe('Once');
    expect(describeRecurrence({ every: 0, unit: 'day' })).toBe('Once');
  });
});

describe('giving a dose', () => {
  const at = new Date('2031-05-14T08:15:00').getTime();

  test('the next due date counts from the day it was given, even when late', () => {
    expect(markGiven({ due: '2031-05-12', every: 1, unit: 'month' }, at)).toEqual({ lastDoneAt: at, due: '2031-06-14' });
  });

  test('given early, the next one is still a full interval later', () => {
    expect(markGiven({ due: '2031-05-20', every: 2, unit: 'week' }, at)).toEqual({ lastDoneAt: at, due: '2031-05-28' });
  });

  test('a one-off is finished and keeps its date', () => {
    const next = markGiven({ due: '2031-05-20' }, at);
    expect(next).toEqual({ lastDoneAt: at, due: '2031-05-20' });
    expect(dueState(next, now)).toBe('done');
  });

  test('the time of day does not move the date', () => {
    const late = new Date('2031-05-14T23:59:00').getTime();
    expect(markGiven({ due: '2031-05-14', every: 1, unit: 'day' }, late).due).toBe('2031-05-15');
  });
});

describe('ordering and groups', () => {
  const all = fixture.states.map(toScheduled);

  test('most urgent first; finished one-offs last', () => {
    const order = byUrgency(all, now).map((s) => s.title);
    expect(order.slice(0, 3)).toEqual(['FVRCP booster', 'Flea and tick', 'Heartworm prevention']);
    expect(order.at(-1)).toBe('Ear drops');
  });

  test('attention is overdue, today and soon only', () => {
    const titles = needsAttention(all, now).map((s) => `${s.title} ${s.due}`);
    expect(titles).toEqual([
      'FVRCP booster 2031-05-01',
      'Flea and tick 2031-05-12',
      'Heartworm prevention 2031-05-13',
      'Kidney supplement 2031-05-14',
      'Heartworm prevention 2031-05-15',
      'Daily tablet 2031-05-16',
      'Heartworm 2031-05-17',
      'Stitches out 2031-05-20',
      'Rabies vaccine 2031-06-10',
    ]);
  });

  test('groups for the Care screen', () => {
    const groups = groupByDue(all, now);
    expect(groups.map((g) => [g.label, g.items.length])).toEqual([
      ['Overdue', 3],
      ['Due this week', 5],
      ['Later', 3],
      ['Given', 1],
    ]);
    for (const s of groups[1].items) expect(parseYmd(s.due)).not.toBeNull();
  });
});

describe('dismissed', () => {
  const overdue = { title: 'Flea and tick', due: '2031-05-01', every: 1, unit: 'month' as Unit };
  const dismissed = { ...overdue, dismissedAt: now - 1000 };

  test('never due: its own state and words, not in attention, last in order, in its own group', () => {
    expect(dueState(dismissed, now)).toBe('dismissed');
    expect(dueText(dismissed, now)).toBe('Dismissed');
    expect(headline(dismissed, now)).toBe('Flea and tick dismissed');
    expect(needsAttention([dismissed, overdue], now)).toEqual([overdue]);
    expect(byUrgency([dismissed, overdue], now)).toEqual([overdue, dismissed]);
    expect(groupByDue([dismissed, overdue], now).map((g) => [g.label, g.items.length])).toEqual([
      ['Overdue', 1],
      ['Dismissed', 1],
    ]);
  });
});

