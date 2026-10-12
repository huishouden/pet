import { useEffect, useState } from 'react';
import { dosesRead } from '../lib/courses';
import type { Course, MedDose } from '../lib/model';
import type { PetStore } from './types';

/**
 * Where a course's doses are: the store's window when it reaches back to the course
 * (`dosesRead`), else the course's own listener (`followed`, once it has answered for this
 * course). Null while that listener hasn't answered: nothing to show or act on yet.
 */
export function courseDoseSource(course: Pick<Course, 'id' | 'startDate'>, from: number, store: MedDose[], followed: { id: string; doses: MedDose[] } | null): MedDose[] | null {
  if (dosesRead(course, from)) return store;
  return followed?.id === course.id ? followed.doses : null;
}

/** A course's doses for its log (see `courseDoseSource`); follows an older course's own while open. */
export function useCourseDoses(store: PetStore, course: Course | undefined): MedDose[] | null {
  const own = course && !dosesRead(course, store.medDosesFrom) ? course.id : null;
  const [followed, setFollowed] = useState<{ id: string; doses: MedDose[] } | null>(null);
  const { watchCourseDoses } = store;
  useEffect(() => (own ? watchCourseDoses(own, (doses) => setFollowed({ id: own, doses })) : undefined), [own, watchCourseDoses]);
  return course ? courseDoseSource(course, store.medDosesFrom, store.data.medDoses, followed) : null;
}
