# Explained

Explained is a personal knowledge base made of structured Markdown and published as a static website. The first supported content types are courses and lessons; concise cheatsheets are planned for a later iteration.

## Domain model

A course is a short, focused introduction for someone new to a subject. It avoids unnecessary background and moves from essential theory to practice. A course has no separate prerequisites and contains one or more lessons in a fixed order. Lessons may be independent or may rely only on lessons that appear earlier in the course.

A lesson is the smallest unit of a course. It covers exactly one topic, is designed to take between 1 and 30 minutes, and is stored in one Markdown file.

An optional installation guide may appear before the first lesson. It prepares the learner's environment, but is not a lesson and does not count toward the course's lesson total.

When creating a course, the human author provides its title and ordered lesson outline in English. The course description and lesson content are generated automatically. All learner-facing course content—including titles, descriptions, lessons, installation guides, and cheatsheets—is written only in English. Installation guides and cheatsheets remain optional.

A cheatsheet is a compact, printable PDF placed after the final lesson. It summarizes useful commands, concepts, or keyboard shortcuts using a space-efficient layout. It is not a lesson, does not count toward the course's lesson total, and is generated only when the human author explicitly requests it.

## Requirements

- Node.js 26 (`package.json` enforces `>=26 <27`)
- pnpm 11

This repository is configured for the project site at `https://albburtsev.github.io/explained/`.

## Development

```sh
pnpm install
pnpm dev
```

Useful commands:

```sh
pnpm check   # TypeScript, Astro, and content validation
pnpm test    # Unit tests
pnpm build   # Static production build
pnpm run ci  # All checks followed by a production build
```

## Knowledge structure

The knowledge base lives outside the site implementation:

```text
knowledge/
├── courses/
│   └── openspec.md
└── lessons/
    └── openspec/
        ├── cli-and-project-files.md
        ├── coding-agent-workflow.md
        └── introduction.md
```

A course defines its ordered curriculum through typed lesson references:

```yaml
---
slug: openspec
title: OpenSpec
catalogOrder: 20
description: Learn to plan and deliver coding-agent changes with lightweight, file-based specifications.
tags: [openspec, spec-driven-development, coding-agents]
lessons:
  - openspec/introduction
  - openspec/coding-agent-workflow
  - openspec/cli-and-project-files
---
```

Every course declares a unique positive integer `catalogOrder`. Complete course catalogues sort by this value in ascending order. The values are intentionally sparse—normally `10`, `20`, `30`, and so on—so an author can move or insert a course without renumbering the whole catalogue. This field is repository metadata rather than learner-facing content and does not affect slugs, routes, or lesson order. Course-creation workflows assign the next value automatically instead of requesting it from the human author.

A lesson is stored below its parent course ID:

```yaml
---
slug: openspec/introduction
title: Meet OpenSpec
description: Understand why OpenSpec exists, install it on macOS, and initialize a project.
tags: [openspec, spec-driven-development, macos]
---
```

Every course, lesson, and future cheatsheet source declares a human-readable `slug` of at most 64 characters. A course uses one lowercase kebab-case segment. A lesson or cheatsheet starts with its parent course slug, followed by `/` and one or more lowercase kebab-case topic segments. Slugs are globally unique across all content types, and authoring workflows derive them automatically rather than requiring another human-provided field.

Astro uses the explicit `slug` as the content entry ID, route, and typed reference key. To add content, create the lesson Markdown file and add its slug to the parent course's `lessons` list. Missing references fail the build. Treat a published slug as stable because changing it changes identity and may require coordinated reference and route updates.

## Search

The build emits a static search index containing titles, descriptions, tags, and plain text extracted from Markdown. The browser loads it on first use and performs typo-tolerant fuzzy search locally with Fuse.js. No search service or server is required.

## Deployment

The `Check and deploy` GitHub Actions workflow validates pull requests. Pushes to `main` additionally publish the generated site to GitHub Pages. In the repository settings, select **GitHub Actions** as the Pages source.

GitHub Pages on the GitHub Free plan requires this repository to be public.

## Planned content

Cheatsheets will become a separate structured content type with their own schema, routes, catalogue, and search entries. They are intentionally not implemented in the first MVP.

When cheatsheet sources are implemented, each frontmatter slug must use a parent-course-prefixed path such as `<course-slug>/<topic>-cheatsheet`, become that entity's entry and route key, and participate in the same repository-wide uniqueness validation as courses and lessons. The printable PDF remains an output associated with that structured source entity.
