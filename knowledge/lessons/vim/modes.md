---
slug: vim/modes
title: Vim Modes
description: Understand Vim's Normal, Insert, Visual, and Command-line modes and learn the keys that switch between them.
tags:
  - vim
  - text-editor
  - modes
---

In most editors, every key you press types text. Vim works differently: it is a `modal` editor, which means it is always in exactly one `mode`, and the same key can do completely different things in different modes. One key might delete a line in one mode and simply type a letter in another. This separation is what makes Vim fast, but it is also what surprises newcomers, so the modes are the first thing to learn.

Vim has several modes, but four of them cover everyday editing: Normal, Insert, Visual, and Command-line. When the `showmode` option is on — the default in Vim — the name of the current mode appears at the bottom of the window, so you can always check where you are.

## Normal mode

`Normal mode` is Vim's home base. The editor starts in this mode when you open a file, and you return to it after every action. Here, keys are commands rather than text: they move the cursor, delete or copy text, and switch to the other modes.

Whenever you finish an action — or feel lost — press `Esc` to get back to Normal mode. If you are ever unsure which mode you are in, pressing `Esc` twice brings you back to Normal mode from almost anywhere.

## Insert mode

`Insert mode` is where typed characters become text in the file, just like in any other editor. From Normal mode, press `i` to enter Insert mode and start inserting before the cursor. While it is active, Vim shows `-- INSERT --` at the bottom of the window.

When you finish typing, press `Esc` to return to Normal mode. Getting used to this trip in and out of Insert mode is the core Vim habit.

## Visual mode

`Visual mode` is for selecting text. It behaves like Normal mode, except that movement commands extend a highlighted selection, and the next command you give applies to everything highlighted instead of a single cursor position.

Three keys start it from Normal mode, each with a different shape of selection:

- `v` selects character by character
- `V` selects whole lines
- `Ctrl-V` selects a rectangular block

Press `Esc` — or the same key you used to start the selection — to drop it and return to Normal mode.

## Command-line mode

`Command-line mode` lets you type one line of text at the bottom of the window. From Normal mode, press `:` to enter it, type a command, and press `Enter` to run it; Vim then returns to Normal mode. This is how you reach Vim's Ex commands, for example `:write` to save the file or `:quit` to leave Vim. Pressing `/` instead of `:` uses the same mode to search the text.

If you change your mind, press `Esc` to leave the command line without running anything. You can also explore Vim's built-in manual from here — try `:help vim-modes`.

## The four modes at a glance

| From | Press | To |
| --- | --- | --- |
| Normal | `i` | Insert |
| Normal | `v`, `V`, or `Ctrl-V` | Visual |
| Normal | `:` or `/` | Command-line |
| Insert, Visual, or Command-line | `Esc` | Normal |

Vim has additional modes, such as Replace and Select, but the four above are enough for everyday work.

## Practice the switches

Try the full loop on a scratch file:

1. Open it with `vim modes-practice.txt`; Vim starts in Normal mode.
2. Press `i`, type a sentence, and notice the `-- INSERT --` indicator.
3. Press `Esc` to return to Normal mode; the indicator disappears.
4. Press `v` and move the cursor with the arrow keys to highlight part of your sentence, then press `Esc` again.
5. Press `:`, type `write`, and press `Enter` to save. Press `:` again, type `quit`, and press `Enter` to leave Vim.

With the modes under your fingers, the next lesson collects the essential hotkeys for moving around, editing, and saving files.
