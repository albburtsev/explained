---
slug: tmux/orca-basics
title: Orca Basics
description: Learn how Orca organizes projects, worktrees, tabs, and agent sessions, then start your first agent and find your way back to it.
tags:
  - orca
  - coding-agents
  - git-worktrees
  - macos
---

Orca is a desktop app for working with AI coding agents. It does not include its own model. Instead, it runs the CLI agents you already use, such as Claude Code or Codex, and helps you track them in one window.

Herdr from the previous lesson organizes terminals around a project. Orca adds one more layer: every task gets its own git worktree. A `git worktree` is an extra working directory of the same repository. It has its own branch and its own files on disk, but it shares the repository history. Because each agent works in its own directory, agents never edit each other's files.

## Understand the model

Orca arranges your work in four levels:

- A `project` is a git repository that you add to Orca. Orca reads its default branch and uses it as the `base ref`, usually `origin/main`. New worktrees branch from it by default.
- A worktree holds one task. It has its own branch, its own files, and its own terminals. The sidebar lists worktrees under their project and calls each one a workspace.
- A `tab` holds one thing: a terminal, an editor file, a browser page, a diff, or a pull request. Tabs live in panes, and you can split a pane to see several tabs at once.
- An `agent session` is one CLI agent running in one terminal in one worktree. Orca tracks its state, so you can see which agents are working and which are waiting for you.

![The Orca main window. The left sidebar lists worktrees, a Claude Code terminal fills the middle pane, and a Markdown file is open in a split pane on the right.](./orca-basics/orca-main-window.jpg)

Every Orca worktree is a real git worktree. You can open a terminal in it and run plain `git` commands at any time. When you delete a worktree in Orca, it removes both the directory and the branch after you confirm.

## Add a project

The course overview already installed Orca with Homebrew. Open Orca from the Applications folder or with Spotlight.

On first launch, Orca asks for access to your home directory so that it can add repositories. It also offers to import your `~/.claude` and `~/.codex` folders and your Ghostty terminal settings if they exist. Then it shows an empty start screen.

To add your first project:

1. Click **Add project**. The button is on the start screen and in the sidebar header.
2. In the **Add a project** dialog, choose **Browse folder**.
3. Select a local checkout of a git repository.

The same dialog can also clone a repository with **Clone from URL** or start one with **Create new project**. The new project appears in the sidebar.

## Start your first session

You need one CLI coding agent, such as Claude Code or Codex, that is already installed and signed in. Orca launches it for you, so you do not type the agent's command yourself.

1. Press `Cmd+N`, or click the **+** next to the project name in the sidebar. A dialog for the new worktree opens.
2. Check that your project is selected.
3. Type a short task name in the workspace name field, such as `explain-repo`. The name is optional; without one, Orca picks a name for you.
4. Pick an agent in **Agent**. You can also choose **Blank Terminal** to start with a plain shell.
5. Press `Cmd+Enter` or click the create button.

![The dialog for a new worktree with fields for the repository, the workspace name, and the agent. Claude is selected as the agent, and the create button is at the bottom right.](./orca-basics/create-workspace-dialog.jpg)

Orca creates the worktree in the background, checks out a new branch, and opens it. The agent you picked starts in the first tab. Its working directory is the new worktree.

Give the agent a safe first task that only reads code:

```text
Explain the structure of this repository in five bullet points.
```

Orca starts supported agents with their full-autonomy flag by default, so the agent does not ask before it runs commands. A worktree keeps the agent's file changes away from your main checkout, but it is not a security sandbox. Start with read-only tasks; the next lesson shows where to change agent permissions.

## Watch agent status

You do not need to open every tab to check on an agent. Agent tabs and sidebar rows show a small status mark:

- a spinner means the agent is working;
- an amber question mark means it is waiting for your permission or answer;
- a green dot means it has finished;
- a red dot means it is blocked, interrupted, or has failed;
- a gray dot means it is idle.

Orca reads this state from the agent itself. If a tab shows no mark, Orca does not recognize the program in it. Start agents through Orca's agent picker rather than by typing the command in a plain shell.

When an agent exits, its tab shows a **Restart** chip. One click starts the same agent again in the same directory.

## Work with tabs and splits

Each worktree has its own set of tabs. A few shortcuts cover daily work:

| Action | Shortcut |
| --- | --- |
| New terminal tab | `Cmd+T` |
| New agent tab with your default agent | `Cmd+Option+T` |
| Close the active tab | `Cmd+W` |
| Next or previous tab | `Cmd+Shift+]` / `Cmd+Shift+[` |

To split a pane, drag a tab to its edge. The right edge places the tabs side by side. The bottom edge stacks them. Splits can nest, and any tab type can sit next to any other. A terminal tab can also split itself: open its tab menu and choose **Split terminal right** or **Split terminal down**.

Orca saves the layout for each worktree. When you switch to another worktree, its terminals, files, and splits reappear exactly as you left them.

## Jump with Quick Open and the Jump Palette

With a few worktrees open, finding things takes time. Orca has two keyboard tools for this:

- `Quick Open` (`Cmd+P`) searches files in the current worktree and opens the chosen file in an editor tab.
- The `Jump Palette` (`Cmd+J`) searches every worktree and every open tab. Type part of a project or worktree name and press Enter to go there.

With an empty query, the Jump Palette lists your recent agent and terminal sessions first. Sessions that need you appear at the top. `Cmd+1` to `Cmd+6` jump to the first rows. Press `Shift+Enter` on a worktree to open it in a new split instead of replacing the current pane. The **Search** button at the top of the sidebar opens the same palette.

## Quit and come back

Orca restores your session on every launch. It brings back the open worktrees, tabs and splits, terminal scrollback, and the tab you had focused.

Running agents survive a normal quit. A background process owns the terminals, so when you press `Cmd+Q`, agents keep working. This is similar to detaching from a Herdr session. The next launch reconnects to the same processes. The same is true when Orca restarts for an update or crashes.

A reboot or power loss is different. It stops every agent. On the next launch, the layout and the last saved scrollback come back, but the agent processes are gone. Use the **Restart** chip or start the agent again in its tab.

Orca always restores the last session. For a clean start, close the worktrees you no longer need before you quit.

## Official resources

- [What is Orca?](https://www.onorca.dev/docs)
- [Your first 3-agent session](https://www.onorca.dev/docs/first-session)
- [Worktrees](https://www.onorca.dev/docs/model/worktrees)
- [Tabs, panes, and split layouts](https://www.onorca.dev/docs/model/tabs-panes-splits)
- [Agents and sessions](https://www.onorca.dev/docs/model/agents-sessions)
- [Session restore](https://www.onorca.dev/docs/model/session-restore)
- [Quick Open and Jump Palette](https://www.onorca.dev/docs/model/quick-open)
