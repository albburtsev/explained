import { describe, expect, it } from 'vitest';
import { createSearch, type SearchDocument } from '../src/lib/search';

const documents: SearchDocument[] = [
  {
    id: 'openspec/introduction',
    kind: 'lesson',
    title: 'Meet OpenSpec',
    description: 'Understand why OpenSpec exists, install it on macOS, and initialize a project.',
    tags: ['openspec', 'spec-driven-development', 'macos'],
    body: 'Requirements kept only in chat can drift as the conversation grows.',
    url: '/explained/courses/openspec/introduction/',
  },
  {
    id: 'openspec',
    kind: 'course',
    title: 'OpenSpec',
    description:
      'Learn to plan and deliver coding-agent changes with lightweight, file-based specifications.',
    tags: ['openspec', 'spec-driven-development', 'coding-agents'],
    body: 'A file-based planning layer that gives you and a coding agent a shared, reviewable plan.',
    url: '/explained/courses/openspec/',
  },
];

describe('fuzzy search', () => {
  const search = createSearch(documents);

  it('finds a title despite a typo', () => {
    expect(search.search('meet opnspc')[0]?.item.id).toBe('openspec/introduction');
  });

  it('finds a term that exists only in the body', () => {
    expect(search.search('drift')[0]?.item.id).toBe('openspec/introduction');
  });
});
