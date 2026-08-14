import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const lessons = defineCollection({
  loader: glob({ base: './knowledge/lessons', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    tags: z.array(z.string()).default([]),
  }),
});

const courses = defineCollection({
  loader: glob({ base: './knowledge/courses', pattern: '*.md' }),
  schema: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    lessons: z.array(reference('lessons')).min(1),
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = { courses, lessons };
