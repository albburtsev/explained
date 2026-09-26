import { describe, expect, it } from 'vitest';
import { assertValidLessonFiles, lessonFileErrors, type CourseLessonsRecord } from '../src/lib/lesson-files';
import { loadRepositoryCourseLessons, loadRepositoryLessonPaths } from './support/lesson-files';

const course: CourseLessonsRecord = {
  path: 'knowledge/courses/typescript.md',
  slug: 'typescript',
  lessons: ['typescript/types', 'typescript/generics'],
};

describe('lesson file validation', () => {
  it('accepts lesson files numbered by course position', () => {
    const paths = ['knowledge/lessons/typescript/01-types.md', 'knowledge/lessons/typescript/02-generics.md'];

    expect(lessonFileErrors([course], paths)).toEqual([]);
  });

  it('reports lesson files numbered out of course order', () => {
    const paths = ['knowledge/lessons/typescript/01-generics.md', 'knowledge/lessons/typescript/02-types.md'];

    expect(lessonFileErrors([course], paths)).toEqual([
      'knowledge/courses/typescript.md: lesson "typescript/generics" at position 2 must be stored as knowledge/lessons/typescript/02-generics.md',
      'knowledge/courses/typescript.md: lesson "typescript/types" at position 1 must be stored as knowledge/lessons/typescript/01-types.md',
      'knowledge/lessons/typescript/01-generics.md: file name does not match a lesson position in its course; expected <NN>-<lesson-id>.md',
      'knowledge/lessons/typescript/02-types.md: file name does not match a lesson position in its course; expected <NN>-<lesson-id>.md',
    ]);
  });

  it('requires two-digit numbers', () => {
    const paths = ['knowledge/lessons/typescript/1-types.md', 'knowledge/lessons/typescript/02-generics.md'];

    expect(lessonFileErrors([course], paths)).toEqual([
      'knowledge/courses/typescript.md: lesson "typescript/types" at position 1 must be stored as knowledge/lessons/typescript/01-types.md',
      'knowledge/lessons/typescript/1-types.md: file name does not match a lesson position in its course; expected <NN>-<lesson-id>.md',
    ]);
  });

  it('reports lesson files that no course references', () => {
    const paths = [
      'knowledge/lessons/typescript/01-types.md',
      'knowledge/lessons/typescript/02-generics.md',
      'knowledge/lessons/typescript/03-enums.md',
    ];

    expect(lessonFileErrors([course], paths)).toEqual([
      'knowledge/lessons/typescript/03-enums.md: file name does not match a lesson position in its course; expected <NN>-<lesson-id>.md',
    ]);
  });
});

describe('repository lesson files', () => {
  it('numbers every lesson file by its position in the course outline', () => {
    expect(() => assertValidLessonFiles(loadRepositoryCourseLessons(), loadRepositoryLessonPaths())).not.toThrow();
  });
});
