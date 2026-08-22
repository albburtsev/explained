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

  it('keeps catalogOrder values unique', () => {
    const entries = loadRepositoryCourseCatalog().map(({ path, slug, catalogOrder }) => ({
      id: slug ?? path,
      data: { catalogOrder: catalogOrder ?? Number.NaN },
    }));

    expect(() => orderCoursesForCatalog(entries)).not.toThrow();
  });
});
