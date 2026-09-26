import { describe, expect, it } from 'vitest';
import {
  coursePath,
  coursesPath,
  homePath,
  lessonPath,
  markdownToPlainText,
  normalizeBase,
  searchIndexPath,
} from '../src/lib/content';

describe('content helpers', () => {
  it('extracts searchable text from Markdown', () => {
    const markdown = '# Hello, **world!**\n\n- Run `node app.ts`.\n- [Read more](https://example.com).';
    expect(markdownToPlainText(markdown)).toBe('Hello, world! Run node app.ts. Read more.');
  });

  it('extracts searchable text from a details block', () => {
    const markdown = ':::details[Why it matters]\nThe Service keeps the result.\n:::';
    expect(markdownToPlainText(markdown)).toBe('Why it matters The Service keeps the result.');
  });

  it('builds GitHub Pages-aware routes', () => {
    expect(normalizeBase('/explained/')).toBe('/explained');
    expect(normalizeBase('/')).toBe('');
    expect(coursePath('/explained/', 'openspec')).toBe('/explained/courses/openspec/');
    expect(lessonPath('/explained/', 'openspec/introduction')).toBe(
      '/explained/courses/openspec/introduction/',
    );
    expect(coursePath('/', 'openspec')).toBe('/courses/openspec/');
  });

  it('prefixes routes of the non-default locale', () => {
    expect(homePath('/explained/', 'en')).toBe('/explained/');
    expect(homePath('/explained/', 'ru')).toBe('/explained/ru/');
    expect(coursesPath('/explained/', 'ru')).toBe('/explained/ru/courses/');
    expect(coursePath('/explained/', 'openspec', 'ru')).toBe('/explained/ru/courses/openspec/');
    expect(lessonPath('/explained/', 'openspec/introduction', 'ru')).toBe(
      '/explained/ru/courses/openspec/introduction/',
    );
    expect(searchIndexPath('/explained/', 'en')).toBe('/explained/search-index.json');
    expect(searchIndexPath('/', 'ru')).toBe('/ru/search-index.json');
  });
});
