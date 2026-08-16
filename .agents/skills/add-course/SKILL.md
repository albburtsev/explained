---
name: add-course
description: Create one new English Explained course from a required author-provided title, goal, and ordered list of initial lesson titles. Use when the human author invokes `$add-course` to create a course under `knowledge/courses/`; require all three inputs, derive the course slug and metadata, delegate every lesson sequentially to a separate sub-agent invoking `$add-lesson COURSE_SLUG`, enforce `AGENTS.md` and `openspec/specs/course-content/spec.md`, and validate the published content.
---

# Add Course

Create exactly one beginner course and its author-defined initial curriculum. Generate the course description and content, but preserve the author's exact English course and lesson titles.

## Required author input

Require all three inputs:

1. The exact course title in English.
2. A clear course goal describing the beginner outcome and scope.
3. An ordered list containing one or more exact lesson titles in English.

Accept them in any unambiguous format. Recommend this form:

```text
$add-course
Title: <exact English course title>
Goal: <beginner outcome and scope>
Lessons:
1. <exact English lesson title>
2. <exact English lesson title>
```

Treat the ordered lesson list as the human-defined course outline. Use conversation context when it already supplies an item. If anything is missing, ask one concise question containing every missing item and do not inspect or edit course content yet.

Do not infer or silently translate the title or lesson titles. Do not ask the author for a slug, description, tags, estimated duration, prose outline, lesson bodies, installation guide, or cheatsheet. Generate everything except the required inputs. Accept optional emphasis, exclusions, and source requirements when supplied.

## 1. Load the current rules

1. Locate the repository root and read every applicable `AGENTS.md`.
2. Read `openspec/specs/course-content/spec.md` completely and freshly. Treat its general and course-specific requirements as authoritative.
3. Read `.agents/skills/add-lesson/SKILL.md` completely and freshly. Every lesson sub-agent must follow that workflow rather than imitate it.
4. Inspect `src/content.config.ts`, existing files under `knowledge/courses/` and `knowledge/lessons/`, repository slug validation, and available validation commands.
5. Preserve unrelated and pre-existing worktree changes.

Do not edit specifications or authoring rules to make a conflicting course permissible. Stop and explain any conflict with a fixed curriculum, published identity, or other declared requirement.

## 2. Validate the proposed curriculum

Before writing:

1. Confirm that the title and every lesson title are English and that the outline contains at least one lesson.
2. Bound the course to a short, focused introduction for a newcomer. Reject unnecessary background and separate prerequisites.
3. Confirm that each lesson title describes one coherent topic that can fit a realistic 1–30 minute lesson. Ask the author to narrow any combined or oversized topic.
4. Check the order so each lesson is independent or depends only on earlier lessons. Ask the author to reorder an outline with forward dependencies.
5. Compare the proposal with existing courses and lessons. Pause for a material choice if it duplicates published content or conflicts with a course-specific requirement.
6. Derive a concise one-segment lowercase kebab-case course slug from the exact title. Keep it within 64 characters and make it recognizable.
7. Check frontmatter across every course, lesson, and cheatsheet source. Confirm the slug is globally unique and that `knowledge/courses/<course-slug>.md` and `knowledge/lessons/<course-slug>/` do not identify existing content. Derive a more specific slug automatically when possible; pause only when resolving a collision changes course identity materially.

Do not require the author to choose or approve a routine derived slug.

## 3. Create the course scaffold

Research the overview proportionally. Verify current factual claims with authoritative primary sources when the goal or overview needs version-sensitive information.

Create `knowledge/courses/<course-slug>.md` with this frontmatter shape:

```yaml
---
slug: <generated globally unique course slug>
title: <human-provided English title>
description: <generated short English description>
tags:
  - <generated relevant tag>
lessons: []
---
```

The empty `lessons` list is a temporary scaffold that lets `$add-lesson` register each lesson itself. Do not validate or publish this transient state. It must contain at least one lesson reference before the workflow finishes.

Write a concise English course overview from the goal and complete ordered outline. Include only the theory needed to frame the subject and a short `What you will learn` section aligned with the initial lessons. Generate a concise description and reusable lowercase tags. Do not add a prerequisites section, installation guide, or cheatsheet.

## 4. Delegate every lesson

Require sub-agent support. If sub-agents cannot be started, stop and explain that the requested delegated workflow cannot be completed; do not write lesson files inline.

For each lesson in author-defined order:

1. Start a new, separate sub-agent for that lesson only. Do not reuse one agent for multiple lessons.
2. In the task, explicitly invoke the existing skill and include the exact course slug, exact English lesson title, append position, course goal, ordinal position, total lesson count, and complete ordered outline. Use this prompt shape:

   ```text
   Use `$add-lesson <course-slug>` to append the lesson "<exact lesson title>".
   Course goal: <goal>
   This is lesson <n> of <count> in the author-approved outline: <ordered titles>.
   Read and follow the repository's add-lesson skill; do not merely imitate it.
   ```

3. Run only one lesson sub-agent at a time. Wait for it to finish before starting the next because all agents edit the same course outline and later lessons may depend on earlier content.
4. After it finishes, inspect its reported result and filesystem changes. Confirm that exactly one lesson was created, its title matches the author's outline entry, and its slug was appended to the parent course after all earlier lessons.
5. If verification fails, send a focused correction to that same sub-agent and wait again. Do not start the next lesson until the current one is correct or genuinely blocked.

Never write, register, or repair a lesson in the parent agent. Delegate that work through `$add-lesson` so its research, content, identity, ordering, and validation constraints remain authoritative.

If no lesson succeeds, remove only the untouched temporary course scaffold created by this workflow. If at least one lesson succeeds and a later lesson is blocked, keep the valid partial course, report the incomplete outline precisely, and do not claim completion.

## 5. Verify the complete course

After every lesson sub-agent succeeds:

1. Re-read the course, every listed lesson, all applicable `AGENTS.md` files, `openspec/specs/course-content/spec.md`, and `src/content.config.ts`.
2. Confirm the course title and every lesson title exactly match the author's English inputs.
3. Confirm that the ordered course references match the complete initial outline and that dependencies point only backward.
4. Confirm every frontmatter slug is recognizable, valid, globally unique, and consistent with its Astro entry ID, route, and parent reference.
5. Confirm the overview fulfills the author-provided goal, all learner-facing content is English, each lesson is atomic and beginner-focused, and no prerequisites section, installation guide, or cheatsheet was added.
6. Run `pnpm run ci` when available; otherwise run the repository's relevant content validation and build commands.
7. Run `git diff --check` and inspect the complete diff. Do not stage or commit changes unless explicitly requested.

Report the course path and slug, ordered lesson paths and slugs, one sub-agent result per lesson, validation results, and anything that could not be verified.
