export interface CourseCatalogEntry {
  id: string;
  data: {
    catalogOrder: number;
  };
}

function duplicateCatalogOrderErrors(courses: readonly CourseCatalogEntry[]): string[] {
  const coursesByOrder = new Map<number, string[]>();

  for (const course of courses) {
    const matchingCourses = coursesByOrder.get(course.data.catalogOrder) ?? [];
    matchingCourses.push(course.id);
    coursesByOrder.set(course.data.catalogOrder, matchingCourses);
  }

  return [...coursesByOrder]
    .filter(([, courseIds]) => courseIds.length > 1)
    .sort(([left], [right]) => left - right)
    .map(([catalogOrder, courseIds]) =>
      `duplicate catalogOrder ${catalogOrder}; conflicting courses: ${courseIds.toSorted().join(', ')}`,
    );
}

export function orderCoursesForCatalog<T extends CourseCatalogEntry>(courses: readonly T[]): T[] {
  const errors = duplicateCatalogOrderErrors(courses);
  if (errors.length > 0) {
    throw new Error(`Invalid course catalogue order:\n${errors.join('\n')}`);
  }

  return courses.toSorted((left, right) => right.data.catalogOrder - left.data.catalogOrder);
}
