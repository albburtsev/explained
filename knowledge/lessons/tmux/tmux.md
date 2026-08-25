---
slug: tmux/tmux
title: Tmux
description: Learn the tmux session, window, pane, hotkey, remote, and detach workflow.
tags:
  - tmux
  - terminal-multiplexers
  - macos
---

tmux is a terminal multiplexer: it keeps multiple shells and programs inside one terminal, and it can leave them running after you close or disconnect the terminal client. This makes it useful for long-running commands and for organizing several related tasks without opening many terminal windows.

## Start a named session

Create and immediately enter a session named `work`:

```sh
tmux new-session -s work
```

A tmux **client** now fills your terminal. It is attached to the `work` **session**, which initially contains one **window** with one **pane**:

- A session is the durable workspace that survives detachment.
- A window fills the client and acts like a tab.
- A pane is one terminal area inside a window and runs a shell or another program.

The status line shows the session name and its windows. Your typing goes to the active pane in the current window.

## Use the prefix key

Programs inside a pane receive normal keystrokes. To control tmux, first press its default **prefix**, `Ctrl-b`, release it, and then press a command key. The notation `C-b c`, for example, means `Ctrl-b` followed by `c`; it is not one simultaneous chord.

These bindings cover the core workflow:

| Keys | Action |
| --- | --- |
| `C-b c` | Create a new window |
| `C-b ,` | Rename the current window |
| `C-b n` / `C-b p` | Move to the next / previous window |
| `C-b 0` … `C-b 9` | Select a window by number |
| `C-b %` | Split the active pane into left and right panes |
| `C-b "` | Split the active pane into upper and lower panes |
| `C-b` + arrow key | Move to the pane in that direction |
| `C-b q` | Briefly show pane numbers; press a number to select one |
| `C-b z` | Zoom or restore the active pane |
| `C-b ?` | Open the complete key-binding list; press `q` to leave it |

Try creating a second window, splitting one window into two panes, and moving between them. Shells and programs belong to their panes: switching to another pane or window does not stop them.

## Detach and return

Detaching closes only the client connection. The session and every program inside it keep running. Press:

```text
C-b d
```

Back in the regular shell, list the available sessions:

```sh
tmux list-sessions
```

Reattach to the named session:

```sh
tmux attach-session -t work
```

This detach-and-reattach cycle is the central tmux workflow: start work once, leave it running, and return from a later terminal.

## Keep remote work alive

tmux does not provide its own remote transport. Instead, connect to a remote host with SSH and run tmux on that host. Required dependency: SSH access to the remote host; tmux must already be available there.

Connect and create a session named `remote-work`, or attach to it when it already exists:

```sh
ssh workbox
tmux new-session -A -s remote-work
```

If the SSH connection closes, the tmux server and programs continue running on the remote host. Connect again and run the same `tmux new-session -A -s remote-work` command to return. The `-A` flag makes one command cover both create and attach, while `-s` supplies the session name.

This is useful for a remote editor, development server, test suite, or coding agent that should survive a network interruption. Detach with `C-b d` before leaving when possible, but an accidental SSH disconnect does not end the session.

## Exit deliberately

`exit` ends the shell in the active pane. With the default behavior, ending the final pane also removes its window; ending the final window ends the session. Use this only when you intend to finish that work:

```sh
exit
```

To stop the entire named session from an ordinary shell, including every program in its windows and panes, run:

```sh
tmux kill-session -t work
```

Use `C-b d` when work should continue and `exit` or `kill-session` when it should end. That distinction prevents accidentally terminating a long-running process.

## Official resources

- [tmux Getting Started guide](https://github.com/tmux/tmux/wiki/Getting-Started)
- [tmux manual](https://man.openbsd.org/tmux.1)
- [tmux Homebrew formula](https://formulae.brew.sh/formula/tmux)
