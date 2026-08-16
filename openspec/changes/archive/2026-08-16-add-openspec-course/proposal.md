## Why

Explained currently has only a placeholder course and needs its first practical beginner course. A focused English-language OpenSpec course will give newcomers enough context, setup guidance, and workflow knowledge to begin using specification-driven development with a coding agent.

## What Changes

- Add an English-language course titled `OpenSpec` with a generated short description and exactly three lessons in the author-provided order.
- Introduce OpenSpec, the problems it addresses, its role in specification-driven development, and links to the official website, repository, documentation, and package.
- Explain macOS installation through Homebrew and global npm, including version verification and project initialization without a separate installation guide.
- Teach the complete day-to-day coding-agent workflow from exploration and proposal through implementation review, correction, re-application, and archive. Explain when to continue `$openspec-apply-change` for unfinished tasks, when to use `$openspec-update-change` after completed implementation reveals a defect or a planning gap, and why the corrected plan must be applied and verified before archive, using Codex syntax as the primary example and noting that invocation syntax varies by agent.
- Explain the separation between the npm-distributed CLI, terminal commands, coding-agent commands or skills, and the files OpenSpec creates in a project.
- Show the main `openspec/` directories, planning artifacts, generated agent-integration files, and the lifecycle from an active change to archived specifications.
- Emphasize every important OpenSpec definition in the course overview and lessons with Markdown inline-code formatting at its defining occurrence, while leaving routine repetitions unstyled.
- Keep every lesson focused and completable within 30 minutes, with no prerequisites section or cheatsheet.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `course-content`: Require publication of the `OpenSpec` course with its fixed three-lesson English curriculum and bounded introductory content.

## Impact

- Adds one course Markdown file under `knowledge/courses/` and three ordered lesson Markdown files under `knowledge/lessons/openspec/`.
- Changes published knowledge-base content without changing the content schema, routes, application code, dependencies, or build tooling.
- Introduces external links and version-sensitive command examples that must be checked against official OpenSpec, npm, and Homebrew sources during implementation.
