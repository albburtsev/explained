## Context

The course collection schema currently has no catalogue-position metadata. Both `src/pages/index.astro` and `src/pages/courses/index.astro` fetch the complete collection and independently sort it with `title.localeCompare`, while course routes and curricula derive from slugs and lesson references. Course Markdown is the authoritative structured source, and `$add-course` intentionally limits required human input to the title, goal, and ordered lesson outline.

This change spans the content model, repository validation, two catalogue consumers, and the authoring workflow, so the ordering contract needs one shared representation and one shared implementation path.

## Goals / Non-Goals

**Goals:**

- Make catalogue order explicit and easy to edit in course source documents.
- Reject ambiguous ordering before publication with actionable errors.
- Keep all complete course catalogues in sync through shared ordering logic.
- Preserve the existing course-creation inputs and automatically append new courses.

**Non-Goals:**

- Reorder lessons within a course or change content identity and routes.
- Add an administrative UI or drag-and-drop ordering.
- Apply `catalogOrder` to search results, whose order remains relevance-based.
- Require catalogue order values to be contiguous or expose them to learners.

## Decisions

### 1. Store a required sparse integer in each course document

Extend only the course schema with a required positive integer `catalogOrder`. Values are unique across courses, and ascending numeric order is the display order. Existing courses receive `10`, `20`, and `30` for Git, OpenSpec, and Vim respectively.

Sparse values let an author insert or move a course by changing one document when a numeric gap is available. Contiguous positions would make ordinary moves touch many unrelated course files. A central ordered slug manifest was considered, but it would introduce a second registry that can omit or drift from the course collection. Filename prefixes and title sorting were rejected because file paths and titles are content identity and presentation concerns, not explicit editorial ordering.

### 2. Combine schema validation with collection-level validation

The Astro course schema validates that `catalogOrder` exists and is a positive integer. A shared course-catalogue helper validates collection-wide uniqueness, reports the duplicate value and all conflicting course identifiers, and returns a newly sorted collection rather than mutating the loader result.

Both catalogue pages call this helper. This keeps ordering and duplicate handling identical and makes a duplicate fail during site generation instead of producing an implicit tie-break order. Unit tests cover ascending order, non-mutation, and duplicate diagnostics; repository/build validation covers the actual course documents.

A title fallback for duplicate values was considered but rejected because it would conceal invalid author intent and partially restore the behavior being removed.

### 3. Keep ordering out of unrelated collection consumers

Dynamic course and lesson routes may continue to consume the collection in loader order because they map entries rather than present a complete catalogue. The search index also remains unchanged because Fuse relevance, not catalogue position, determines search result order. Only complete catalogue surfaces use the shared ordering helper.

### 4. Append new courses automatically with the same sparse convention

Update `$add-course` so its temporary course scaffold includes a `catalogOrder` equal to the greatest existing value plus `10`; the first course uses `10`. The workflow derives the value after inspecting existing course metadata and never asks the author to supply it. Its final verification confirms that the value is positive, unique, and places the course last.

The creation workflow and repository authoring guidance must describe the field so future generated courses cannot bypass the new schema contract.

## Risks / Trade-offs

- [Authors can accidentally reuse a value] → Fail with a diagnostic listing the duplicate value and every conflicting course rather than applying a silent tie-breaker.
- [Repeated insertions can consume the gaps between nearby values] → Allow any positive integer and let authors renumber a small affected range when no gap remains; contiguity is never required.
- [Two concurrent course additions can both derive the same next value] → Let repository validation expose the conflict before publication so it can be resolved during merge.
- [Making the field required temporarily invalidates unmigrated content] → Land the schema, helper, and all existing frontmatter values in the same implementation change and run the complete CI command.

## Migration Plan

1. Add `catalogOrder` values `10`, `20`, and `30` to Git, OpenSpec, and Vim without changing any other course metadata.
2. Extend the course schema and introduce the validated shared ordering helper.
3. Replace both alphabetical catalogue sorts with the helper.
4. Update tests, repository guidance, and `$add-course`, then run strict OpenSpec validation and the complete project CI command.

Rollback requires reverting the schema, frontmatter, helper consumers, and authoring guidance together; no stored user data or routes require migration.
