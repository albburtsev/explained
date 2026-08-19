## Why

Course catalogues are currently sorted alphabetically by title, so authors cannot intentionally sequence courses for discovery or editorial emphasis. The catalogue needs an explicit, content-owned order that remains consistent everywhere courses are listed.

## What Changes

- Add a required `catalogOrder` field to course frontmatter as the author-controlled catalogue sort key.
- Require every published course to have a unique positive integer `catalogOrder`; missing, invalid, or duplicate values fail validation.
- Sort both the home-page catalogue and `/courses` by ascending `catalogOrder` through one shared ordering helper.
- Migrate existing courses without changing their current visible order: Git, OpenSpec, then Vim.
- Update the course creation workflow to assign each new course an order after all existing courses without asking the author for another required input.
- Keep course routes, lesson order, and relevance-based search-result ordering unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `course-content`: Add explicit, validated catalogue-order metadata to courses and automatic end-of-catalogue placement during course creation.
- `site-interface`: Display every course catalogue in the author-defined order instead of alphabetical title order.

## Impact

- Course collection schema and course Markdown frontmatter under `knowledge/courses/`.
- Shared content-ordering logic and the home and `/courses` catalogue pages.
- Course metadata validation and related automated tests.
- The `$add-course` authoring workflow and course-content documentation/specification.
- No new runtime dependencies, route changes, or search-index contract changes.
