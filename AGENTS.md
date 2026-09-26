# Agent Instructions

Explained is a content-first knowledge base built from structured Markdown and published as a static website. Preserve the domain rules below whenever creating or modifying course content or the systems that manage it.

## Course model

- A course is a short, focused introduction for someone new to a subject.
- It includes only the theory needed to begin practical work and avoids unnecessary background.
- It has no separate prerequisites.
- It contains one or more lessons in a fixed order.
- A lesson may be independent or may rely only on lessons that appear earlier in the course.
- An installation guide is optional. When present, it appears before the first lesson and is not counted as a lesson.
- All learner-facing course content exists in English and Russian. English is the source version; Russian is its translation, faithful in meaning and natural in style. See `Languages and translations`.

## Lesson model

- A lesson is the smallest unit of a course.
- It covers exactly one topic.
- It is designed to take between 1 and 30 minutes.
- It is represented by one Markdown file, `knowledge/lessons/<course-id>/<NN>-<lesson-id>.md`, where `<NN>` is its two-digit position in the course `lessons` list. The number only sorts files and is not part of the slug; renumber the files when the order changes.
- Its Russian translation is a sibling file with the same name and a `.ru.md` extension.

## Content identity

- Every course, lesson, and cheatsheet has a human-readable `slug` in the frontmatter of its structured source document.
- A slug contains 1 to 64 characters arranged as lowercase kebab-case segments separated by single `/` characters.
- A course slug has one segment. A lesson or cheatsheet slug starts with its parent course slug followed by `/` and recognizable topic context.
- Slugs are globally unique across courses, lessons, and cheatsheets.
- Derive slugs automatically from the entity's English title and context. Do not require the human author to provide them as additional input.
- The English source document declares the slug. Its Russian translation repeats the same slug and is not a separate entity, so it does not take part in the uniqueness check.
- Astro uses the frontmatter slug as the entity's entry ID, route, and reference key. Treat a published slug as stable; if it changes intentionally, update every affected reference and route together.

## Languages and translations

- Store the English source as `<name>.md` and its Russian translation as `<name>.ru.md` in the same directory: `knowledge/courses/<course-id>.ru.md` for a course and `knowledge/lessons/<course-id>/<NN>-<lesson-id>.ru.md` for a lesson. Installation guides and cheatsheets follow the same rule.
- A lesson translation has the same `<NN>` as its source. When lesson files are renumbered, rename each translation together with its source.
- Translation frontmatter contains only `slug`, `title`, and `description`. Structural metadata, such as `catalogOrder`, `lessons`, and `tags`, lives only in the English source.
- A translation mirrors its source: the same sections in the same order, the same `:::details` blocks, and the same illustrations in the same places. Keep code blocks, commands, output, identifiers, and URLs byte-identical, including comments inside code. Translate prose, headings, `:::details` labels, and alt text.
- Apply every change to both language versions in the same change. Never edit only one of them.
- The human author may write titles and instructions in English or Russian. Keep the author's exact wording in the language they used and generate the other language. When the author gives a Russian title, create the English title first, because the English title is the source for the slug.
- Every English source has a Russian translation; validation fails when one is missing.

## Course authoring

- Require the human author to provide the course title and ordered lesson outline in English or Russian.
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
- Never add an illustration by default when generating or revising a lesson. Add one only after an explicit request from the human author. Store a lesson illustration as a raster file in `knowledge/lessons/<course-id>/<lesson-id>/` and embed it with a relative Markdown image. Each language has its own image: `<name>.<ext>` for English and `<name>.ru.<ext>` for Russian. The alt text and any text inside the image use the language of the lesson version that embeds it.
- Write learner-facing prose for a reader with B2 English: choose the common word over the rare one, carry one idea per sentence, and prefer several short sentences to a long chain of clauses.
- The B2 rule applies only to English. Write Russian in a calm, literary, natural style, so the text reads as if it were written in Russian rather than translated mechanically. Rephrase and restructure sentences freely while keeping the meaning, facts, and structure of the source. Use complex words and terms when the thought needs them.
- Keep the subject's own vocabulary intact. Simplify the wording around a domain term instead of replacing the term. In Russian, professional terminology may stay in English; keep each term in one form throughout the course.
- In both languages, wrap an important domain term in Markdown inline code at the point where it is defined or first explained. Leave later routine mentions unformatted unless they are a literal command, path, filename, or identifier.

