## ADDED Requirements

### Requirement: OpenSpec beginner course

The system SHALL publish an English-language course titled `OpenSpec` as a concise introduction for newcomers. The course SHALL contain exactly three lessons in the fixed order defined below, SHALL begin with its first lesson without a separate installation guide, and SHALL NOT include a prerequisites section or cheatsheet.

#### Scenario: Learner opens the OpenSpec course

- **WHEN** a learner opens the `OpenSpec` course
- **THEN** the course presents a generated short description in English
- **AND** lists exactly three lessons in the required order
- **AND** does not present an installation guide, prerequisites section, or cheatsheet as additional course material

### Requirement: Important definition emphasis

The course overview and every lesson SHALL visually distinguish each important OpenSpec term at the point where the term is defined or first explained by wrapping it in Markdown inline-code formatting. Important terms include concepts such as `specification-driven development`, `proposal`, `specification`, `delta specification`, `design`, `task list`, `artifact`, `CLI`, `coding-agent skill`, and `archive`. The content SHALL leave routine repetitions unformatted unless they represent a literal command, path, filename, or identifier.

#### Scenario: Learner encounters an important definition

- **WHEN** the course overview or a lesson defines or first explains an important OpenSpec concept
- **THEN** the defining term is wrapped in Markdown inline-code formatting
- **AND** later routine prose mentions remain unformatted unless they represent literal code-related text

### Requirement: OpenSpec introduction lesson

The first lesson SHALL explain what OpenSpec is, which problems it addresses when requirements otherwise live only in coding-agent chat, and how it supports specification-driven development. It SHALL present Homebrew and global npm as two macOS installation methods, include current runtime and verification guidance, explain project initialization, and link to the official OpenSpec website, repository, documentation, and package page.

#### Scenario: Learner completes the introduction

- **WHEN** a learner completes the first lesson
- **THEN** the learner can describe the purpose of OpenSpec
- **AND** can choose between the documented Homebrew and npm installation methods on macOS
- **AND** can verify the installed CLI and initialize OpenSpec in a project
- **AND** can follow links to the official project resources

### Requirement: Coding-agent workflow lesson

The second lesson SHALL teach how to use OpenSpec with a coding agent. It SHALL distinguish terminal commands from commands or skills invoked in the agent chat, use Codex syntax as the primary concrete example, and note that equivalent invocation syntax varies by agent. It SHALL explain the complete beginner workflow from optional exploration and proposal review through implementation, post-apply review, correction, re-application, verification, and archive. It SHALL explain that unfinished tasks continue through `$openspec-apply-change`, while a defect or planning gap discovered after implementation was marked complete requires `$openspec-update-change` to revise the affected planning artifacts or add corrective tasks before `$openspec-apply-change` is run again. The change SHALL be archived only after the corrected implementation is verified.

#### Scenario: Learner follows a change workflow

- **WHEN** a learner completes the second lesson
- **THEN** the learner knows where to invoke terminal commands and coding-agent commands
- **AND** can start an exploration or proposal with Codex
- **AND** knows to review the planning artifacts before requesting implementation
- **AND** reviews the implementation after apply and does not archive a result known to be incorrect
- **AND** distinguishes an unfinished task from a defect or planning gap discovered after apply was completed
- **AND** can use `$openspec-update-change` to correct the plan or add a corrective task before running `$openspec-apply-change` again
- **AND** archives the change only after the corrected implementation is verified

### Requirement: OpenSpec internals lesson

The third lesson SHALL explain OpenSpec at the package, CLI-command, and project-file levels. It SHALL cover the purpose of the core setup and inspection commands, the roles of `openspec/config.yaml`, main specifications, active changes, delta specifications, planning artifacts, archived changes, and generated coding-agent integration files, and the dependency flow from proposal through tasks and implementation.

#### Scenario: Learner inspects an initialized project

- **WHEN** a learner completes the third lesson and inspects an initialized OpenSpec project
- **THEN** the learner can identify which commands belong in the terminal
- **AND** can locate the current specifications and active or archived changes
- **AND** can explain the roles of proposal, specification, design, and task artifacts
- **AND** can identify where OpenSpec stores instructions for configured coding agents
