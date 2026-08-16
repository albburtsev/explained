import type { ContentSlugRecord, ContentType } from '../../src/lib/content-slugs';

const markdownSources: Record<string, string> = {
  ...import.meta.glob<string>('../../knowledge/courses/**/*.md', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
  ...import.meta.glob<string>('../../knowledge/lessons/**/*.md', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
  ...import.meta.glob<string>('../../knowledge/cheatsheets/**/*.md', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
};

function contentType(path: string): ContentType {
  if (path.includes('/courses/')) return 'course';
  if (path.includes('/lessons/')) return 'lesson';
  if (path.includes('/cheatsheets/')) return 'cheatsheet';
  throw new Error(`Unsupported structured content path: ${path}`);
}

function frontmatterSlug(markdown: string): string | undefined {
  const frontmatter = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
  if (frontmatter === undefined) return undefined;

  const matchedValue = frontmatter.match(/^slug:[ \t]*(.*)$/m)?.[1];
  if (matchedValue === undefined) return undefined;

  const value = matchedValue.trim();
  const quote = value.at(0);
  if ((quote === '"' || quote === "'") && value.at(-1) === quote) return value.slice(1, -1);
  return value;
}

export function loadRepositoryContentSlugs(): ContentSlugRecord[] {
  return Object.entries(markdownSources)
    .map(([path, markdown]) => ({
      type: contentType(path),
      path: path.replace(/^\.\.\/\.\.\//, ''),
      slug: frontmatterSlug(markdown),
    }))
    .toSorted((left, right) => left.path.localeCompare(right.path));
}
