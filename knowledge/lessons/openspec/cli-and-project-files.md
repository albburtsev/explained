---
title: Understand the CLI and Project Files
description: See how the OpenSpec package, terminal commands, artifacts, and directories work together.
tags:
  - openspec
  - cli
  - project-structure
---

`OpenSpec` is distributed as the npm package `@fission-ai/openspec`. The package exposes a command-line interface (`CLI`) through a binary named `openspec`. npm or Homebrew installs that binary; after installation, you run `openspec` commands directly rather than using npm to operate each change.

The CLI is the common engine behind every coding-agent integration. It knows how to initialize a project, resolve its `workflow schema`, report artifact status, validate specifications, and archive completed work. A `coding-agent skill` provides the instructions and judgment needed to drive that engine safely.

## Core terminal commands

These commands cover the setup and inspection work a beginner needs most often:

```sh
openspec init                         # initialize the current project
openspec update                       # refresh generated agent instructions
openspec list                         # list active changes
openspec list --specs                 # list main specifications
openspec status --change <name>       # show artifact readiness and progress
openspec show <name>                  # display a change or specification
openspec validate --all --strict      # validate changes and specifications
openspec view                         # open the interactive dashboard
```

Coding-agent skills may also call lower-level commands such as `openspec new change`, `openspec instructions`, and `openspec archive`. You can inspect those commands yourself, but normally the skill coordinates them while you review the files it creates.

## The project tree

An initialized project keeps its durable OpenSpec data under `openspec/`:

```text
openspec/
├── config.yaml
├── specs/
│   └── <capability>/
│       └── spec.md
└── changes/
    ├── <change-name>/
    │   ├── .openspec.yaml
    │   ├── proposal.md
    │   ├── design.md
    │   ├── tasks.md
    │   └── specs/
    │       └── <capability>/
    │           └── spec.md
    └── archive/
        └── <date>-<change-name>/
            └── ...completed change artifacts
```

`config.yaml` selects the workflow schema and can add project context or artifact-specific rules.

`Main specifications`, stored under `specs/`, are the source of truth for the system's current agreed behavior. They are grouped by capability and contain requirements with concrete scenarios.

`Active changes`, stored under `changes/`, contain work that is proposed or in progress. Each change is isolated in its own directory, so its intent, behavior updates, technical decisions, and task progress can be reviewed together.

The `archive`, stored under `changes/archive/`, preserves completed changes. It explains not only what the system does now, but also why and how it evolved.

## Main specifications and delta specifications

A main specification describes current behavior. A `delta specification` inside a change describes only the difference that change proposes: requirements to add, modify, remove, or rename.

```text
openspec/specs/search/spec.md
                 ▲
                 │ merged during sync or archive
                 │
openspec/changes/improve-search/specs/search/spec.md
```

Keeping the delta separate lets you review or implement multiple changes without pretending their proposed behavior is already part of the system. When a completed change is archived, its delta is incorporated into the main specification and the full change directory is retained as history.

## The artifact dependency graph

The default spec-driven schema connects the planning artifacts like this:

```text
                proposal
                /      \
             specs    design
                \      /
                  tasks
                    │
              implementation
```

Together, the `proposal`, `specifications`, optional `design`, and `task list` are `planning artifacts`. The proposal establishes intent and scope. Specifications define observable behavior. A design records technical decisions when the change needs them. A task list turns the reviewed plan into trackable implementation work. `Artifact dependencies` show which information enables the next artifact; they do not prevent you from revising earlier artifacts when understanding changes.

## Agent integration files

`openspec init` also writes files where each selected coding agent expects to find skills or commands. For example:

```text
.agents/skills/openspec-*/SKILL.md     # Codex and shared agent skills
.claude/skills/openspec-*/SKILL.md     # Claude Code skills
.claude/commands/opsx/*.md             # Claude Code commands
.opencode/skills/openspec-*/SKILL.md   # OpenCode skills
.opencode/commands/opsx-*.md            # OpenCode commands
```

These `agent integration files` are adapters, not the project specification itself. Run `openspec update` after upgrading the CLI to refresh them. Keep the `openspec/` directory in version control so the current requirements, active plans, tasks, and decision history travel with the codebase.
