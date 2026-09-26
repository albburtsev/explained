---
slug: tmux/herdr
title: Herdr
description: Organize persistent local and remote terminal work and supervise multiple AI coding agents with Herdr.
tags:
  - herdr
  - terminal-multiplexers
  - coding-agents
  - macos
---

Herdr is a terminal workspace manager designed for coding-agent workflows. Like tmux, it keeps terminal processes in a background session while you detach and reconnect. Its own model adds project-level workspaces and agent status, so you can find the terminal that needs attention without checking every pane in turn.

## Start Herdr

Move to a project and start Herdr there:

```sh
cd path/to/your-project
herdr
```

The first run starts or attaches to the default background session. When that session has no workspace, Herdr creates one automatically.

## Understand the layout

Herdr organizes terminals in three levels:

- A **workspace** is the top-level container for one repository, task, or investigation.
- A **tab** is one layout within a workspace. Tabs can separate work such as agents, a development server, tests, and logs.
- A **pane** is a real terminal running a shell, agent, or other process. A pane survives when the client detaches.

This resembles the session, window, and pane hierarchy from tmux, but Herdr is its own client-and-server tool. Its background server owns the terminals and process state; the visible terminal UI is an attached client.

## Work with the mouse

Herdr is mouse-native. Click a workspace, tab, pane, or agent to focus it. Right-click to open context menus for actions such as creating a tab or splitting a pane. Drag a split border to resize panes, and drag over text to copy it.

On macOS, use Control-click to open a link handled by Herdr while mouse capture is enabled. Normal Command-click belongs to the outer terminal unless you use its bypass behavior.

A simple project layout might use:

- one workspace for the repository;
- an `agents` tab split into two or more agent panes;
- a `runtime` tab for a development server and tests;
- a `review` tab for inspecting diffs and logs.

## Use the essential keys

Herdr uses the same default prefix as tmux: press Control-B, release it, and then press the action key. In the table, `prefix` means that two-step sequence.

| Action | Key |
| --- | --- |
| Show active bindings | `prefix+?` |
| Create a tab | `prefix+c` |
| Split right | `prefix+v` |
| Split down | `prefix+minus` |
| Focus panes | `prefix+h/j/k/l` |
| Next or previous tab | `prefix+n` / `prefix+p` |
| Open workspace navigation | `prefix+w` |
| Create a workspace | `prefix+shift+n` |
| Zoom the focused pane | `prefix+z` |
| Close the focused pane | `prefix+x` |
| Detach the client | `prefix+q` |

The mouse can perform the same everyday layout and navigation tasks, so you can learn the shortcuts gradually. Use `prefix+?` as the live reference because it reflects your active configuration.

## Supervise AI coding agents

Start a coding agent in an ordinary pane with the agent's own command—for example, `codex` or `claude`. Herdr detects common agents and shows their state in the sidebar. State rolls up from panes to tabs and workspaces:

- `working` means an agent is active;
- `blocked` means it needs input, approval, or a decision;
- `done` means it finished and has not been viewed yet;
- `idle` means it is waiting or its finished state has already been seen.

This supports a practical parallel workflow:

1. Give each repository its own workspace.
2. Run independent agents in separate panes or tabs so each keeps its own terminal and context.
3. Put tests, servers, and logs in other panes instead of mixing their output with an agent.
4. Watch the sidebar rather than polling every agent. Visit `blocked` agents first, then review agents marked `done`.
5. Detach when work can continue unattended and reattach later to the same session.

Automatic detection works without extra setup for supported agents. Optional Herdr integrations can provide richer lifecycle and session information; consult the official integration page for the agent you use rather than assuming every agent reports status in the same way.

## Work on a remote host

Required dependency: SSH access to the remote host. Herdr supports two remote workflows; for the SSH-first path, Herdr must already be available on that host.

For the tmux-style path, open an SSH shell first and run Herdr on the remote host:

```sh
ssh workbox
herdr
```

For Herdr's thin-client mode, attach directly from your local terminal:

```sh
herdr --remote workbox
```

The local Herdr client connects over SSH, starts or attaches to the remote Herdr server, and renders that remote workspace locally. A full SSH URL can include the user and port:

```sh
herdr --remote ssh://you@server:2222
```

Use a named remote session when you want an isolated set of workspaces, panes, and agents:

```sh
herdr --remote workbox --session agents
```

Run coding agents in the remote panes exactly as you do locally. Detach with `prefix+q`; the remote server and agents continue running. Repeating the same `herdr --remote` command returns to them, which lets long-running agent work survive a laptop sleep, terminal closure, or interrupted connection.

## Detach, return, or stop

Detaching removes only the visible client. Press `prefix+q`, or close the outer terminal window, and the Herdr server keeps panes and agents running. Reattach from another terminal by running:

```sh
herdr
```

Closing a pane is different: `prefix+x` stops that pane's terminal. Use it when the work in that pane is finished.

To end the entire default session and stop every process in its panes, run:

```sh
herdr server stop
```

Use server stop deliberately: unlike detach, it does not leave agents running. For most breaks or terminal-window changes, detach and reattach instead.

## Official resources

- [Herdr quick start](https://herdr.dev/docs/quick-start/)
- [Workspaces, tabs, panes, agents, and sessions](https://herdr.dev/docs/concepts/)
- [Keyboard controls](https://herdr.dev/docs/keyboard/)
- [Agent detection and status](https://herdr.dev/docs/agents/)
- [Agent integrations](https://herdr.dev/docs/integrations/)
- [Persistence and remote access](https://herdr.dev/docs/persistence-remote/)
