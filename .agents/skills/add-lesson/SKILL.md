---
name: add-lesson
description: Add one new English Markdown lesson to an existing Explained course and register it in the course's ordered outline. Use when the human author asks to create, write, insert, or append a lesson under `knowledge/lessons/`; gather any missing author inputs, enforce `AGENTS.md` and `openspec/specs/course-content/spec.md`, and validate the published content.
---

# Add Lesson

Create exactly one lesson for an existing course. Write its Markdown file and add its reference to the parent course in the human-defined position.

## 1. Load the current rules

1. Locate the repository root and read every applicable `AGENTS.md`.
2. Read `openspec/specs/course-content/spec.md` completely and freshly. Treat both general lesson rules and course-specific requirements as authoritative.
3. Inspect `src/content.config.ts`, the target file in `knowledge/courses/`, and every lesson listed by that course. Inspect repository validation commands before editing.
4. Preserve unrelated and pre-existing changes in the worktree.

Do not edit the specification to make a conflicting lesson permissible. If the requested lesson would violate a fixed count, fixed order, prescribed outline, or another requirement, stop and explain the conflict.

## 2. Collect only missing author input

Require these decisions from the human author; use conversation context when it already provides them:

- The existing course, identified unambiguously by its English title or course ID.
- The exact new lesson title in English. Treat it as the author-provided outline entry and bounded topic.
- The exact position in the ordered curriculum: append it, place it before a named lesson, or place it after a named lesson.

Ask one concise question containing every missing item. Do not ask for a description, slug, tags, estimated duration, prose outline, exercises, or lesson body; generate those. Accept optional emphasis, exclusions, or source requirements when supplied.

Do not translate a non-English proposed title and silently treat it as author input. Ask the author to provide the title in English. If the title combines topics that cannot fit one coherent 1–30 minute lesson, ask the author to narrow it before editing.

## 3. Check the requested placement

Before writing:

1. Resolve the course title to exactly one `knowledge/courses/<course-id>.md` file.
2. Derive a concise lowercase kebab-case lesson ID from the approved English title, following existing IDs.
3. Read the parent course's frontmatter `slug`. Derive the lesson slug as `<course-slug>/<lesson-id>`, keeping the complete value within 64 characters and every path segment in lowercase kebab-case.
4. Search the frontmatter of every course, lesson, and cheatsheet source document and confirm that the derived slug is globally unique. If it collides, derive a more specific recognizable slug automatically; do not ask the author to supply one. Pause only if resolving the collision requires a material identity choice.
5. Confirm that `knowledge/lessons/<course-id>/<lesson-id>.md` and its course reference do not already exist.
6. Compare the topic with every existing lesson to avoid duplication and preserve one topic per file.
7. Confirm that the lesson can stand alone or depend only on lessons before its requested position. Never make it rely on a later lesson.
8. Check every applicable course-specific requirement from the OpenSpec file.

Pause for the author when a collision, ambiguous course, conflicting position, duplicate topic, or specification conflict requires a material choice.

## 4. Research the content

Use repository material and authoritative primary sources. Verify current commands, APIs, versions, compatibility claims, URLs, and other changeable facts instead of relying on memory. Prefer official documentation and link directly to useful sources from the lesson when appropriate.

Keep research proportional for stable, conceptual topics. Never fabricate a command, result, quotation, or citation.

## 5. Write the lesson

Create `knowledge/lessons/<course-id>/<lesson-id>.md` with this exact frontmatter shape:

```yaml
---
slug: <generated globally unique contextual slug>
title: <human-provided English title>
description: <generated short English description>
tags:
  - <generated relevant tag>
---
```

Follow these content rules:

- Write all learner-facing text, including the title, description, headings, examples, and image alt text, only in English.
- Cover exactly the approved topic and fit a realistic 1–30 minute completion time.
- Address a beginner without a separate prerequisites section.
- Include only the theory needed to begin practical work; move quickly to a concrete explanation, example, or small learner action when the topic permits it.
- Build only on material in earlier lessons. Briefly connect to earlier or next material only when it improves continuity.
- Follow terminology, formatting, emphasis, command, link, and scope requirements specific to the course.
- Use valid Markdown, fenced-code language identifiers, accurate examples, and concise headings. Do not repeat the title as an H1 because the page layout renders it from frontmatter.
- Do not create an installation guide or cheatsheet. Include setup inside the lesson only when it is part of the approved topic and allowed by the specification.

Generate the description and tags from the finished lesson. Keep tags concise, reusable, lowercase, and consistent with the course.

## 6. Register the lesson

Add `<course-slug>/<lesson-id>`—the new lesson's exact explicit slug—to the parent course's `lessons` array at the exact author-provided position. Preserve all other references and their order.

Change other course overview prose only when the new curriculum would otherwise make it inaccurate and the specification permits the edit. Keep such edits minimal; never add a prerequisites section, installation guide, or cheatsheet as part of this workflow.

## 7. Verify the result

Re-read the new lesson, parent course, earlier lessons, and applicable OpenSpec requirements. Confirm:

- The title is the author's exact English outline entry.
- The explicit slug begins with the parent course slug, matches the course reference, and occupies the requested position.
- The explicit slug is recognizable, valid, globally unique across courses, lessons, and cheatsheets, and acts as the lesson's Astro entry ID and route key.
- Frontmatter matches `src/content.config.ts`.
- The lesson is English-only, atomic, beginner-focused, and realistically completable within 30 minutes.
- Every dependency points backward in the curriculum.
- Course-specific requirements and verified facts are satisfied.
- No unrelated content, installation guide, prerequisites section, or cheatsheet was added.

Run `pnpm run ci` when available; otherwise run the repository's relevant content validation and build commands. Also run `git diff --check` and inspect the final diff. Do not stage or commit changes unless explicitly requested.

Report the created lesson path, its explicit slug, its curriculum position, any other course file changed, validation results, and any verification that could not be completed.
