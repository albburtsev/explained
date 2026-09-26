import type { FrontmatterRecord } from '../../src/lib/content-translations';

const markdownSources: Record<string, string> = import.meta.glob<string>('../../knowledge/{courses,lessons,cheatsheets}/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

function unquoted(value: string): string {
  const quote = value.at(0);
  if ((quote === '"' || quote === "'") && value.at(-1) === quote) return value.slice(1, -1);
  return value;
}

function frontmatterRecord(path: string, markdown: string): FrontmatterRecord {
  const frontmatter = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1] ?? '';
  const fields = Object.fromEntries(
    [...frontmatter.matchAll(/^([A-Za-z][\w-]*):[ \t]*(.*)$/gm)].map((match) => [
      match[1] ?? '',
      unquoted(match[2]?.trim() ?? ''),
    ]),
  );

  return { path: path.replace(/^\.\.\/\.\.\//, ''), fields };
}

function loadRecords(isTranslation: boolean): FrontmatterRecord[] {
  return Object.entries(markdownSources)
    .filter(([path]) => path.endsWith('.ru.md') === isTranslation)
    .map(([path, markdown]) => frontmatterRecord(path, markdown))
    .toSorted((left, right) => left.path.localeCompare(right.path));
}

export function loadRepositorySources(): FrontmatterRecord[] {
  return loadRecords(false);
}

export function loadRepositoryTranslations(): FrontmatterRecord[] {
  return loadRecords(true);
}
