// What the signed-in person may do in Pet, from their household role (@huishouden/pwa-kit/roles).
// The rules enforce all of it; the app leaves out what a role can't do and says why where someone
// would look for it. Pure, so it is unit-tested.

import { can, mayGive, refusal, type Role } from '@huishouden/pwa-kit/roles';
import type { Course } from './model';

export interface PetPermissions {
  role: Role | null;
  /** Change or delete this record: admins and members always, helpers and kids only their own. */
  mayChange(record: { by?: string }): boolean;
  /** Medicine courses, and who may give them: admins and members. */
  managesCourses: boolean;
  /** Mark a care reminder given (it logs a dose): never a kid. */
  givesCare: boolean;
  /** Give a dose of this course. */
  mayGiveCourse(course: Course): boolean;
  /** Offer "Only admins and members" on contacts and appointments. */
  seesPrivate: boolean;
  /** The sentence for a dose this person may not give. */
  courseRefusal(course: Course): string;
}

export const COURSE_REFUSAL = 'Only admins and members can set up medicine courses.';

export function permissions(role: Role | null, me: string): PetPermissions {
  return {
    role,
    mayChange: (record) => can(role, 'edit-others') || (!!record.by && record.by === me),
    managesCourses: can(role, 'change-settings'),
    givesCare: can(role, 'give-medicine'),
    mayGiveCourse: (course) => mayGive(course, role, me),
    seesPrivate: can(role, 'see-private'),
    courseRefusal: (course) => (can(role, 'give-medicine') ? `Only approved helpers can give ${course.name}.` : refusal('give-medicine')),
  };
}