## Cheatsheet model

- A cheatsheet is a compact, printable PDF placed after the final lesson.
- It summarizes the course's useful commands, concepts, or keyboard shortcuts in a space-efficient layout.
- It is not a lesson and does not count toward the course's lesson total.
- Its structured source document contains the authoritative frontmatter and `slug`; the generated PDF does not need to duplicate that frontmatter.

## Site interface

- The home page is a content-first catalogue: course entries begin immediately below the site header, without a visible `Explained` or `Courses` heading, introductory copy, promotional calls to action, or decorative artwork. Keep a non-visible semantic heading for assistive technology.
- The home page is the only course catalogue. Do not add a separate courses index page at `/courses/`; course and lesson routes keep the `courses/` prefix.
- Sort the catalogue by `catalogOrder` in descending order. Never let alphabetical title order override it.
- The Explained logo is the only graphic element in the site interface; illustrations requested by the author may appear only inside lesson content. Express search, theme selection, metadata, navigation, and state through text, typography, rules, and color. Render catalogue and curriculum entries as typographic list rows separated by subtle rules rather than cards, illustrations, or icon-led tiles.
- Use a system serif role for content headings, course titles, and long-form prose; a system sans-serif role for controls, navigation, and metadata; and a system monospace role for code. Do not download an external font.
- Keep spacing compact while preserving comfortable line height and contrast. Every page shares the same outer content width and gutters as the site header, so the layout does not shift between pages. On lesson pages, the lesson heading, article, and lesson navigation form a left-aligned reading column of about 65–75 characters per line inside that width. Content reflows on narrow viewports without horizontal page scrolling, overlap, clipped controls, or unreadably small prose.
- Set long-form prose for comfortable reading, following e-reader practice: serif body text from about 18px on phones to 20px on desktops, line height about 1.6, and headings in the text color. In the dark theme, avoid pure white on pure black; use a warm dark gray background with softened text.
- Derive colors, typography roles, spacing, content widths, borders, and radii from a small semantic token set, and style every shared state from it, including focus, hover, code, search results, borders, and muted text.
- Render the dark theme when no preference is saved. Provide a warm, paper-like light theme with equivalent semantic roles and readable contrast, not a cold or pure-white palette. Code highlighting follows the active theme.
- Keep the theme control minimal and keyboard-accessible in the header. It communicates the next available theme, applies the alternate theme immediately, persists an explicit choice for later visits, and falls back safely to the dark default when preference storage is unavailable.
- Breadcrumbs start with the home link and continue with the course and, on a lesson page, the lesson. Do not add a `Courses` crumb.
- Keep shared chrome minimal: the header holds the Explained home link, search, the language switch, and the theme control without a `Courses` menu item, and the footer keeps the source link without a build-technology message.
- Publish English at the existing routes and Russian under the `/ru/` prefix, with the same slugs. Every page, including search, uses the interface strings and content of its language.
- Place the language switch directly before the theme control. It is a plain text link, `Ru` or `En`, that names the other language and opens the same page in that language.
- Preserve existing behavior when changing the interface: routes, Markdown-rendered content, course ordering, curriculum links, previous and next lesson navigation, local search, keyboard interaction, and semantic page landmarks.

## Project skills

- Project skills live in `.agents/skills/<name>/`; `.claude/skills/` contains symlinks to them.
- When a skill takes invocation arguments, begin its frontmatter `description` with the argument signature in inline code, without the skill name: `<required-arg>` for a required argument and `[optional-arg]` for an optional one, followed by ` — ` and the summary. Double-quote the value, because a plain YAML scalar cannot start with a backtick.
- Repeat the same signature in the frontmatter `argument-hint` and at the start of `short_description` in `agents/openai.yaml`. Keep all three consistent with the skill's argument section.
- A skill that takes structured input instead of positional arguments has no signature.
