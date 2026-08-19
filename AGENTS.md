# Agent Instructions

Explained is a content-first knowledge base built from structured Markdown and published as a static website. Preserve the domain rules below whenever creating or modifying course content or the systems that manage it.

## Course model

- A course is a short, focused introduction for someone new to a subject.
- It includes only the theory needed to begin practical work and avoids unnecessary background.
- It has no separate prerequisites.
- It contains one or more lessons in a fixed order.
- A lesson may be independent or may rely only on lessons that appear earlier in the course.
- An installation guide is optional. When present, it appears before the first lesson and is not counted as a lesson.
- All learner-facing course content is written only in English.

## Lesson model

- A lesson is the smallest unit of a course.
- It covers exactly one topic.
- It is designed to take between 1 and 30 minutes.
- It is represented by one Markdown file.

## Content identity

- Every course, lesson, and cheatsheet has a human-readable `slug` in the frontmatter of its structured source document.
- A slug contains 1 to 64 characters arranged as lowercase kebab-case segments separated by single `/` characters.
- A course slug has one segment. A lesson or cheatsheet slug starts with its parent course slug followed by `/` and recognizable topic context.
- Slugs are globally unique across courses, lessons, and cheatsheets.
- Derive slugs automatically from the entity title and context. Do not require the human author to provide them as additional input.
- Astro uses the frontmatter slug as the entity's entry ID, route, and reference key. Treat a published slug as stable; if it changes intentionally, update every affected reference and route together.

## Course authoring

- Require the human author to provide the course title and ordered lesson outline in English.
- Generate the short course description and lesson content automatically.
- Every course source declares a positive integer `catalogOrder` that is unique across courses and controls ascending catalogue position.
- Treat `catalogOrder` as sparse, non-learner-facing metadata: leave numeric gaps where practical, and do not let it affect slugs, routes, or lesson order.
- Assign a new course's `catalogOrder` automatically after all existing courses. Do not require it as additional human input.
- Do not add a prerequisites section.
- Treat installation guides as optional preparatory material rather than lessons.
- Write all learner-facing installation and configuration instructions for macOS only. This applies to course overviews, lesson metadata and bodies, installation guides, and cheatsheets.
- Platform-neutral setup instructions are allowed only when they work on macOS. Do not provide setup alternatives for Windows, Linux, or any other operating system; non-procedural references to other operating systems remain allowed.
- Do not generate a cheatsheet during routine course creation. Generate one only after an explicit request from the human author.

## Cheatsheet model

- A cheatsheet is a compact, printable PDF placed after the final lesson.
- It summarizes the course's useful commands, concepts, or keyboard shortcuts in a space-efficient layout.
- It is not a lesson and does not count toward the course's lesson total.
- Its structured source document contains the authoritative frontmatter and `slug`; the generated PDF does not need to duplicate that frontmatter.
