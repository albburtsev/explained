---
slug: tmux
title: Tmux
catalogOrder: 50
description: Learn local and remote terminal multiplexing with tmux and use Herdr to keep terminal work and AI coding agents organized and running.
tags:
  - tmux
  - terminal-multiplexers
  - coding-agents
lessons:
  - tmux/tmux
  - tmux/herdr
---

A terminal multiplexer keeps shells and long-running programs available independently of one terminal window. This course begins with tmux and its session, window, pane, and prefix-key model, then applies the same durable-terminal ideas to Herdr's workspace for coding agents.

You will practice the complete lifecycle of each tool: install it on macOS, start a working session, arrange terminal work, use the essential controls, detach without stopping processes, return later, and close the session deliberately.

## Install tmux and Herdr on macOS

If you use Homebrew, install both tools before starting the lessons. Run these commands on each macOS host that will own your sessions:

```sh
brew install tmux
brew install herdr
```

Confirm that the tmux command is available:

```sh
tmux -V
```

Homebrew manages any supporting libraries required by these formulas; do not install those dependencies separately.

## What you will learn

- How to install and start tmux, work with sessions, windows, and panes, use essential hotkeys, keep remote work alive, and distinguish detach from exit.
- How to install and operate Herdr, navigate its workspaces, tabs, and panes, supervise multiple AI coding agents, and reconnect to work running on a remote host.
