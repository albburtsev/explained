## 1. Slug Validation

- [x] 1.1 Add a required path-like `slug` field of at most 64 characters to the shared Astro data shape, accepting one or more lowercase kebab-case segments separated by single `/` characters.
- [x] 1.2 Add type-safe repository-wide content validation that inventories structured content slugs, rejects duplicates across content types, and reports every conflicting source path.
- [x] 1.3 Add focused tests for valid course and path-shaped child slugs, missing or malformed values, repeated separators, and a duplicate shared by different content types.

## 2. Existing Content Migration

- [x] 2.1 Add the planned `greetings` and `openspec` slugs to the two existing course frontmatter blocks without changing their lesson references.
- [x] 2.2 Add the planned `greetings/hello-world` and `openspec/...` path-shaped slugs to all four existing lesson frontmatter blocks without renaming or moving their files.
- [x] 2.3 Verify that every migrated slug is globally unique, equals its previous file-derived Astro entry ID, and preserves generated routes and ordered lesson references.

## 3. Authoring Contract

- [x] 3.1 Update `AGENTS.md` to require automatically derived, globally unique path-like slugs and document that they control entry IDs, routes, and references without becoming new human input.
- [x] 3.2 Update `README.md` course and lesson examples to show path-like slugs, explain their format and global uniqueness, and document their route identity and stability semantics.
- [x] 3.3 Update the `add-lesson` skill to derive `<course-slug>/<lesson-id>`, check it against all structured content, write it in the exact frontmatter template, and verify route/reference consistency.
- [x] 3.4 Document that a future cheatsheet collection and authoring workflow must use a parent-course-prefixed path-like slug and join the same repository-wide uniqueness validation, without implementing that content type.

## 4. Verification

- [x] 4.1 Run the targeted content tests and confirm failures identify affected source paths, invalid path syntax, and duplicate slug values.
- [x] 4.2 Run `pnpm run ci` and `git diff --check`, then inspect the final diff to confirm unchanged file paths, URLs, and lesson ordering.
