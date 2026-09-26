import { describe, expect, it } from 'vitest';
import {
  assertValidContentTranslations,
  contentTranslationErrors,
  type FrontmatterRecord,
} from '../src/lib/content-translations';
import { loadRepositorySources, loadRepositoryTranslations } from './support/content-translations';

const sources: FrontmatterRecord[] = [
  {
    path: 'knowledge/courses/typescript.md',
    fields: { slug: 'typescript', title: 'TypeScript', description: 'Learn TypeScript.', catalogOrder: '10', lessons: '' },
  },
  {
    path: 'knowledge/lessons/typescript/01-types.md',
    fields: { slug: 'typescript/types', title: 'Types', description: 'Learn types.', tags: '' },
  },
];

function translation(path: string, fields: Record<string, string>): FrontmatterRecord {
  return { path, fields };
}

describe('content translation validation', () => {
  it('accepts translations that mirror their English source', () => {
    const translations = [
      translation('knowledge/courses/typescript.ru.md', {
        slug: 'typescript',
        title: 'TypeScript',
        description: 'Изучите TypeScript.',
      }),
      translation('knowledge/lessons/typescript/01-types.ru.md', {
        slug: 'typescript/types',
        title: 'Типы',
        description: 'Изучите типы.',
      }),
    ];

    expect(contentTranslationErrors(sources, translations)).toEqual([]);
  });

  it('reports an English source without a translation', () => {
    expect(contentTranslationErrors(sources, [])).toEqual([
      'knowledge/courses/typescript.md: missing Russian translation knowledge/courses/typescript.ru.md',
      'knowledge/lessons/typescript/01-types.md: missing Russian translation knowledge/lessons/typescript/01-types.ru.md',
    ]);
  });

  it('reports a translation without an English source', () => {
    const translations = [
      translation('knowledge/lessons/typescript/02-types.ru.md', {
        slug: 'typescript/types',
        title: 'Типы',
        description: 'Изучите типы.',
      }),
    ];

    expect(contentTranslationErrors([], translations)).toEqual([
      'knowledge/lessons/typescript/02-types.ru.md: translation has no English source at knowledge/lessons/typescript/02-types.md',
    ]);
  });

  it('reports a slug that differs from the English source', () => {
    const translations = [
      translation('knowledge/lessons/typescript/01-types.ru.md', {
        slug: 'typescript/tipy',
        title: 'Типы',
        description: 'Изучите типы.',
      }),
    ];

    expect(contentTranslationErrors(sources.slice(1), translations)).toEqual([
      'knowledge/lessons/typescript/01-types.ru.md: slug "typescript/tipy" must match English source slug "typescript/types"',
    ]);
  });

  it('reports missing translated fields and structural metadata', () => {
    const translations = [
      translation('knowledge/courses/typescript.ru.md', {
        slug: 'typescript',
        title: '',
        catalogOrder: '10',
        lessons: '',
        tags: '',
      }),
    ];

    expect(contentTranslationErrors(sources.slice(0, 1), translations)).toEqual([
      'knowledge/courses/typescript.ru.md: catalogOrder belongs only in the English source knowledge/courses/typescript.md',
      'knowledge/courses/typescript.ru.md: lessons belongs only in the English source knowledge/courses/typescript.md',
      'knowledge/courses/typescript.ru.md: missing description',
      'knowledge/courses/typescript.ru.md: missing title',
      'knowledge/courses/typescript.ru.md: tags belongs only in the English source knowledge/courses/typescript.md',
    ]);
  });
});

describe('repository content translations', () => {
  it('mirrors every translation from its English source', () => {
    expect(() => assertValidContentTranslations(loadRepositorySources(), loadRepositoryTranslations())).not.toThrow();
  });
});
