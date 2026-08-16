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

## Course authoring

- Require the human author to provide the course title and ordered lesson outline in English.
- Generate the short course description and lesson content automatically.
- Do not add a prerequisites section.
- Treat installation guides as optional preparatory material rather than lessons.
- Do not generate a cheatsheet during routine course creation. Generate one only after an explicit request from the human author.

## Cheatsheet model

- A cheatsheet is a compact, printable PDF placed after the final lesson.
- It summarizes the course's useful commands, concepts, or keyboard shortcuts in a space-efficient layout.
- It is not a lesson and does not count toward the course's lesson total.
