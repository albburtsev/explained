---
slug: tmux
title: Tmux / Herdr / Orca
catalogOrder: 50
description: Keep terminal work alive with tmux, supervise AI coding agents with Herdr, and ship code with parallel agents in Orca.
tags:
  - tmux
  - terminal-multiplexers
  - coding-agents
  - orca
lessons:
  - tmux/tmux
  - tmux/herdr
  - tmux/orca-basics
  - tmux/orca-settings
  - tmux/orca-issue-to-merged-pr
  - tmux/orca-parallel-agents
  - tmux/orca-browser-and-design-mode
  - tmux/orca-remote-worktrees
---

A terminal multiplexer keeps shells and long-running programs available independently of one terminal window. This course begins with tmux and its session, window, pane, and prefix-key model. It then applies the same durable-terminal ideas to Herdr's workspace for coding agents.

The second part of the course moves to Orca, a desktop app for development with AI coding agents. Orca runs each agent in its own git worktree, so several agents can work in parallel without touching each other's changes. You will take a GitHub task all the way to a merged pull request and learn the tools Orca adds around that flow.

## Install tmux, Herdr, and Orca on macOS

If you use Homebrew, install the tools before starting the lessons. Run these commands on each macOS host that will own your sessions:

```sh
brew install tmux
brew install herdr
brew install --cask stablyai/orca/orca
```

Confirm that the tmux command is available:

```sh
tmux -V
```

Homebrew manages any supporting libraries required by these formulas; do not install those dependencies separately.

## What you will learn

- How to install and start tmux, work with sessions, windows, and panes, use essential hotkeys, keep remote work alive, and distinguish detach from exit.
- How to install and operate Herdr, navigate its workspaces, tabs, and panes, supervise multiple AI coding agents, and reconnect to work running on a remote host.
- How Orca organizes repositories, worktrees, and agents, and how to configure it for GitHub, agents, and workspaces.
- How to take a GitHub issue to a merged pull request in Orca and review the agent's diff along the way.
- How to run several agents on one task and coordinate them with the Orca CLI.
- How to work on UI with Orca's browser and Design Mode, and how to run agents in remote worktrees over SSH.
