# Explained

Explained is a personal knowledge base made of structured Markdown and published as a static website. The first supported content types are courses and lessons; concise cheatsheets are planned for a later iteration.

## Requirements

- Node.js 26 (`package.json` enforces `>=26 <27`)
- pnpm 10.32.1

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
│   └── greetings.md
└── lessons/
    └── greetings/
        └── hello-world.md
```

A course defines its ordered curriculum through typed lesson references:

```yaml
---
title: Greetings
description: A tiny first course.
tags: [fundamentals, typescript]
lessons:
  - greetings/hello-world
---
```

A lesson is stored below its parent course ID:

```yaml
---
title: Hello, World!
description: Write and run a friendly program.
tags: [fundamentals, typescript]
---
```

To add content, create the lesson Markdown file and add its ID to the parent course's `lessons` list. Missing references fail the build. Course and lesson IDs become URL segments automatically.

## Search

The build emits a static search index containing titles, descriptions, tags, and plain text extracted from Markdown. The browser loads it on first use and performs typo-tolerant fuzzy search locally with Fuse.js. No search service or server is required.

## Deployment

The `Check and deploy` GitHub Actions workflow validates pull requests. Pushes to `main` additionally publish the generated site to GitHub Pages. In the repository settings, select **GitHub Actions** as the Pages source.

GitHub Pages on the GitHub Free plan requires this repository to be public.

## Planned content

Cheatsheets will become a separate structured content type with their own schema, routes, catalogue, and search entries. They are intentionally not implemented in the first MVP.
