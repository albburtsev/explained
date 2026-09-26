---
slug: vim/hotkeys
title: Essential Hotkeys
description: Learn the essential Vim keyboard shortcuts for moving the cursor, editing text, searching, and saving files.
tags:
  - vim
  - text-editor
  - hotkeys
---

In the previous lesson you learned that Vim is always in one mode and that Normal mode is its home base. This lesson collects the essential `hotkeys` — the Normal mode keys and Command-line mode commands you will press constantly — for moving around, editing text, searching, and saving your work. Every key below is pressed in Normal mode unless it starts with `:`, which enters Command-line mode; remember that `Esc` always brings you back to Normal mode.

## Quitting and saving

The previous lesson ended by saving with `:write` and leaving with `:quit`. You will use these commands so often that you will almost always type their short forms:

- `:w` writes the buffer to the file — this is how you save your changes
- `:q` quits Vim; it fails with a warning if you have unsaved changes
- `:wq` writes the file and quits in one step
- `:q!` quits without writing, discarding your changes — the escape hatch when you want to start over

Until these feel automatic, a safe habit is to press `:w` every time you pause.

## Moving the cursor

The arrow keys work in Vim, but the dedicated movement keys keep your hands on the home row:

- `h` moves one character left
- `j` moves one line down
- `k` moves one line up
- `l` moves one character right

Larger jumps move by words or to fixed points:

- `w` jumps forward to the start of the next word
- `b` jumps backward to the start of the previous word
- `0` jumps to the first character of the line
- `$` jumps to the end of the line
- `gg` jumps to the first line of the file
- `G` jumps to the last line of the file

## Making simple edits

These keys change text directly from Normal mode, without entering Insert mode:

- `x` deletes the character under the cursor
- `dd` deletes the current line
- `yy` `yanks` the current line — Vim's word for copying it into memory
- `p` `puts` the yanked or deleted text — Vim's word for pasting. Text from `x` goes after the cursor; a whole line from `dd` or `yy` goes below the current line

Because deleted text is kept in memory, `dd` followed by `p` moves a line, and `yy` followed by `p` duplicates it. When you need to type new text, use the `i` key from the previous lesson to enter Insert mode, type, and press `Esc` to come back.

## Undoing and redoing

Mistakes are cheap in Vim:

- `u` `undoes` the last change; press it again to undo earlier changes
- `Ctrl-R` `redoes` a change you just undid

If an edit goes wrong, press `Esc` and then `u` until the text looks right again.

## Searching the text

To find something, press `/`, type the text you are looking for, and press `Enter`. The cursor jumps to the next match, and the search wraps around to the top of the file when it reaches the end. Two keys then walk through the matches:

- `n` jumps to the next match
- `N` jumps to the previous match

Pressing `?` instead of `/` searches backward from the cursor.

## The essential keys at a glance

| Task | Keys |
| --- | --- |
| Save | `:w` |
| Quit | `:q`, `:q!`, or `:wq` to save first |
| Move | `h` `j` `k` `l`, `w` `b`, `0` `$`, `gg` `G` |
| Edit | `x`, `dd`, `yy`, `p` |
| Undo and redo | `u`, `Ctrl-R` |
| Search | `/` then `Enter`, `n`, `N` |

## Practice the hotkeys

Try the full set on a scratch file:

1. Open it with `vim hotkeys-practice.txt`, press `i`, and type three or four short lines. Press `Esc`.
2. Move around with `h` `j` `k` `l`, then jump with `w`, `b`, `0`, `$`, `gg`, and `G`.
3. Press `x` to delete a character, `dd` to delete a line, and `p` to put it back below the cursor.
4. Press `yy` on a line, move down, and press `p` to duplicate it.
5. Press `u` twice to undo your last two changes, then `Ctrl-R` to redo them.
6. Press `/`, type a word from your text, press `Enter`, and walk the matches with `n` and `N`.
7. Finish with `:wq` to save and quit.

Once these keys feel natural, the next lesson shows how to shape Vim's behavior with a basic configuration.
