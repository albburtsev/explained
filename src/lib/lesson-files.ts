export interface CourseLessonsRecord {
  path: string;
  slug: string;
  lessons: string[];
}

export function expectedLessonPath(courseSlug: string, lessonSlug: string, position: number, count: number): string {
  const lessonId = lessonSlug.slice(courseSlug.length + 1);
  const number = String(position).padStart(Math.max(2, String(count).length), '0');
  return `knowledge/lessons/${courseSlug}/${number}-${lessonId}.md`;
}

export function lessonFileErrors(courses: CourseLessonsRecord[], lessonPaths: string[]): string[] {
  const errors: string[] = [];
  const existingPaths = new Set(lessonPaths);
  const expectedPaths = new Set<string>();

  for (const course of courses) {
    course.lessons.forEach((lessonSlug, index) => {
      if (!lessonSlug.startsWith(`${course.slug}/`)) return;

      const expectedPath = expectedLessonPath(course.slug, lessonSlug, index + 1, course.lessons.length);
      expectedPaths.add(expectedPath);
      if (!existingPaths.has(expectedPath)) {
        errors.push(`${course.path}: lesson ${JSON.stringify(lessonSlug)} at position ${index + 1} must be stored as ${expectedPath}`);
      }
    });
  }

  for (const path of lessonPaths) {
    if (!expectedPaths.has(path)) {
      errors.push(`${path}: file name does not match a lesson position in its course; expected <NN>-<lesson-id>.md`);
    }
  }

  return errors.toSorted();
}

export function assertValidLessonFiles(courses: CourseLessonsRecord[], lessonPaths: string[]): void {
  const errors = lessonFileErrors(courses, lessonPaths);
  if (errors.length > 0) throw new Error(`Lesson file validation failed:\n- ${errors.join('\n- ')}`);
}
