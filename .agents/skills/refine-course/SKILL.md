---
name: refine-course
description: "`<course-slug-or-title>` — Refine all English and Russian Markdown for an existing Explained course selected by a required course slug or exact title. Use when the human author invokes `$refine-course` with that identifier to make the course overview and every listed lesson concise, coherent, clear to a B2 English reader, rendered in natural, literary Russian, and technically rigorous without changing published identity or curriculum order."
argument-hint: "<course-slug-or-title>"
---

# Refine Course

Improve one existing course as a complete curriculum in both languages. Inspect its overview and every listed lesson with their Russian translations, but change a file only when the edit makes the content materially clearer, shorter, or more coherent.

## Required argument

Treat all text after `$refine-course` as one required course identifier:

```text
$refine-course <course-slug-or-title>
```

Accept either the exact frontmatter `slug` or the exact frontmatter `title` of the English source or its Russian translation. If the argument is missing, stop and ask the author to supply it before inspecting or editing course content. Do not infer the course from conversation context, a directory name, a lesson, or the current branch.

## Load the course and its rules

1. Locate the repository root and read every applicable `AGENTS.md` completely and freshly. Treat its domain rules as authoritative.
2. Read `src/content.config.ts` and the repository's validation commands.
3. Resolve the argument against course frontmatter. It must match exactly one course by `slug` or `title`; stop when it matches none or is ambiguous.
4. Read the course file and every lesson referenced by its `lessons` array, in curriculum order, together with each `.ru.md` translation. Confirm that each reference resolves exactly once and belongs to the selected course.
5. Preserve unrelated and pre-existing worktree changes.

Treat the selected course file, its listed lesson files, and their translations as the complete editing scope. A missing translation is a validation error; report it instead of guessing the content. Do not add, delete, rename, or reorder lessons. Preserve course and lesson slugs, English titles, paths, `catalogOrder`, tags, and references. Change a Russian title only when it is not an accurate translation. A broken or ambiguous curriculum reference requires author input; do not guess its target.

## Refine the material

First assess the curriculum as a whole: its assumed knowledge, term introductions, progression, repetition, and gaps. Then refine the English overview and lessons so they work both individually and in order. Refine the English source before its translation, then bring each Russian file into line with its final source.

Apply these criteria to all learner-facing prose, including frontmatter descriptions:

- **Simple English:** Write for a B2 (upper-intermediate) English reader. Prefer common concrete words, active voice, direct statements, and sentences with one clear main idea. Split dense clauses and avoid idioms, decorative language, rare synonyms, and long noun chains.
- **Exact terminology:** Keep the established technical terms for the subject. Do not replace them with vague or invented alternatives. Introduce an unfamiliar term with a short, exact definition, then use it consistently.
- **No filler:** Remove generic introductions, repeated conclusions, duplicated explanations, tangents, inflated transitions, and secondary background that does not help the learner understand or use the topic. Keep every fact, condition, warning, and example needed for correctness.
- **Coherent lessons:** Keep each lesson focused on its declared topic. Put ideas in a logical order, introduce a concept before using it, connect examples to the point they demonstrate, and close genuine reasoning gaps with the smallest sufficient explanation.
- **Concise definitions:** Prefer a short direct definition over a long lead-in. State what a term is and, only when needed, why it matters in this lesson.
- **Clear progression:** A lesson may rely only on earlier lessons. Remove needless cross-lesson repetition, but retain enough context for the current explanation to remain clear. Never create a dependency on a later lesson.

Then refine every Russian translation:

- **Faithful mirror:** The translation carries exactly the source's meaning, facts, sections, `:::details` blocks, and illustrations in the same order. Code, commands, output, identifiers, and URLs are byte-identical to the source.
- **Natural Russian:** The B2 rule does not apply here. Write in a calm, literary, natural style that does not read as a mechanical translation. Rephrase and restructure sentences freely; complex words and terms are fine when the thought needs them.
- **Terminology:** Professional terms may stay in English. Use each term in one form consistently across the course.
- **Frontmatter:** Keep only `slug`, `title`, and `description`, with the source slug and accurate translations of the other two.

Keep the course overview brief and aligned with the actual ordered lessons. Keep every lesson within one topic and a realistic 1–30 minute completion time. Do not add a prerequisites section, installation guide, cheatsheet, or new curriculum material.

## Protect technical accuracy

Clarity and brevity must not weaken rigor. Preserve exact names, commands, code behavior, syntax, API identifiers, protocol keywords, constraints, caveats, and expected results. Never shorten a statement until it becomes broader or more certain than the evidence supports.

Correct a factual defect encountered inside the editing scope when authoritative evidence makes the correction clear. Verify current commands, APIs, version claims, compatibility statements, and other changeable facts with primary official sources. Keep research proportional for stable conceptual material, and never fabricate a source, command, output, or result.

Follow all repository content rules, including the `Languages and translations` rules, macOS-only setup guidance, concise dependency statements, beginner focus, valid Markdown, and fenced-code language identifiers.

## Verify the result

Re-read the course and every listed lesson in order, in both languages. Confirm that:

- every file was reviewed against the refinement criteria;
- the English prose is understandable at B2 level without distorted terminology;
- every source has a Russian translation that mirrors it, reads as natural, literary Russian, and has only `slug`, `title`, and `description` in its frontmatter;
- definitions are brief and exact, filler is removed, and each lesson has an unbroken line of thought;
- examples, commands, qualifications, and technical claims remain correct;
- the overview matches the curriculum and dependencies point only backward;
- English titles, slugs, paths, tags, references, `catalogOrder`, lesson count, and lesson order are unchanged;
- no unrelated material or new content type was added.

Run `pnpm run ci` when available; otherwise run the repository's relevant content validation and build commands. Run `git diff --check` and inspect the final diff. Do not stage or commit changes unless explicitly requested.

Report the resolved course path and slug, every changed file, every translation created, the main improvements, any reviewed file intentionally left unchanged, validation results, and anything that could not be verified.
