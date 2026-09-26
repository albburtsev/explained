import { unified } from 'unified';
import remarkDirective from 'remark-directive';
import remarkParse from 'remark-parse';
import { defaultLocale, type Locale } from './i18n';

const markdownParser = unified().use(remarkParse).use(remarkDirective);
const spacedContainers = new Set([
  'root',
  'blockquote',
  'list',
  'listItem',
  'table',
  'tableRow',
  'containerDirective',
]);

interface MarkdownNode {
  type: string;
  value?: string;
  children?: MarkdownNode[];
}

function nodeText(node: MarkdownNode): string {
  if (typeof node.value === 'string') return node.value;
  const separator = spacedContainers.has(node.type) ? ' ' : '';
  return node.children?.map(nodeText).join(separator) ?? '';
}

export function markdownToPlainText(markdown: string): string {
  return nodeText(markdownParser.parse(markdown) as MarkdownNode).replace(/\s+/g, ' ').trim();
}

export function normalizeBase(base: string): string {
  const segments = base.split('/').filter(Boolean).join('/');
  return segments ? `/${segments}` : '';
}

export function homePath(base: string, locale: Locale = defaultLocale): string {
  const prefix = locale === defaultLocale ? '' : `/${locale}`;
  return `${normalizeBase(base)}${prefix}/`;
}

function coursesPath(base: string, locale: Locale = defaultLocale): string {
  return `${homePath(base, locale)}courses/`;
}

export function coursePath(base: string, courseId: string, locale: Locale = defaultLocale): string {
  return `${coursesPath(base, locale)}${courseId}/`;
}

export function lessonPath(base: string, lessonId: string, locale: Locale = defaultLocale): string {
  return `${coursesPath(base, locale)}${lessonId}/`;
}

export function searchIndexPath(base: string, locale: Locale = defaultLocale): string {
  return `${homePath(base, locale)}search-index.json`;
}
