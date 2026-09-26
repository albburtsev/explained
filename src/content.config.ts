import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { contentSlugSchema } from './lib/content-slugs';

const contentSchema = z.object({
  slug: contentSlugSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  tags: z.array(z.string()).default([]),
});

const lessons = defineCollection({
  loader: glob({ base: './knowledge/lessons', pattern: ['**/*.md', '!**/*.ru.md'] }),
  schema: contentSchema,
});

const courses = defineCollection({
  loader: glob({ base: './knowledge/courses', pattern: ['*.md', '!*.ru.md'] }),
  schema: contentSchema.extend({
    catalogOrder: z.number().int().positive(),
    lessons: z.array(reference('lessons')).min(1),
  }),
});

const translationSchema = z.object({
  slug: contentSlugSchema,
  title: z.string().min(1),
  description: z.string().min(1),
}).strict();

const courseTranslations = defineCollection({
  loader: glob({ base: './knowledge/courses', pattern: '*.ru.md' }),
  schema: translationSchema,
});

const lessonTranslations = defineCollection({
  loader: glob({ base: './knowledge/lessons', pattern: '**/*.ru.md' }),
  schema: translationSchema,
});

export const collections = { courses, lessons, courseTranslations, lessonTranslations };
