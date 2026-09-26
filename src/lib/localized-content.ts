import { getCollection, getEntry, type CollectionEntry } from 'astro:content';
import { orderCoursesForCatalog } from './course-catalog';
import type { Locale } from './i18n';

type CourseEntry = CollectionEntry<'courses'>;
type LessonEntry = CollectionEntry<'lessons'>;

export interface LocalizedCourse {
  id: string;
  title: string;
  description: string;
  tags: string[];
  lessonCount: number;
  source: CourseEntry;
  /** The entry whose Markdown body is rendered for this locale. */
  entry: CourseEntry | CollectionEntry<'courseTranslations'>;
}

export interface LocalizedLesson {
  id: string;
  title: string;
  description: string;
  tags: string[];
  source: LessonEntry;
  entry: LessonEntry | CollectionEntry<'lessonTranslations'>;
}

export async function localizeCourse(course: CourseEntry, locale: Locale): Promise<LocalizedCourse> {
  const entry = locale === 'ru' ? await getEntry('courseTranslations', course.id) : course;
  if (!entry) throw new Error(`Course ${course.id} has no ${locale} translation`);

  return {
    id: course.id,
    title: entry.data.title,
    description: entry.data.description,
    tags: course.data.tags,
    lessonCount: course.data.lessons.length,
    source: course,
    entry,
  };
}

export async function localizeLesson(lesson: LessonEntry, locale: Locale): Promise<LocalizedLesson> {
  const entry = locale === 'ru' ? await getEntry('lessonTranslations', lesson.id) : lesson;
  if (!entry) throw new Error(`Lesson ${lesson.id} has no ${locale} translation`);

  return {
    id: lesson.id,
    title: entry.data.title,
    description: entry.data.description,
    tags: lesson.data.tags,
    source: lesson,
    entry,
  };
}

export async function getCatalog(locale: Locale): Promise<LocalizedCourse[]> {
  const courses = orderCoursesForCatalog(await getCollection('courses'));
  return Promise.all(courses.map((course) => localizeCourse(course, locale)));
}

export async function getCourseLessons(course: CourseEntry, locale: Locale): Promise<LocalizedLesson[]> {
  const lessons = await Promise.all(course.data.lessons.map((reference) => getEntry(reference)));
  return Promise.all(lessons.map((lesson) => localizeLesson(lesson, locale)));
}
