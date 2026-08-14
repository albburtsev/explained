import { describe, expect, it } from 'vitest';
import { createSearch, type SearchDocument } from '../src/lib/search';

const documents: SearchDocument[] = [
  {
    id: 'greetings/hello-world',
    kind: 'lesson',
    title: 'Hello, World!',
    description: 'Write a friendly program.',
    tags: ['typescript'],
    body: 'The program writes a value to the standard output stream.',
    url: '/explained/courses/greetings/hello-world/',
  },
  {
    id: 'greetings',
    kind: 'course',
    title: 'Greetings',
    description: 'A first course.',
    tags: ['fundamentals'],
    body: 'Begin a programming journey.',
    url: '/explained/courses/greetings/',
  },
];

describe('fuzzy search', () => {
  const search = createSearch(documents);

  it('finds a title despite a typo', () => {
    expect(search.search('helo')[0]?.item.id).toBe('greetings/hello-world');
  });

  it('finds a term that exists only in the body', () => {
    expect(search.search('stream')[0]?.item.id).toBe('greetings/hello-world');
  });
});
