## 1. Course Metadata and Migration

- [x] 1.1 Extend the Astro course collection schema with a required positive-integer `catalogOrder` while leaving lesson metadata unchanged.
- [x] 1.2 Add `catalogOrder: 10`, `20`, and `30` to Git, OpenSpec, and Vim respectively, and confirm their slugs, routes, and ordered lesson references are unchanged.

## 2. Catalogue Ordering

- [x] 2.1 Add a shared course-catalogue helper that reports every course in a duplicate `catalogOrder` group and returns a non-mutating ascending sort for valid collections.
- [x] 2.2 Replace the independent title-based sorts on the home page and `/courses` with the shared helper while leaving route generation and the search index unchanged.

## 3. Authoring Workflow and Guidance

- [x] 3.1 Update `AGENTS.md` and the relevant README course-frontmatter guidance to define `catalogOrder` as required, unique, positive, sparse catalogue metadata that is not learner-facing.
- [x] 3.2 Update `$add-course` so it derives `10` for the first course or the current maximum plus `10`, writes the value into the scaffold, never asks the author for it, and verifies the final course remains last and unique.

## 4. Verification

- [x] 4.1 Add unit coverage for ascending catalogue order, title-independent order, non-mutating sorting, and actionable duplicate diagnostics.
- [x] 4.2 Add repository-level coverage that all course documents declare valid unique `catalogOrder` values and that the migrated collection retains Git, OpenSpec, then Vim order.
- [x] 4.3 Run strict OpenSpec validation, `pnpm run ci`, and `git diff --check`, then inspect the final diff for unintended route, lesson-order, or search-order changes.
