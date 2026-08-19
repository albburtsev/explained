import { describe, expect, it } from 'vitest';
import { orderCoursesForCatalog } from '../src/lib/course-catalog';

function course(id: string, title: string, catalogOrder: number) {
  return { id, data: { title, catalogOrder } };
}

describe('course catalogue ordering', () => {
  it('sorts by catalogOrder instead of title without mutating the input', () => {
    const courses = [
      course('zebra', 'Zebra', 20),
      course('alpha', 'Alpha', 30),
      course('middle', 'Middle', 10),
    ];
    const originalOrder = [...courses];

    const orderedCourses = orderCoursesForCatalog(courses);

    expect(orderedCourses.map(({ id }) => id)).toEqual(['middle', 'zebra', 'alpha']);
    expect(courses).toEqual(originalOrder);
    expect(orderedCourses).not.toBe(courses);
  });

  it('reports every course in every duplicate catalogOrder group', () => {
    const courses = [
      course('beta', 'Beta', 10),
      course('alpha', 'Alpha', 10),
      course('delta', 'Delta', 20),
      course('gamma', 'Gamma', 20),
    ];

    expect(() => orderCoursesForCatalog(courses)).toThrow(
      [
        'Invalid course catalogue order:',
        'duplicate catalogOrder 10; conflicting courses: alpha, beta',
        'duplicate catalogOrder 20; conflicting courses: delta, gamma',
      ].join('\n'),
    );
  });
});
