---
name: add-course
description: Create one new bilingual English and Russian Explained course from a required author-provided title, goal, and ordered list of initial lesson titles. Use when the human author invokes `$add-course` to create a course under `knowledge/courses/`; require all three inputs, derive the course slug and metadata, delegate every lesson concurrently to a separate sub-agent invoking `$add-lesson COURSE_SLUG`, enforce the domain rules in `AGENTS.md`, and validate the published content.
---

# Add Course

Create exactly one beginner course and its author-defined initial curriculum in English and Russian. Generate the course description, content, and translations, but preserve the author's exact course and lesson titles in the language the author used.

## Required author input

Require all three inputs:

1. The exact course title in English or Russian.
2. A clear course goal describing the beginner outcome and scope.
3. An ordered list containing one or more exact lesson titles in English or Russian.

Accept them in any unambiguous format. Recommend this form:

```text
$add-course
Title: <exact course title>
Goal: <beginner outcome and scope>
Lessons:
1. <exact lesson title>
2. <exact lesson title>
```

Treat the ordered lesson list as the human-defined course outline. Use conversation context when it already supplies an item. If anything is missing, ask one concise question containing every missing item and do not inspect or edit course content yet.

Do not infer or rewrite the title or lesson titles. Keep each one exactly as written in its language and generate the title in the other language; when the author wrote a title in Russian, the generated English title becomes the source title. Ask for English or Russian when the author used another language. Do not ask the author for a slug, `catalogOrder`, description, tags, estimated duration, prose outline, lesson bodies, installation guide, or cheatsheet. Generate everything except the required inputs. Accept optional emphasis, exclusions, and source requirements when supplied.

## 1. Load the current rules

1. Locate the repository root and read every applicable `AGENTS.md` completely and freshly. Treat its domain rules as authoritative.
2. Read `.agents/skills/add-lesson/SKILL.md` completely and freshly. Every lesson sub-agent must follow that workflow rather than imitate it.
3. Inspect `src/content.config.ts`, existing files under `knowledge/courses/` and `knowledge/lessons/`, repository slug validation, and available validation commands.
4. Preserve unrelated and pre-existing worktree changes.

Do not edit the domain rules to make a conflicting course permissible. Stop and explain any conflict with a fixed curriculum, published identity, or other declared requirement.

## 2. Validate the proposed curriculum

Before writing:

1. Confirm that the title and every lesson title are in English or Russian, that the outline contains at least one lesson, and prepare the English and Russian version of each title.
2. Bound the course to a short, focused introduction for a newcomer. Reject unnecessary background and separate prerequisites.
3. Confirm that each lesson title describes one coherent topic that can fit a realistic 1–30 minute lesson. Ask the author to narrow any combined or oversized topic.
4. Check the order so each lesson is independent or depends only on earlier lessons. Ask the author to reorder an outline with forward dependencies.
5. Compare the proposal with existing courses and lessons. Pause for a material choice if it duplicates published content or conflicts with a course-specific requirement.
6. Derive a concise one-segment lowercase kebab-case course slug from the English title. Keep it within 64 characters and make it recognizable.
7. Check frontmatter across every English course, lesson, and cheatsheet source; `.ru.md` translations repeat their source slug and do not count. Confirm the slug is globally unique and that `knowledge/courses/<course-slug>.md` and `knowledge/lessons/<course-slug>/` do not identify existing content. Derive a more specific slug automatically when possible; pause only when resolving a collision changes course identity materially.
8. Derive and reserve one recognizable lesson slug, source path, and `.ru.md` translation path for every outline entry, using the same identity rules as `$add-lesson`. Confirm that all planned lesson slugs and paths are valid and unique both globally and within the batch. Resolve routine collisions automatically before starting any sub-agent.
9. Check that every existing course has a unique positive integer `catalogOrder`. If the catalogue metadata is invalid, stop and report every conflict rather than creating another course. Otherwise derive `10` when there are no existing courses, or the greatest existing `catalogOrder` plus `10`, so the new course appears first without changing existing courses.

Do not require the author to choose or approve a routine derived slug or `catalogOrder`.

## 3. Create the course scaffold

Research the overview proportionally. Verify current factual claims with authoritative primary sources when the goal or overview needs version-sensitive information.

Create `knowledge/courses/<course-slug>.md` with this frontmatter shape:

```yaml
---
slug: <generated globally unique course slug>
title: <English title>
catalogOrder: <10 for the first course, otherwise current maximum plus 10>
description: <generated short English description>
tags:
  - <generated relevant tag>
lessons:
  - <reserved slug for lesson 1>
  - <reserved slug for lesson 2>
---
```

Include every reserved lesson slug in the exact author-defined order. This is a temporary coordinated-batch scaffold: its references may point to lesson files that are still being created, so do not validate or publish it until the sub-agents finish. Pre-registering the complete outline gives the parent agent sole ownership of the shared course file and prevents concurrent lost updates.

