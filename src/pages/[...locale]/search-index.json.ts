import { getCollection } from 'astro:content';
import type { APIRoute, GetStaticPaths } from 'astro';
import { coursePath, lessonPath, markdownToPlainText } from '../../lib/content';
import { localeStaticPaths, type Locale } from '../../lib/i18n';
import { getCatalog, getCourseLessons } from '../../lib/localized-content';
import type { SearchDocument } from '../../lib/search';

export const getStaticPaths = (() => localeStaticPaths()) satisfies GetStaticPaths;

export const GET: APIRoute<{ locale: Locale }> = async ({ props: { locale } }) => {
  const base = import.meta.env.BASE_URL;
  const courses = await getCatalog(locale);
  const lessonSources = new Set((await getCollection('lessons')).map((lesson) => lesson.id));

  const documents: SearchDocument[] = [];
  for (const course of courses) {
    documents.push({
      id: course.id,
      kind: 'course',
      title: course.title,
      description: course.description,
      tags: course.tags,
      body: markdownToPlainText(course.entry.body ?? ''),
      url: coursePath(base, course.id, locale),
    });

    for (const lesson of await getCourseLessons(course.source, locale)) {
      lessonSources.delete(lesson.id);
      documents.push({
        id: lesson.id,
        kind: 'lesson',
        title: lesson.title,
        description: lesson.description,
        tags: lesson.tags,
        body: markdownToPlainText(lesson.entry.body ?? ''),
        url: lessonPath(base, lesson.id, locale),
        context: course.title,
      });
    }
  }

  if (lessonSources.size > 0) throw new Error(`Lessons without a course: ${[...lessonSources].join(', ')}`);

  return new Response(JSON.stringify(documents), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
