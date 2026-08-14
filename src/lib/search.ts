import Fuse, { type IFuseOptions } from 'fuse.js';

export type SearchDocumentKind = 'course' | 'lesson';

export interface SearchDocument {
  id: string;
  kind: SearchDocumentKind;
  title: string;
  description: string;
  tags: string[];
  body: string;
  url: string;
  context?: string;
}

export const searchOptions: IFuseOptions<SearchDocument> = {
  includeMatches: true,
  ignoreLocation: true,
  minMatchCharLength: 2,
  shouldSort: true,
  threshold: 0.38,
  useTokenSearch: true,
  keys: [
    { name: 'title', weight: 0.45 },
    { name: 'tags', weight: 0.2 },
    { name: 'description', weight: 0.2 },
    { name: 'body', weight: 0.15 },
  ],
};

export function createSearch(documents: SearchDocument[]): Fuse<SearchDocument> {
  return new Fuse(documents, searchOptions);
}
