---
slug: openspec/introduction
title: Meet OpenSpec
description: Understand why OpenSpec exists, install it on macOS, and initialize a project.
tags:
  - openspec
  - spec-driven-development
  - macos
---

`Coding agents` can move quickly, but speed does not guarantee that the agent and the human have agreed on the same outcome. Requirements kept only in chat can drift as the conversation grows, implementation can begin before important choices are reviewed, and the reasoning behind a finished change can disappear with the session.

`OpenSpec` is a `specification-driven development` tool for coding agents. It stores the intent, requirements, technical decisions, and implementation tasks for a change as Markdown files in the project. You can review those files before code is written, revise them as you learn, and keep them with the repository after the work is complete.

## The problem OpenSpec solves

A useful coding workflow needs more than a detailed prompt. It needs a shared answer to four questions:

1. Why is this change needed?
2. What behavior must the finished system provide?
3. How will the change fit the existing codebase?
4. What work remains?

OpenSpec represents those answers with a `proposal`, `specifications`, an optional `design`, and a `task list`. Together, these files are `planning artifacts`: the coding agent drafts and uses them, while the human reviews the decisions and controls when implementation begins.

This is specification-driven development without a rigid waterfall. The artifacts make the current understanding visible, but they can still be corrected when investigation or implementation reveals something new.

## Install OpenSpec on macOS

Choose one installation method. Installing the same command-line interface (`CLI`) with both package managers can leave two versions on your `PATH`.

### Homebrew

If you manage command-line tools with Homebrew, install its OpenSpec formula:

```sh
brew install openspec
```

Homebrew manages the CLI and its Node.js dependency for you.

### npm

Required dependency: `Node.js v20.19+`.

Then install the CLI globally so the `openspec` command is available across projects:

```sh
npm install -g @fission-ai/openspec@latest
```

## Verify and initialize

Confirm that your shell resolves the installed CLI:

```sh
openspec --version
```

Move into the project that will use OpenSpec and run the interactive initializer:

```sh
cd path/to/your-project
openspec init
```

The initializer asks which coding agents you use and writes the appropriate integration files. To configure Codex without the interactive selection, pass its tool ID explicitly:

```sh
openspec init --tools codex
```

Initialization creates the project-level OpenSpec structure and installs instructions that teach the selected agent how to follow the workflow. It does not require a separate OpenSpec application or background service.

## Official resources

- [OpenSpec website](https://openspec.dev/)
- [OpenSpec repository](https://github.com/Fission-AI/OpenSpec)
- [OpenSpec documentation](https://github.com/Fission-AI/OpenSpec/tree/main/docs)
- [OpenSpec on npm](https://www.npmjs.com/package/@fission-ai/openspec)
- [OpenSpec Homebrew formula](https://formulae.brew.sh/formula/openspec)

With the CLI installed and the project initialized, the next step is to drive a complete change from your coding agent's chat.
