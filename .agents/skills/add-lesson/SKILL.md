---
name: add-lesson
description: "`<course-slug> [lesson-request]` — Add one new bilingual English and Russian Markdown lesson to an existing Explained course selected by a required course-slug argument and register it in the course's ordered outline. Use when the human author invokes `$add-lesson` to create, write, insert, or append a lesson under `knowledge/lessons/`; require that argument before starting, gather any other missing author inputs, enforce the domain rules in `AGENTS.md`, and validate the published content."
argument-hint: "<course-slug> [lesson-request]"
---

# Add Lesson

Create exactly one lesson for an existing course. Write its English source file and its Russian translation, and add its reference to the parent course in the human-defined position.

## Required argument

Require the first argument after `$add-lesson` to be the existing course's exact frontmatter `slug`:

```text
$add-lesson <course-slug> [lesson request]
```

Do not infer the course slug from conversation context, a course title, a directory name, or a course file name. Do not accept any of those values as a substitute. If the argument is missing, stop and ask the author to invoke the skill with the required course slug before inspecting or editing course content.

## 1. Load the current rules

1. Locate the repository root and read every applicable `AGENTS.md` completely and freshly. Treat its domain rules as authoritative.
2. Inspect `src/content.config.ts`, the target file in `knowledge/courses/` and its `.ru.md` translation when present, and every lesson listed by that course with its translation. Inspect repository validation commands before editing.
3. Preserve unrelated and pre-existing changes in the worktree.

Do not edit the domain rules to make a conflicting lesson permissible. If the requested lesson would violate a fixed count, fixed order, prescribed outline, or another requirement, stop and explain the conflict.

## 2. Collect only missing author input

Require these decisions from the human author; use conversation context when it already provides them:

- The exact new lesson title in English or Russian. Treat it as the author-provided outline entry and bounded topic.
- The exact position in the ordered curriculum: append it, place it before a named lesson, or place it after a named lesson.

Ask one concise question containing every missing item. Do not ask for a description, slug, tags, estimated duration, prose outline, exercises, or lesson body; generate those. Accept optional emphasis, exclusions, or source requirements when supplied.

Keep the author's title exactly as written in its language and generate the title in the other language. When the author wrote the title in Russian, the generated English title becomes the source title. Ask the author for a title in English or Russian when they used another language. If the title combines topics that cannot fit one coherent 1–30 minute lesson, ask the author to narrow it before editing.

## 3. Check the requested placement

Before writing:

1. Validate that the required course-slug argument is a one-segment lowercase kebab-case slug no longer than 64 characters, then resolve it against course frontmatter to exactly one `knowledge/courses/<course-id>.md` file. If it is invalid, absent, or does not resolve exactly once, stop and request a valid course slug; never guess or offer a title or course ID as an equivalent.
2. Derive a concise lowercase kebab-case lesson ID from the English title, following existing IDs.
3. Confirm that the resolved parent course's frontmatter `slug` exactly matches the required argument. Derive the lesson slug as `<course-slug>/<lesson-id>`, keeping the complete value within 64 characters and every path segment in lowercase kebab-case.
4. Search the frontmatter of every English course, lesson, and cheatsheet source document and confirm that the derived slug is globally unique. Ignore `.ru.md` translations, which repeat their source slug. If it collides, derive a more specific recognizable slug automatically; do not ask the author to supply one. Pause only if resolving the collision requires a material identity choice.
5. Confirm that `knowledge/lessons/<course-id>/<NN>-<lesson-id>.md`, its `.ru.md` translation, and its course reference do not already exist.
6. Compare the topic with every existing lesson to avoid duplication and preserve one topic per file.
7. Confirm that the lesson can stand alone or depend only on lessons before its requested position. Never make it rely on a later lesson.
8. Check the requested lesson against every applicable rule in `AGENTS.md` and against the parent course's existing curriculum.

Pause for the author when a collision, ambiguous course, conflicting position, duplicate topic, or conflict with the domain rules requires a material choice.

## 4. Research the content

Use repository material and authoritative primary sources. Verify current commands, APIs, versions, compatibility claims, URLs, and other changeable facts instead of relying on memory. Prefer official documentation and link directly to useful sources from the lesson when appropriate.

