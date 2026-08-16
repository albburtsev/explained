import { describe, expect, it } from 'vitest';
import { assertValidContentSlugs, contentSlugErrors, type ContentSlugRecord } from '../src/lib/content-slugs';
import { loadRepositoryContentSlugs } from './support/content-slugs';

describe('content slug validation', () => {
  it('accepts valid globally unique slugs', () => {
    const records: ContentSlugRecord[] = [
      { type: 'course', path: 'knowledge/courses/typescript.md', slug: 'typescript' },
      { type: 'lesson', path: 'knowledge/lessons/typescript/types.md', slug: 'typescript/types' },
      {
        type: 'cheatsheet',
        path: 'knowledge/cheatsheets/typescript/reference.md',
        slug: 'typescript/reference-cheatsheet',
      },
    ];

    expect(contentSlugErrors(records)).toEqual([]);
  });

  it('reports a missing slug with its source path', () => {
    const records: ContentSlugRecord[] = [
      { type: 'lesson', path: 'knowledge/lessons/typescript/types.md', slug: undefined },
    ];

    expect(contentSlugErrors(records)).toEqual([
      'knowledge/lessons/typescript/types.md: missing slug; expected 1–64 characters containing lowercase kebab-case segments separated by single slashes',
    ]);
  });

  it('reports a malformed slug and its value', () => {
    const records: ContentSlugRecord[] = [
      { type: 'course', path: 'knowledge/courses/typescript.md', slug: 'TypeScript Basics' },
    ];

    expect(contentSlugErrors(records)).toEqual([
      'knowledge/courses/typescript.md: invalid slug "TypeScript Basics"; expected 1–64 characters containing lowercase kebab-case segments separated by single slashes',
    ]);
  });

  it('reports repeated path separators', () => {
    const records: ContentSlugRecord[] = [
      { type: 'lesson', path: 'knowledge/lessons/typescript/types.md', slug: 'typescript//types' },
    ];

    expect(contentSlugErrors(records)).toEqual([
      'knowledge/lessons/typescript/types.md: invalid slug "typescript//types"; expected 1–64 characters containing lowercase kebab-case segments separated by single slashes',
    ]);
  });

  it('reports an unknown parent course prefix', () => {
    const records: ContentSlugRecord[] = [
      { type: 'course', path: 'knowledge/courses/typescript.md', slug: 'typescript' },
      { type: 'lesson', path: 'knowledge/lessons/typescript/types.md', slug: 'javascript/types' },
    ];

    expect(contentSlugErrors(records)).toEqual([
      'knowledge/lessons/typescript/types.md: lesson slug "javascript/types" begins with unknown course slug "javascript"',
    ]);
  });

  it('reports every path in a cross-type slug collision', () => {
    const records: ContentSlugRecord[] = [
      { type: 'course', path: 'knowledge/courses/shared.md', slug: 'shared' },
      { type: 'lesson', path: 'knowledge/lessons/shared/topic.md', slug: 'shared/topic' },
      { type: 'cheatsheet', path: 'knowledge/cheatsheets/shared/topic.md', slug: 'shared/topic' },
    ];

    expect(contentSlugErrors(records)).toEqual([
      'duplicate slug "shared/topic"; conflicting sources: cheatsheet: knowledge/cheatsheets/shared/topic.md, lesson: knowledge/lessons/shared/topic.md',
    ]);
  });
});

describe('repository content slugs', () => {
  it('keeps every structured content slug valid and globally unique', () => {
    const records = loadRepositoryContentSlugs();
    expect(() => assertValidContentSlugs(records)).not.toThrow();
  });
});
