import type { CourseLessonsRecord } from '../../src/lib/lesson-files';

const courseSources: Record<string, string> = import.meta.glob<string>(['../../knowledge/courses/*.md', '!**/*.ru.md'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

const lessonSources = import.meta.glob(['../../knowledge/lessons/**/*.md', '!**/*.ru.md']);

function repositoryPath(path: string): string {
  return path.replace(/^\.\.\/\.\.\//, '');
}

function unquoted(value: string): string {
  const quote = value.at(0);
  if ((quote === '"' || quote === "'") && value.at(-1) === quote) return value.slice(1, -1);
  return value;
}

function courseLessons(path: string, markdown: string): CourseLessonsRecord {
  const frontmatter = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1] ?? '';
  const slug = frontmatter.match(/^slug:[ \t]*(.*)$/m)?.[1]?.trim() ?? '';
  const lessonsBlock = frontmatter.match(/^lessons:[ \t]*\r?\n((?:[ \t]+-[^\n]*\r?\n?)*)/m)?.[1] ?? '';
  const lessons = [...lessonsBlock.matchAll(/^[ \t]+-[ \t]*(.*?)[ \t]*$/gm)].map((match) => unquoted(match[1] ?? ''));

  return { path: repositoryPath(path), slug: unquoted(slug), lessons };
}

export function loadRepositoryCourseLessons(): CourseLessonsRecord[] {
  return Object.entries(courseSources)
    .map(([path, markdown]) => courseLessons(path, markdown))
    .toSorted((left, right) => left.path.localeCompare(right.path));
}

export function loadRepositoryLessonPaths(): string[] {
  return Object.keys(lessonSources).map(repositoryPath).toSorted();
}