Keep research proportional for stable, conceptual topics. Never fabricate a command, result, quotation, or citation.

## 5. Write the lesson

Create `knowledge/lessons/<course-id>/<NN>-<lesson-id>.md`, where `<NN>` is its two-digit position in `lessons`, with this exact frontmatter shape:

```yaml
---
slug: <generated globally unique contextual slug>
title: <English title>
description: <generated short English description>
tags:
  - <generated relevant tag>
---
```

Follow these content rules:

- Write the source in English: title, description, headings, examples, and image alt text.
- Cover exactly the approved topic and fit a realistic 1–30 minute completion time.
- Address a beginner without a separate prerequisites section.
- Include only the theory needed to begin practical work; move quickly to a concrete explanation, example, or small learner action when the topic permits it.
- Build only on material in earlier lessons. Briefly connect to earlier or next material only when it improves continuity.
- Follow terminology, formatting, emphasis, command, link, and scope requirements specific to the course.
- Use valid Markdown, fenced-code language identifiers, accurate examples, and concise headings. Do not repeat the title as an H1 because the page layout renders it from frontmatter.
- Do not create an installation guide or cheatsheet. Include setup inside the lesson only when it is part of the approved topic and allowed by the domain rules.

Generate the description and tags from the finished lesson. Keep tags concise, reusable, lowercase, and consistent with the course.

## 6. Translate the lesson

After the English source is final, create `knowledge/lessons/<course-id>/<NN>-<lesson-id>.ru.md` with the same `<NN>` and this exact frontmatter shape:

```yaml
---
slug: <the same slug as the English source>
title: <Russian title>
description: <Russian translation of the English description>
---
```

Do not add `tags` or any other field; structural metadata lives only in the English source. Follow the `Languages and translations` rules in `AGENTS.md`:

- Translate the meaning, not the words. Keep the same sections in the same order and do not add, drop, or change any fact.
- Keep code blocks, commands, output, identifiers, and URLs byte-identical, including comments inside code.
- Translate prose, headings, `:::details` labels, and alt text. The B2 rule does not apply to Russian. Write calm, literary, natural Russian that does not read as a mechanical translation; rephrase and restructure sentences freely, and use complex words and terms when the thought needs them.
- Professional terminology may stay in English; keep each term in one form throughout the course. Wrap important terms in inline code where they are first explained, as in the source.

## 7. Register the lesson

Add `<course-slug>/<lesson-id>`—the new lesson's exact explicit slug—to the parent course's `lessons` array at the exact author-provided position. Preserve all other references and their order. Renumber later lesson files and their `.ru.md` translations with `git mv` to match their new positions.

Change other course overview prose only when the new curriculum would otherwise make it inaccurate and the domain rules permit the edit. Apply the same edit to the course's `.ru.md` translation; if it does not exist yet, create it from the final English course file with only `slug`, `title`, and `description` in its frontmatter. Keep such edits minimal; never add a prerequisites section, installation guide, or cheatsheet as part of this workflow.

## 8. Verify the result

Re-read the new lesson and its translation, the parent course, earlier lessons, and the applicable domain rules. Confirm:

- The author's title is kept exactly in its language, and the other title is an accurate translation.
- The explicit slug begins with the parent course slug, matches the course reference, and occupies the requested position.
- The explicit slug is recognizable, valid, globally unique across courses, lessons, and cheatsheets, and acts as the lesson's Astro entry ID and route key.
- Frontmatter matches `src/content.config.ts`.
- The lesson is atomic, beginner-focused, and realistically completable within 30 minutes.
- The source is English and the translation is Russian. The translation has the same `<NN>`, the same slug, only `slug`, `title`, and `description` in its frontmatter, the same structure, and byte-identical code.
- Every dependency points backward in the curriculum.
- The domain rules and verified facts are satisfied.
- No unrelated content, installation guide, prerequisites section, or cheatsheet was added.

Run `pnpm run ci` when available; otherwise run the repository's relevant content validation and build commands. Also run `git diff --check` and inspect the final diff. Do not stage or commit changes unless explicitly requested.

Report the created lesson and translation paths, both titles, its explicit slug, its curriculum position, any other course file changed, validation results, and any verification that could not be completed.
