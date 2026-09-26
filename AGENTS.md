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
- Every course source declares a positive integer `catalogOrder` that is unique across courses and controls descending catalogue position.
- Treat `catalogOrder` as sparse, non-learner-facing metadata: leave numeric gaps where practical, and do not let it affect slugs, routes, or lesson order.
- Assign a new course `catalogOrder: 10` when the catalogue is empty or the greatest existing value plus `10` otherwise, so the new course appears first without changing existing courses. Do not require `catalogOrder` as additional human input.
- Do not add a prerequisites section.
- Treat installation guides as optional preparatory material rather than lessons.
- Write all learner-facing installation and configuration instructions for macOS only. This applies to course overviews, lesson metadata and bodies, installation guides, and cheatsheets.
- Platform-neutral setup instructions are allowed only when they work on macOS. Do not provide setup alternatives for Windows, Linux, or any other operating system; non-procedural references to other operating systems remain allowed.
- State required software dependencies concisely inside the relevant setup guidance, using the shortest accurate version constraint such as `Node.js v20+`; do not add a separate prerequisites section or enumerate versions when one accurate range is enough.
- Do not provide commands or procedures to install, upgrade, select, or verify the version of a dependency. Commands may still install or verify the course's primary tool and may initialize, configure, or run the learning project, including project generators that manage their own packages.
- Do not generate a cheatsheet during routine course creation. Generate one only after an explicit request from the human author.
- Never add a `:::details[Label]` collapsible disclosure by default when generating or revising a lesson. Add one only after an explicit request from the human author.
- Never add an illustration by default when generating or revising a lesson. Add one only after an explicit request from the human author. Store a lesson illustration as a raster file in `knowledge/lessons/<course-id>/<lesson-id>/`, embed it with a relative Markdown image, and give it English alt text; any text inside the image is English too.
- Write learner-facing prose for a reader with B2 English: choose the common word over the rare one, carry one idea per sentence, and prefer several short sentences to a long chain of clauses.
- Keep the subject's own vocabulary intact. Simplify the wording around a domain term instead of replacing the term.
- Wrap an important domain term in Markdown inline code at the point where it is defined or first explained. Leave later routine mentions unformatted unless they are a literal command, path, filename, or identifier.

## Cheatsheet model

- A cheatsheet is a compact, printable PDF placed after the final lesson.
- It summarizes the course's useful commands, concepts, or keyboard shortcuts in a space-efficient layout.
- It is not a lesson and does not count toward the course's lesson total.
- Its structured source document contains the authoritative frontmatter and `slug`; the generated PDF does not need to duplicate that frontmatter.

## Site interface

- The home page is a content-first catalogue: course entries begin immediately below the site header, without a visible `Explained` or `Courses` heading, introductory copy, promotional calls to action, or decorative artwork. Keep a non-visible semantic heading for assistive technology.
- Sort every complete catalogue, on the home page and on `/courses`, by `catalogOrder` in descending order. Never let alphabetical title order override it.
- The Explained logo is the only graphic element in the site interface; illustrations requested by the author may appear only inside lesson content. Express search, theme selection, metadata, navigation, and state through text, typography, rules, and color. Render catalogue and curriculum entries as typographic list rows separated by subtle rules rather than cards, illustrations, or icon-led tiles.
- Use a system serif role for content headings, course titles, and long-form prose; a system sans-serif role for controls, navigation, and metadata; and a system monospace role for code. Do not download an external font.
- Keep spacing compact while preserving comfortable line height and contrast. On lesson pages, the lesson heading, article, and lesson navigation share the site header's outer content width and gutters. Content reflows on narrow viewports without horizontal page scrolling, overlap, clipped controls, or unreadably small prose.
- Derive colors, typography roles, spacing, content widths, borders, and radii from a small semantic token set, and style every shared state from it, including focus, hover, code, search results, borders, and muted text.
- Render the dark theme when no preference is saved. Provide a warm, paper-like light theme with equivalent semantic roles and readable contrast, not a cold or pure-white palette.
- Keep the theme control minimal and keyboard-accessible in the header. It communicates the next available theme, applies the alternate theme immediately, persists an explicit choice for later visits, and falls back safely to the dark default when preference storage is unavailable.
- Keep shared chrome minimal: the header holds the Explained home link, search, and theme control without a `Courses` menu item, and the footer keeps the source link without a build-technology message.
- Preserve existing behavior when changing the interface: routes, Markdown-rendered content, course ordering, curriculum links, previous and next lesson navigation, local search, keyboard interaction, and semantic page landmarks.

## Project skills

- Project skills live in `.agents/skills/<name>/`; `.claude/skills/` contains symlinks to them.
- When a skill takes invocation arguments, begin its frontmatter `description` with the argument signature in inline code, without the skill name: `<required-arg>` for a required argument and `[optional-arg]` for an optional one, followed by ` — ` and the summary. Double-quote the value, because a plain YAML scalar cannot start with a backtick.
- Repeat the same signature in the frontmatter `argument-hint` and at the start of `short_description` in `agents/openai.yaml`. Keep all three consistent with the skill's argument section.
- A skill that takes structured input instead of positional arguments has no signature.
