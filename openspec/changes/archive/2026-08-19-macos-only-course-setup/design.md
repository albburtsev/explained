## Context

See `proposal.md` for the motivation and `specs/course-content/spec.md` for the behavioral contract. Course material currently lives as structured Markdown under `knowledge/courses/` and `knowledge/lessons/`; future installation-guide and cheatsheet sources are also learner-facing content. Repository authoring workflows already read `AGENTS.md` and the main course-content specification, while `pnpm run ci` executes Vitest, Astro checks, and the production build.

The current violation is concentrated in Vim: its overview offers macOS, Debian/Ubuntu, and Windows installation paths, and its configuration lesson documents Linux/macOS and Windows vimrc locations. OpenSpec setup content already presents macOS-compatible Homebrew and npm paths.

## Goals / Non-Goals

**Goals:**

- Make the platform boundary explicit in the repository guidance used by course-authoring workflows.
- Remove non-macOS setup procedures without changing content identity, routes, or curriculum order.
- Add a regression check for unambiguous non-macOS setup guidance while retaining semantic review for cases that cannot be classified reliably by keywords.
- Keep each remaining installation or configuration flow complete and accurate for macOS.

**Non-Goals:**

- Blanket-ban words such as “Windows”, “Linux”, or “Unix” when they appear outside procedural installation or configuration guidance.
- Rewrite platform-neutral technical concepts that are valid on macOS.
- Add runtime platform detection, separate OS variants, or a new application dependency.

## Decisions

### Treat structured learner content as the policy boundary

Update the repository authoring rules and audit every structured source that can publish learner-facing course material: course overviews, lesson metadata and bodies, installation guides, and cheatsheets. Generated outputs, such as a cheatsheet PDF, inherit the source policy and are not an independent authority.

This uses the content model’s existing source-of-truth boundary. Limiting the change to currently rendered course and lesson files was rejected because it would leave future installation guides and cheatsheets unconstrained.

### Preserve macOS-compatible neutral procedures

Judge a procedure by whether it works on macOS, not by whether every command is unique to macOS. Homebrew steps are explicitly macOS-focused; portable npm, Git, shell, and editor commands may remain when the surrounding flow is valid on macOS. Alternative headings, commands, paths, and UI steps for another OS are removed rather than translated into parallel variants.

A blanket list of allowed commands was rejected because many valid macOS workflows use cross-platform tools and would become needlessly restrictive.

### Combine deterministic checks with semantic review

Add a content-policy validation helper and Vitest coverage for unambiguous non-macOS setup markers, such as OS-labeled installation/configuration alternatives and platform-specific package-manager commands or paths. Scan raw structured Markdown so frontmatter and bodies are both covered, and include positive fixtures for permitted macOS and platform-neutral guidance plus negative fixtures for prohibited alternatives.

Keep a repository-wide semantic audit in the implementation and authoring workflow because a keyword validator cannot reliably distinguish every conceptual mention from an instruction. Do not reject bare mentions of other operating systems without procedural setup context.

A repository-wide ban on OS names was rejected because it would produce false positives for legitimate conceptual comparisons. Relying only on manual review was rejected because known command and path forms can be caught cheaply in CI.

### Migrate Vim without changing its curriculum

In the Vim course overview, retain one coherent macOS installation path and remove the Debian/Ubuntu and Windows alternatives. In the configuration lesson, document only the macOS vimrc location and remove Windows-specific paths and practice instructions. Re-read all other current course sources during implementation and edit any additional non-macOS setup procedure found by the semantic audit.

This targeted migration avoids unrelated editorial changes and preserves stable slugs, lesson order, and routes.

## Risks / Trade-offs

- [A pattern-based check misses indirectly worded non-macOS guidance] → Keep the normative rule in authoring guidance and require a semantic audit in addition to automated checks.
- [A pattern-based check rejects a harmless conceptual reference] → Match procedural context and unambiguous commands or paths, and cover allowed conceptual mentions with tests.
- [Removing an alternative also removes context needed by macOS learners] → Review each affected section as a complete macOS flow after deletion rather than deleting isolated lines only.
- [Future content types are added outside the validated globs] → Keep the policy stated at the content-model level and update the validation source list whenever a new learner-facing collection is introduced.

## Migration Plan

1. Add the macOS-only rule to repository authoring guidance and implement the focused content-policy validation with fixtures.
2. Audit all current structured course content and revise every non-macOS installation or configuration procedure, starting with the identified Vim files.
3. Run the focused tests and the full project CI, then inspect the remaining OS references to confirm each is either macOS guidance or a permitted non-procedural mention.

Rollback consists of reverting the authoring rule, validator, tests, and content edits together. There is no data migration, dependency change, or route migration.
