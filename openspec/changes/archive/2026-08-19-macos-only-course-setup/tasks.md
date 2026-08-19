## 1. Authoring Policy and Validation

- [x] 1.1 Update `AGENTS.md` to require macOS-only installation and configuration guidance across course overviews, lessons, installation guides, and cheatsheets, while allowing macOS-compatible platform-neutral instructions and non-procedural OS references.
- [x] 1.2 Implement a reusable content-policy validator that scans raw learner-facing Markdown and reports source paths for unambiguous non-macOS installation or configuration alternatives without blanket-banning operating-system names.
- [x] 1.3 Add focused Vitest coverage with accepted macOS, platform-neutral, and conceptual-reference fixtures plus rejected OS-labeled setup, package-manager, path, and shell/UI alternative fixtures; run the validator against the repository content sources.

## 2. Existing Content Migration

- [x] 2.1 Audit all current structured course sources for installation and configuration procedures, recording every non-macOS instruction that requires removal and distinguishing permitted conceptual references.
- [x] 2.2 Revise `knowledge/courses/vim.md` so its installation section presents one complete macOS path and no Debian/Ubuntu or Windows alternative.
- [x] 2.3 Revise `knowledge/lessons/vim/configuration.md` so vimrc locations and practice steps are macOS-only, with all Windows- and Linux-specific alternatives removed.
- [x] 2.4 Correct any additional non-macOS setup guidance discovered by the repository-wide audit while preserving frontmatter slugs, course references, lesson order, and routes.

## 3. Verification

- [x] 3.1 Run the focused content-policy and repository-content tests and confirm both allowed and prohibited fixture behavior.
- [x] 3.2 Run `pnpm run ci` and resolve any content schema, type-check, test, or build regressions.
- [x] 3.3 Re-scan all learner-facing sources for operating-system and platform-specific setup markers, manually verify every remaining match is macOS guidance or a permitted non-procedural reference, and confirm the Vim macOS flows remain complete.
- [x] 3.4 Run strict OpenSpec validation for `macos-only-course-setup` and fix any planning-artifact conformance errors before handoff.
