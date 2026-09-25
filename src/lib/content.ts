import { unified } from 'unified';
import remarkDirective from 'remark-directive';
import remarkParse from 'remark-parse';

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

export function coursePath(base: string, courseId: string): string {
  return `${normalizeBase(base)}/courses/${courseId}/`;
}

export function lessonPath(base: string, lessonId: string): string {
  return `${normalizeBase(base)}/courses/${lessonId}/`;
}
