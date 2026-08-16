## Context

See `proposal.md` for motivation and `specs/course-content/spec.md` for the behavior contract. Without a frontmatter `slug`, Astro's glob loader derives each collection entry's ID from its Markdown path. Courses refer to those lesson IDs, and route generation uses them. Astro treats frontmatter `slug` as a reserved override for the generated entry ID; the first implementation attempt exposed this behavior when flat lesson slugs no longer matched existing path-shaped references.

The frontmatter schemas in `src/content.config.ts` validate individual course and lesson records but do not enforce invariants across collections. The repository's `add-lesson` skill defines the exact lesson frontmatter shape, while `AGENTS.md` and `README.md` define the broader authoring contract. Cheatsheets are specified as optional printable PDFs but are not yet implemented as a content collection.

## Goals / Non-Goals

**Goals:**

- Give every structured content entity an explicit, readable slug that intentionally serves as its Astro entry ID.
- Preserve every existing route and lesson reference by matching migrated slugs to the previous file-derived IDs.
- Reject missing, malformed, or globally duplicated slugs before publication.
- Make authoring workflows derive slugs automatically rather than requesting an additional human input.

**Non-Goals:**

- Changing any existing route, file path, or ordered lesson reference.
- Introducing a second metadata-only identifier alongside Astro's entry ID.
- Implementing the cheatsheet content collection, PDF generation, routes, catalogue, or search support.
- Displaying slugs separately in the learner-facing interface or adding them to search text.

## Decisions

### Use Astro's frontmatter `slug` override intentionally

The field remains named `slug`. Astro uses this reserved field as the content entry ID, so route generation and typed content references consume the explicit value automatically. This aligns the requested human-readable identifier with the site's existing identity mechanism instead of creating a parallel `data.id` field.

Alternative considered: switch to a frontmatter `id` that Astro treats only as data. Rejected by the confirmed revision in favor of keeping `slug` and matching its values to the path-shaped IDs already used by the site.

### Use one global namespace of kebab-case path segments

All content types share one slug namespace. Values contain at most 64 characters and match `^[a-z0-9]+(?:-[a-z0-9]+)*(?:/[a-z0-9]+(?:-[a-z0-9]+)*)*$`. Course slugs use one segment. Lesson and cheatsheet slugs begin with their parent course slug, followed by `/` and recognizable topic context.

Alternative considered: flat slugs such as `openspec-introduction`. Rejected because Astro would replace the existing `openspec/introduction` entry ID with that flat value, breaking current references and URLs.

### Preserve routes with explicit copies of the generated IDs

The migration uses these values:

| Entity | `slug` |
| --- | --- |
| Greetings course | `greetings` |
| OpenSpec course | `openspec` |
| Hello, World! lesson | `greetings/hello-world` |
| Meet OpenSpec lesson | `openspec/introduction` |
| Work with a Coding Agent lesson | `openspec/coding-agent-workflow` |
| Understand the CLI and Project Files lesson | `openspec/cli-and-project-files` |

These values exactly reproduce the entry IDs previously generated from file paths. They are written explicitly and become authoritative: moving a source file will no longer change identity by itself, while intentionally changing a published slug becomes a route and reference migration.

### Validate both individual records and the repository-wide invariant

The course and lesson schemas will require a shared Zod slug shape so Astro rejects missing and malformed values with the affected entry context. A repository content validation test will inventory every supported structured source document, collect its type, path, and slug, then report all paths participating in a duplicate. The existing `pnpm run ci` command runs Vitest before publication, so the global uniqueness check belongs in that validation path without adding a runtime dependency.

When a cheatsheet collection is implemented, it must reuse the same field schema and join the same repository-wide uniqueness check. Until then, the OpenSpec and authoring rules establish that contract; this change does not create a placeholder cheatsheet implementation.

Alternative considered: rely only on collection-local schema validation. Rejected because a record-local schema cannot compare a value against another entry or content type.

### Keep authoring guidance and automation aligned

`AGENTS.md` and `README.md` will document the path-like format, route semantics, stability expectation, and global uniqueness rule. The `add-lesson` skill will derive `<course-slug>/<lesson-id>`, check it across all structured content, and include it in the exact frontmatter template while continuing not to ask the human author for a slug. Future course and cheatsheet authoring workflows must follow the same rule.

## Risks / Trade-offs

- [Changing a published slug changes its route identity] → Treat slugs as stable and require intentional updates to every affected reference when a change is necessary.
- [Record-local schema validation cannot guarantee global uniqueness] → Add a repository-level invariant test that reports every conflicting path and keep it in the publication CI command.
- [A source file can move without its explicit slug changing] → Document the slug as authoritative; this stability is intentional, and authors must update it explicitly when they also intend a route migration.
- [Cheatsheets have no structured source schema yet] → Specify the requirement now and require the future collection and authoring workflow to reuse the validator without creating an incomplete content type.
- [The 64-character limit may constrain deeply descriptive paths] → Keep the course prefix and derive concise topic segments rather than copying titles verbatim.

## Migration Plan

1. Require path-like slugs in the current Astro course and lesson schemas and add repository-wide uniqueness validation.
2. Add course slugs and path-shaped lesson slugs that exactly match the previous generated entry IDs.
3. Update authoring rules, examples, and the `add-lesson` workflow with the route semantics and derivation rule.
4. Run targeted tests and the complete CI command, confirming that entry IDs, URLs, and ordered lesson references remain unchanged.

Rollback is file-local: remove the schema field, uniqueness validation, documentation changes, and migrated frontmatter keys. With the source files left in place, Astro will resume generating the same entry IDs from their paths.
