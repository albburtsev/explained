import { describe, expect, it } from 'vitest';
import { coursePath, lessonPath, markdownToPlainText, normalizeBase } from '../src/lib/content';

describe('content helpers', () => {
  it('extracts searchable text from Markdown', () => {
    const markdown = '# Hello, **world!**\n\n- Run `node app.ts`.\n- [Read more](https://example.com).';
    expect(markdownToPlainText(markdown)).toBe('Hello, world! Run node app.ts. Read more.');
  });

  it('builds GitHub Pages-aware routes', () => {
    expect(normalizeBase('/explained/')).toBe('/explained');
    expect(normalizeBase('/')).toBe('');
    expect(coursePath('/explained/', 'greetings')).toBe('/explained/courses/greetings/');
    expect(lessonPath('/explained/', 'greetings/hello-world')).toBe('/explained/courses/greetings/hello-world/');
    expect(coursePath('/', 'greetings')).toBe('/courses/greetings/');
  });
});
