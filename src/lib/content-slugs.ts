import { z } from 'astro/zod';

export const contentSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/;
export const contentSlugFormat = '1–64 characters containing lowercase kebab-case segments separated by single slashes';

export const contentSlugSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(contentSlugPattern, `Slug must contain ${contentSlugFormat}`);

export type ContentType = 'course' | 'lesson' | 'cheatsheet';

export interface ContentSlugRecord {
  type: ContentType;
  path: string;
  slug: unknown;
}

function renderedSlug(slug: unknown): string {
  const rendered = JSON.stringify(slug);
  return rendered ?? String(slug);
}

export function contentSlugErrors(records: ContentSlugRecord[]): string[] {
  const errors: string[] = [];
  const recordsBySlug = new Map<string, ContentSlugRecord[]>();
  const validRecords: Array<ContentSlugRecord & { slug: string }> = [];

  for (const record of records) {
    const result = contentSlugSchema.safeParse(record.slug);

    if (!result.success) {
      const problem = record.slug === undefined ? 'missing slug' : `invalid slug ${renderedSlug(record.slug)}`;
      errors.push(`${record.path}: ${problem}; expected ${contentSlugFormat}`);
      continue;
    }

    validRecords.push({ ...record, slug: result.data });
    const matchingRecords = recordsBySlug.get(result.data) ?? [];
    matchingRecords.push(record);
    recordsBySlug.set(result.data, matchingRecords);
  }

  const courseSlugs = new Set(
    validRecords.filter((record) => record.type === 'course').map((record) => record.slug),
  );

  for (const record of validRecords) {
    const segments = record.slug.split('/');
    const courseSlug = segments[0] ?? '';
    const hasChildPath = segments.length > 1;

    if (record.type === 'course' && hasChildPath) {
      errors.push(`${record.path}: course slug ${renderedSlug(record.slug)} must contain one kebab-case segment`);
      continue;
    }

    if (record.type !== 'course' && !hasChildPath) {
      errors.push(
        `${record.path}: ${record.type} slug ${renderedSlug(record.slug)} must begin with a course slug followed by "/"`,
      );
      continue;
    }

    if (record.type !== 'course' && !courseSlugs.has(courseSlug)) {
      errors.push(`${record.path}: ${record.type} slug ${renderedSlug(record.slug)} begins with unknown course slug ${renderedSlug(courseSlug)}`);
    }
  }

  for (const [slug, matchingRecords] of [...recordsBySlug].sort(([left], [right]) => left.localeCompare(right))) {
    if (matchingRecords.length < 2) continue;

    const sources = matchingRecords
      .toSorted((left, right) => left.path.localeCompare(right.path))
      .map((record) => `${record.type}: ${record.path}`)
      .join(', ');
    errors.push(`duplicate slug ${renderedSlug(slug)}; conflicting sources: ${sources}`);
  }

  return errors;
}

export function assertValidContentSlugs(records: ContentSlugRecord[]): void {
  const errors = contentSlugErrors(records);
  if (errors.length > 0) throw new Error(`Content slug validation failed:\n- ${errors.join('\n- ')}`);
}
