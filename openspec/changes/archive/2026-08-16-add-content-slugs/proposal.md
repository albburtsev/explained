## Why

Courses and lessons currently rely on file-derived Astro entry IDs, while the content itself has no explicit, human-readable identifier. Adding a required `slug` to each content entity makes references unambiguous and gives current and future content tooling a stable identifier that is visible in the entity's own frontmatter.

## What Changes

- **BREAKING** Require every course, lesson, and future cheatsheet source document to declare a non-empty `slug` in its own frontmatter.
- Define slugs as globally unique, human-readable paths composed of lowercase kebab-case segments separated by `/`, so a slug identifies exactly one entity across all supported content types.
- Use each frontmatter `slug` as the entity's Astro entry ID and therefore as its route and reference key.
- Validate slug syntax and cross-entity uniqueness during content validation or the build, with actionable errors for missing, malformed, or duplicate values.
- Backfill slugs for every existing course and lesson with values equal to their previous file-derived entry IDs. There are no existing cheatsheets to migrate.
- Document the path-like `slug` contract in the content authoring examples while preserving current URLs and course lesson references.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `course-content`: Require explicit, globally unique frontmatter slugs for courses, lessons, and cheatsheets.

## Impact

- Affects Markdown frontmatter under `knowledge/courses/` and `knowledge/lessons/`, plus the frontmatter contract for future cheatsheet source files.
- Affects Astro content schemas and repository validation tests or build checks.
- Affects content-authoring documentation and examples.
- Makes frontmatter `slug` authoritative for Astro entry IDs, routes, and references; changing a published slug can therefore change its URL or break references.
- Does not change existing URLs, file paths, lesson reference values, or the learner-visible course structure because migrated slugs match the previous generated IDs.
