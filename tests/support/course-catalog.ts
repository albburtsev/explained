const courseSources: Record<string, string> = import.meta.glob<string>(
  '../../knowledge/courses/*.md',
  {
    query: '?raw',
    import: 'default',
    eager: true,
  },
);

export interface RepositoryCourseCatalogRecord {
  path: string;
  slug: string | undefined;
  catalogOrder: number | undefined;
}

function frontmatterValue(markdown: string, key: string): string | undefined {
  const frontmatter = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
  if (frontmatter === undefined) return undefined;

  const value = frontmatter.match(new RegExp(`^${key}:[ \\t]*(.*)$`, 'm'))?.[1]?.trim();
  if (!value) return undefined;

  const quote = value.at(0);
  if ((quote === '"' || quote === "'") && value.at(-1) === quote) return value.slice(1, -1);
  return value;
}

export function loadRepositoryCourseCatalog(): RepositoryCourseCatalogRecord[] {
  return Object.entries(courseSources)
    .map(([path, markdown]) => {
      const rawCatalogOrder = frontmatterValue(markdown, 'catalogOrder');
      return {
        path: path.replace(/^\.\.\/\.\.\//, ''),
        slug: frontmatterValue(markdown, 'slug'),
        catalogOrder: rawCatalogOrder === undefined ? undefined : Number(rawCatalogOrder),
      };
    })
    .toSorted((left, right) => left.path.localeCompare(right.path));
}
