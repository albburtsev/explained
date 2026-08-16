---
title: Work with a Coding Agent
description: Guide an OpenSpec change through planning, implementation, correction, and archive.
tags:
  - openspec
  - coding-agents
  - workflow
---

`OpenSpec` has two interfaces. A `terminal command`, such as `openspec init`, sets up or inspects the project. A `workflow command` is invoked in your coding agent's chat, where it loads instructions that tell the agent how to plan, implement, and finish a change.

For Codex, OpenSpec installs skills under `.agents/skills/`. A `coding-agent skill` is a reusable set of workflow instructions that you invoke by typing its `$openspec-*` name in the same chat where you normally ask Codex to change code. These are not shell commands.

## The core workflow

The beginner path has four core actions and one correction action:

```text
explore (optional) → propose → apply → review result → archive
                                  ↑          │
                                  └─ update change ←┘
```

Each action has a distinct authority boundary. `Exploration` investigates without implementing. `Proposal` creates planning artifacts without implementing. `Apply` writes code and works through the tasks. `Update change` revises planning artifacts but never implementation code. `Archive` finishes the change and preserves its history.

### 1. Explore an uncertain idea

Use exploration when you know the problem but have not chosen the solution:

```text
$openspec-explore
I want to make course search easier to use, but I am not sure which behavior should change.
```

Codex can read the codebase, compare approaches, and expose unanswered questions. Exploration does not create a change or write implementation code. Skip it when the desired outcome and constraints are already clear.

### 2. Propose the change

When the idea is ready to plan, invoke:

```text
$openspec-propose
```

Codex creates a named `change` and drafts the `planning artifacts` required by the project's OpenSpec schema. In the default spec-driven workflow, these can include:

- A `proposal` in `proposal.md`: why the change is needed and what is in scope.
- `Delta specifications`: observable requirements and scenarios that will change.
- A `design` in `design.md`: technical decisions when the change needs them.
- A `task list` in `tasks.md`: the ordered implementation checklist.

Stop and review these files before applying the change. Check that the proposal matches your intent, each requirement describes behavior rather than implementation, and the tasks cover the complete outcome. If the plan needs revision, explain the correction in chat and use `$openspec-update-change` to reconcile the existing artifacts.

### 3. Apply the reviewed plan

Start implementation only after the artifacts describe the change you want:

```text
$openspec-apply-change
```

Codex reads the planning artifacts, implements each unchecked task, verifies the work, and checks tasks off as they are completed. If implementation exposes a missing decision or a conflict with the specification, pause and update the plan instead of silently narrowing the requirement.

You can invoke the same skill later to resume from the first unchecked task. The files in the change directory carry the state, so the workflow does not depend on retaining one long chat session.

When apply finishes, do not archive immediately. Inspect the behavior, review the changed files, and run the relevant checks. The result determines whether you can archive or need another pass.

### 4. Review and correct the result

First inspect the task list. If apply paused with unchecked tasks, resolve the reported blocker or answer the agent's question, then invoke the same skill to continue:

```text
$openspec-apply-change
```

An unfinished task does not require a plan update unless the requested behavior or a technical decision has changed.

If every task was checked but review exposes a problem, the completed checklist no longer represents the remaining work. Invoke:

```text
$openspec-update-change
```

Describe which of these cases you found:

- An `implementation defect`: the result disagrees with planning artifacts that are still correct. Keep the proposal, specifications, and design unchanged, and add or reopen a corrective implementation and verification task.
- A `planning gap`: the intended behavior or a technical decision is missing or incorrect in the artifacts. Revise the affected proposal, specifications, design, and tasks so they agree again.

For example, if the requirement is already correct but the implementation violates it, tell Codex exactly what remained wrong:

```text
$openspec-update-change
Apply is complete, but the implementation does not satisfy the existing file-size requirement. Keep the requirement unchanged and add a corrective implementation and verification task.
```

The update skill proposes planning-artifact edits and asks for confirmation one artifact at a time. It does not fix code. After the new or revised tasks accurately describe the correction, apply the change again:

```text
$openspec-apply-change
```

Review the new result and repeat this loop until the implementation matches the artifacts and every relevant check passes.

### 5. Archive the completed change

After every task is complete and the result has been checked, invoke:

```text
$openspec-archive-change
```

Archiving moves the completed change into the dated archive and incorporates its specification updates into the project's main specifications. For a long-running change, `$openspec-sync-specs` can update the main specifications before archive; the normal beginner flow can let archive handle that decision.

## Command names in other agents

The workflow intent is portable, but the spelling follows the files generated by `openspec init`. For example, the proposal action is commonly invoked as:

- Codex: `$openspec-propose`
- Claude Code: `/opsx:propose`
- Cursor: `/opsx-propose`
- Amazon Q: `@opsx-propose`

Use the setup message and generated integration files as the authority for your agent. Regardless of punctuation, keep the same discipline: explore uncertainty, review the proposal, apply the agreed plan, inspect the result, update and re-apply when necessary, and archive only verified work.
