---
name: fix-lesson
description: Fix one existing English Markdown lesson selected by a required lesson-slug argument according to a required correction instruction. Use when the human author invokes `$fix-lesson LESSON_SLUG FIX_INSTRUCTION` to correct, revise, clarify, update, or repair a lesson under `knowledge/lessons/`; require both inputs before starting, preserve published identity and curriculum order unless an authorized consistency change is necessary, and enforce the same content, research, OpenSpec, and validation constraints as `add-lesson`.
---

# Fix Lesson

Modify exactly one existing lesson as requested. Make the smallest complete correction and only the consistency edits that the correction requires.

## Required arguments

Require the first argument after `$fix-lesson` to be the lesson's exact frontmatter `slug`. Treat all remaining text as the required fix instruction:

```text
$fix-lesson <lesson-slug> <fix instruction>
```

Do not infer the lesson slug from conversation context, a lesson title, a course title, a directory name, or a file name. Do not accept any of those values as a substitute. If either argument is missing, stop and ask the author to invoke the skill with both the lesson slug and the fix instruction before inspecting or editing course content.

If the instruction remains materially ambiguous after loading the target and its rules, ask one concise clarifying question. Do not ask the author for implementation details that can be derived safely from the repository or authoritative sources.

## 1. Load the current rules

1. Locate the repository root and read every applicable `AGENTS.md`.
2. Read `openspec/specs/course-content/spec.md` completely and freshly. Treat both general lesson rules and course-specific requirements as authoritative.
3. Read `../add-lesson/SKILL.md`, resolving the path relative to this skill, completely and freshly. Apply its current content, research, identity, consistency, and verification constraints wherever they govern an existing lesson.
4. Inspect `src/content.config.ts` and repository validation commands.
5. Preserve unrelated and pre-existing changes in the worktree.

Do not edit the specification or `add-lesson` to make a conflicting correction permissible. Creation-only instructions from `add-lesson`—including collecting a new title and position, deriving a new lesson ID, creating a file, and registering a new curriculum entry—do not apply. When its creation workflow conflicts with this editing workflow, follow this skill.

If the requested correction would violate a fixed count, fixed order, prescribed outline, one-topic boundary, 30-minute limit, backward-dependency rule, or another requirement, stop and explain the conflict.

## 2. Resolve the lesson and its scope

Before editing:

1. Validate that the required lesson-slug argument is 1–64 characters composed of at least two lowercase kebab-case segments separated by single `/` characters.
2. Search lesson frontmatter and resolve the exact slug to exactly one `knowledge/lessons/<course-id>/<lesson-id>.md` file. If it is invalid, absent, or does not resolve exactly once, stop and request a valid lesson slug; never guess or offer a title or file path as an equivalent.
3. Resolve exactly one parent `knowledge/courses/<course-id>.md` whose `lessons` array contains the exact slug. Confirm that the slug begins with that course's frontmatter slug followed by `/`.
4. Read the target lesson, the parent course, and every lesson in the course's ordered curriculum. Identify the target's position and distinguish earlier dependencies from later consumers.
5. Check the requested correction against every applicable course-specific OpenSpec requirement and against neighboring lessons to prevent duplication, gaps, and forward dependencies.

Pause when an invalid identity, missing parent reference, duplicate topic, ambiguous requested outcome, or specification conflict requires a material author choice.

Preserve the existing lesson slug, source path, title, and topic unless the fix instruction explicitly requires changing the relevant value. Always preserve the curriculum position. Do not turn a correction into a new lesson, add a second topic, move the lesson, create or delete lesson files, or alter unrelated curriculum entries. If the requested material belongs in a separate lesson, stop and recommend using `add-lesson` instead.

## 3. Research the correction

Use repository material and authoritative primary sources. Verify current commands, APIs, versions, compatibility claims, URLs, and other changeable facts instead of relying on memory. Prefer official documentation and link directly to useful sources from the lesson when appropriate.

Keep research proportional for stable, conceptual topics. Never fabricate a command, result, quotation, or citation.

## 4. Edit the lesson

Apply the requested correction completely while preserving unaffected wording and structure. Follow these rules:

- Write all learner-facing text, including the title, description, headings, examples, and image alt text, only in English.
- Keep the lesson focused on exactly one topic and realistically completable within 1–30 minutes.
- Address a beginner without a separate prerequisites section.
- Include only the theory needed to begin practical work; move quickly to a concrete explanation, example, or small learner action when the topic permits it.
- Build only on material in earlier lessons. Never introduce a dependency on a later lesson.
- Follow terminology, formatting, emphasis, command, link, and scope requirements specific to the course.
- Preserve the frontmatter shape required by `src/content.config.ts`. Update the description and tags only when the corrected lesson makes them inaccurate; keep tags concise, reusable, lowercase, and consistent with the course.
- Use valid Markdown, fenced-code language identifiers, accurate examples, and concise headings. Do not repeat the title as an H1 because the page layout renders it from frontmatter.
- Do not add an installation guide, prerequisites section, or cheatsheet. Include setup only when the requested correction makes it necessary to the approved topic and the specification permits it.

Change the parent course or another lesson only when the requested correction would otherwise leave a factual inconsistency or broken reference. Keep every such edit minimal and within the author's instruction.

## 5. Preserve content identity

Treat the published lesson slug as stable. When the fix instruction does not explicitly require an identity change, leave the slug and every course reference unchanged even if the title changes.

When an intentional identity change is explicitly required:

1. Derive the replacement slug automatically from the corrected title and course context; do not require the author to supply it.
2. Keep the slug within 64 characters, begin it with the parent course slug, and use lowercase kebab-case segments separated by single `/` characters.
3. Confirm global uniqueness across course, lesson, and cheatsheet frontmatter.
4. Update the parent course reference and every other affected reference or route together without changing curriculum order.

Pause only if resolving a collision or choosing the intended identity requires a material author decision.

## 6. Verify the result

Re-read the corrected lesson, parent course, all course lessons affected by its dependencies, the applicable OpenSpec requirements, and the relevant `add-lesson` constraints. Confirm:

- The requested correction is complete and no unrelated content changed.
- The lesson's explicit slug still resolves uniquely, begins with the parent course slug, and exactly matches its course reference.
- Any intentional identity change updated every affected reference and route without changing curriculum order.
- Frontmatter matches `src/content.config.ts`; the description and tags remain accurate.
- The lesson is English-only, atomic, beginner-focused, and realistically completable within 30 minutes.
- Every dependency points backward in the curriculum.
- Course-specific requirements and verified facts are satisfied.
- No lesson, installation guide, prerequisites section, or cheatsheet was added or removed.

Run `pnpm run ci` when available; otherwise run the repository's relevant content validation and build commands. Also run `git diff --check` and inspect the final diff. Do not stage or commit changes unless explicitly requested.

Report the corrected lesson path, its explicit slug, a concise summary of the fix, every other file changed for consistency, validation results, and any verification that could not be completed.