Write a concise English course overview from the goal and complete ordered outline. Include only the theory needed to frame the subject and a short `What you will learn` section aligned with the initial lessons. Generate a concise description and reusable lowercase tags. Do not add a prerequisites section, installation guide, or cheatsheet.

Then create the Russian translation `knowledge/courses/<course-slug>.ru.md` with this frontmatter shape:

```yaml
---
slug: <the same course slug>
title: <Russian title>
description: <Russian translation of the English description>
---
```

Translate the overview body faithfully by the `Languages and translations` rules in `AGENTS.md`. Do not copy `catalogOrder`, `tags`, or `lessons` into the translation; they live only in the English source.

## 4. Delegate every lesson

Require sub-agent support. If sub-agents cannot be started, stop and explain that the requested delegated workflow cannot be completed; do not write lesson files inline.

Prepare one task for every lesson in author-defined order:

1. Assign each lesson to a new, separate sub-agent. Do not reuse one agent for multiple lessons.
2. Give each sub-agent exclusive ownership of its reserved lesson file and its `.ru.md` translation, and forbid it from editing the shared parent course file or its translation. The pre-registered reference satisfies `$add-lesson`'s registration step for this coordinated batch; tell the sub-agent not to reject that expected existing reference. All other `$add-lesson` research, content, identity, dependency, and validation requirements remain authoritative.
3. In the task, explicitly invoke the existing skill and include the exact course slug, the English and Russian lesson titles with the author's original marked, the reserved lesson slug, source path, and translation path, course goal, ordinal position, total lesson count, and complete ordered outline. Use this prompt shape:

   ```text
   Use `$add-lesson <course-slug>` to create the lesson "<author's exact title>".
   English title: "<English title>". Russian title: "<Russian title>".
   This is a coordinated parallel course build. The parent has already reserved
   `<lesson-slug>` at position <n> in `<course-path>`. Treat that reference as
   satisfying the registration step, create only `<lesson-path>` and its
   translation `<translation-path>`, and do not edit the shared course file, its
   translation, or reject its expected existing reference.
   Course goal: <goal>
   This is lesson <n> of <count> in the author-approved outline: <ordered titles>.
   Read and follow the repository's add-lesson skill; do not merely imitate it.
   ```

4. Start all lesson sub-agents without waiting for any lesson result between launches, then wait for the batch. When the platform has a hard concurrency limit, queue every task before waiting when supported; otherwise keep every available slot occupied and launch each remaining task immediately when a slot opens. Never intentionally serialize lesson generation.
5. As results arrive, inspect each report and its filesystem changes. Confirm that the agent created exactly its assigned lesson file and translation, preserved the exact titles and reserved slug, and did not modify the parent course, its translation, or another lesson's files.
6. If verification fails, send a focused correction to that same sub-agent. Corrections for independent lesson files may also run concurrently. Do not let one lesson's retry delay unrelated lesson work.

Never write or repair lesson content in the parent agent. Delegate that work through `$add-lesson` so its research, content, identity, and validation constraints remain authoritative. The parent agent alone owns the shared course file and its translation during the parallel batch.

After all sub-agents and focused retries finish, reconcile the parent course's `lessons` array once. If every lesson succeeded, it must remain the complete reserved outline. If some lessons are genuinely blocked, remove only their unresolved reserved references so the retained partial course contains successful lessons in author-defined order. If no lesson succeeds, remove only the temporary course scaffold and its translation created by this workflow. Report any incomplete outline precisely and do not claim completion.

## 5. Verify the complete course

After every lesson sub-agent succeeds:

1. Re-read the course, every listed lesson, their translations, all applicable `AGENTS.md` files, and `src/content.config.ts`.
2. Confirm the course title and every lesson title exactly match the author's inputs in the author's language, and that the titles in the other language are accurate translations.
3. Confirm that the ordered course references match the complete initial outline and that dependencies point only backward.
4. Confirm every frontmatter slug is recognizable, valid, globally unique, and consistent with its Astro entry ID, route, and parent reference.
5. Confirm the course `catalogOrder` is a unique positive integer equal to `10` for the first course or to the previous maximum plus `10`, so the new course appears before every previously existing course without changing their values.
6. Confirm the overview fulfills the author-provided goal, every source is English and has a Russian `.ru.md` translation that mirrors it by the `Languages and translations` rules, each lesson is atomic and beginner-focused, and no prerequisites section, installation guide, or cheatsheet was added.
7. Run `pnpm run ci` when available; otherwise run the repository's relevant content validation and build commands.
8. Run `git diff --check` and inspect the complete diff. Do not stage or commit changes unless explicitly requested.

Report the course and translation paths, slug, and `catalogOrder`, ordered lesson and translation paths and slugs, one sub-agent result per lesson, validation results, and anything that could not be verified.
