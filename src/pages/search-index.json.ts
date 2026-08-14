import { getCollection, getEntry } from 'astro:content';
import type { APIRoute } from 'astro';
import { coursePath, lessonPath, markdownToPlainText } from '../lib/content';
import type { SearchDocument } from '../lib/search';

export const GET: APIRoute = async () => {
  const [courses, lessons] = await Promise.all([getCollection('courses'), getCollection('lessons')]);

  const courseDocuments: SearchDocument[] = courses.map((course) => ({
    id: course.id,
    kind: 'course',
    title: course.data.title,
    description: course.data.description,
    tags: course.data.tags,
    body: markdownToPlainText(course.body ?? ''),
    url: coursePath(import.meta.env.BASE_URL, course.id),
  }));

  const lessonDocuments: SearchDocument[] = await Promise.all(lessons.map(async (lesson) => {
    const courseId = lesson.id.split('/')[0];
    if (!courseId) throw new Error(`Lesson ${lesson.id} has no parent course ID`);
    const parent = await getEntry('courses', courseId);
    if (!parent) throw new Error(`Lesson ${lesson.id} has no matching course`);
    return {
      id: lesson.id,
      kind: 'lesson',
      title: lesson.data.title,
      description: lesson.data.description,
      tags: lesson.data.tags,
      body: markdownToPlainText(lesson.body ?? ''),
      url: lessonPath(import.meta.env.BASE_URL, lesson.id),
      context: parent.data.title,
    };
  }));

  return new Response(JSON.stringify([...courseDocuments, ...lessonDocuments]), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
