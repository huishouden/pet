import { describe, expect, test } from 'bun:test';
import { permissions } from './permissions';
import type { Course } from './model';

const course = (extra: Partial<Course> = {}): Course => ({
  id: 'k1', petId: 'p1', name: 'Antibiotic', dose: '1 tablet', timesPerDay: 1, times: ['09:00'], startDate: '2031-05-12', days: 7, withFood: true, createdAt: 1, by: 'sam@example.com', ...extra,
});
const JO = 'jo@example.com';

describe('permissions', () => {
  test('admins and members change anything; helpers and kids only their own', () => {
    expect(permissions('member', 'alex@example.com').mayChange({ by: 'sam@example.com' })).toBe(true);
    expect(permissions('helper', JO).mayChange({ by: 'sam@example.com' })).toBe(false);
    expect(permissions('helper', JO).mayChange({ by: JO })).toBe(true);
    expect(permissions('kid', JO).mayChange({})).toBe(false);
  });

  test('only admins and members set up courses and mark things private', () => {
    expect(permissions('admin', 'sam@example.com').managesCourses).toBe(true);
    expect(permissions('helper', JO).managesCourses).toBe(false);
    expect(permissions('helper', JO).seesPrivate).toBe(false);
  });

  test('a restricted course: approved helpers only, and kids never give medicine', () => {
    const restricted = course({ givers: 'approved', approvedHelpers: ['other@example.com'] });
    expect(permissions('helper', JO).mayGiveCourse(course())).toBe(true);
    expect(permissions('helper', JO).mayGiveCourse(restricted)).toBe(false);
    expect(permissions('helper', JO).courseRefusal(restricted)).toBe('Only approved helpers can give Antibiotic.');
    expect(permissions('helper', 'other@example.com').mayGiveCourse(restricted)).toBe(true);
    expect(permissions('kid', JO).mayGiveCourse(course())).toBe(false);
    expect(permissions('kid', JO).givesCare).toBe(false);
    expect(permissions('kid', JO).courseRefusal(course())).toBe('Only admins, members and helpers can give medicine.');
    expect(permissions('member', 'alex@example.com').mayGiveCourse(restricted)).toBe(true);
  });
});
