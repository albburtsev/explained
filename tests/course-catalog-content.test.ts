import { describe, expect, it } from 'vitest';
import { orderCoursesForCatalog } from '../src/lib/course-catalog';
import { loadRepositoryCourseCatalog } from './support/course-catalog';

describe('repository course catalogue metadata', () => {
  it('gives every course a positive integer catalogOrder', () => {
    const invalidPaths = loadRepositoryCourseCatalog()
      .filter(({ catalogOrder }) => !Number.isInteger(catalogOrder) || (catalogOrder ?? 0) <= 0)
      .map(({ path }) => path);

    expect(invalidPaths).toEqual([]);
  });

  it('keeps catalogOrder values unique and preserves the migrated relative order', () => {
    const entries = loadRepositoryCourseCatalog().map(({ path, slug, catalogOrder }) => ({
      id: slug ?? path,
      data: { catalogOrder: catalogOrder ?? Number.NaN },
    }));

    const orderedIds = orderCoursesForCatalog(entries).map(({ id }) => id);
    const migratedIds = orderedIds.filter((id) => ['git', 'openspec', 'vim'].includes(id));

    expect(migratedIds).toEqual(['git', 'openspec', 'vim']);
  });
});
