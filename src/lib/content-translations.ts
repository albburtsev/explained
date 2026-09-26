export interface FrontmatterRecord {
  path: string;
  fields: Record<string, string>;
}

export const translationSuffix = '.ru.md';
export const translationFields = ['slug', 'title', 'description'] as const;

export function translationSourcePath(translationPath: string): string {
  return `${translationPath.slice(0, -translationSuffix.length)}.md`;
}

export function sourceTranslationPath(sourcePath: string): string {
  return `${sourcePath.slice(0, -'.md'.length)}${translationSuffix}`;
}

export function contentTranslationErrors(sources: FrontmatterRecord[], translations: FrontmatterRecord[]): string[] {
  const errors: string[] = [];
  const sourcesByPath = new Map(sources.map((source) => [source.path, source]));
  const allowedFields = new Set<string>(translationFields);
  const translationPaths = new Set(translations.map((translation) => translation.path));

  for (const source of sources) {
    const translationPath = sourceTranslationPath(source.path);
    if (!translationPaths.has(translationPath)) errors.push(`${source.path}: missing Russian translation ${translationPath}`);
  }

  for (const translation of translations) {
    const sourcePath = translationSourcePath(translation.path);
    const source = sourcesByPath.get(sourcePath);

    if (source === undefined) {
      errors.push(`${translation.path}: translation has no English source at ${sourcePath}`);
      continue;
    }

    for (const field of translationFields) {
      if (!translation.fields[field]) errors.push(`${translation.path}: missing ${field}`);
    }

    for (const field of Object.keys(translation.fields)) {
      if (!allowedFields.has(field)) {
        errors.push(`${translation.path}: ${field} belongs only in the English source ${sourcePath}`);
      }
    }

    const slug = translation.fields['slug'];
    if (slug && slug !== source.fields['slug']) {
      errors.push(
        `${translation.path}: slug ${JSON.stringify(slug)} must match English source slug ${JSON.stringify(source.fields['slug'])}`,
      );
    }
  }

  return errors.toSorted();
}

export function assertValidContentTranslations(sources: FrontmatterRecord[], translations: FrontmatterRecord[]): void {
  const errors = contentTranslationErrors(sources, translations);
  if (errors.length > 0) throw new Error(`Content translation validation failed:\n- ${errors.join('\n- ')}`);
}
