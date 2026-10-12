import { describe, expect, test } from 'bun:test';
import { courseDoseSource } from './courseDoses';
import type { MedDose } from '../lib/model';

const dose = (id: string, courseId: string) => ({ id, courseId, petId: 'rex', slot: 0, at: 0, by: 'sam@example.com', createdAt: 0 }) as MedDose;
const store = [dose('s1', 'abx')];
const from = new Date(2031, 3, 1).getTime();

describe('where a course log reads its doses', () => {
  test("a course the store's window reaches: the store's doses", () => {
    expect(courseDoseSource({ id: 'abx', startDate: '2031-05-10' }, from, store, null)).toBe(store);
  });
  test("an older course: its own listener's doses once they are in, never the store's", () => {
    const own = [dose('h1', 'heart'), dose('h2', 'heart')];
    expect(courseDoseSource({ id: 'heart', startDate: '2031-01-10' }, from, store, null)).toBeNull();
    // Switching from one older course's log to another: the first one's doses are not this one's.
    expect(courseDoseSource({ id: 'heart', startDate: '2031-01-10' }, from, store, { id: 'other', doses: [dose('o1', 'other')] })).toBeNull();
    expect(courseDoseSource({ id: 'heart', startDate: '2031-01-10' }, from, store, { id: 'heart', doses: own })).toBe(own);
  });
});
