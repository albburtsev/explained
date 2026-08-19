---
slug: vim/configuration
title: Basic Configuration
description: Learn how to configure Vim with a vimrc file — where it lives, a small starter set of useful options, and how to apply your changes.
tags:
  - vim
  - text-editor
  - configuration
---

The previous two lessons taught you to move around and edit with Vim's default behavior. Those defaults are only a starting point: Vim is built to be configured, and almost everything about it — from line numbers to how search behaves — is controlled by `options`, internal switches that can be turned on, turned off, or given a value. This lesson shows how to collect your favorite settings in a small configuration file, so that every Vim session starts the way you like it.

## The vimrc file

A `vimrc` file is a plain text file that Vim reads once at startup. Each line is one Command-line mode command — the same command you would type after `:` in Vim, written without the colon — and Vim runs the lines in order before showing you the first file. A line starting with `"` is a comment: Vim ignores it, so you can leave notes for yourself.

On macOS, Vim looks for your personal vimrc in a fixed list of places and reads only the first one it finds:

- `~/.vimrc`
- `~/.vim/vimrc`

If you have no vimrc at all, Vim loads a file called `defaults.vim` instead, which turns on a few sensible settings such as syntax highlighting and file type detection — that is why a fresh Vim already feels reasonable. Once you create your own vimrc, `defaults.vim` is no longer loaded, so your file becomes the place where those settings must live. If you want to keep Vim's built-in defaults as a base, the official documentation recommends putting `unlet! skip_defaults_vim` and `source $VIMRUNTIME/defaults.vim` near the top of your file.

## A starter vimrc

Open the file with `vim ~/.vimrc` — Vim creates it when you save — and add this starter set:

```vim
" Color the text according to the language of the file
syntax on

" Show line numbers
set number

" Indent with four columns and use spaces instead of tab characters
set tabstop=4
set shiftwidth=4
set expandtab
set autoindent

" Search without case, unless the pattern contains a capital letter
set ignorecase
set smartcase

" Show matches while typing and highlight all of them
set incsearch
set hlsearch
```

Each line configures one option:

- `syntax on` switches on `syntax highlighting`, so keywords, strings, and comments are colored based on the file's language. Since `defaults.vim` no longer runs, your vimrc needs this line to keep the colors you may already be used to.
- `number` prints the line number in front of each line, which makes it much easier to see where you are in a file.
- `tabstop=4` displays a tab character as four columns wide.
- `shiftwidth=4` indents by four columns.
- `expandtab` inserts spaces instead of a real tab character when you press `Tab` in Insert mode.
- `autoindent` copies the indentation of the current line when you start a new one.
- `ignorecase` makes searches ignore the difference between uppercase and lowercase letters.
- `smartcase` switches case sensitivity back on as soon as your search pattern contains a capital letter; it only works together with `ignorecase`.
- `incsearch` jumps to the first match while you are still typing the search.
- `hlsearch` highlights every match, so searching with `/` lights up all occurrences at once.

## Try options live, then apply the file

You do not have to edit the file to test an option: in Command-line mode, `:set` works right away for the current session. Four forms cover everyday use:

- `:set number` switches an option on
- `:set nonumber` switches it off
- `:set number!` toggles it
- `:set number?` shows its current value

Changes made this way disappear when you quit Vim; lines in your vimrc are loaded on every start. After editing the file, apply it to the running Vim without restarting by `sourcing` it: `:source $MYVIMRC`. Vim stores the path of the vimrc it found in the `$MYVIMRC` variable, so this command reloads your file wherever it lives. Restarting Vim works just as well.

## The starter options at a glance

| Goal | vimrc lines |
| --- | --- |
| Color text by language | `syntax on` |
| Show line numbers | `set number` |
| Indent with four spaces | `set tabstop=4`, `set shiftwidth=4`, `set expandtab` |
| Keep the indent on new lines | `set autoindent` |
| Case-insensitive search, unless you type a capital | `set ignorecase`, `set smartcase` |
| Matches while typing, all highlighted | `set incsearch`, `set hlsearch` |

## Practice your configuration

1. Open your vimrc with `vim ~/.vimrc` and press `i` to enter Insert mode.
2. Type the starter set from above, or just `syntax on` and `set number` for a minimal start.
3. Press `Esc`, save with `:w`, and reload the file with `:source $MYVIMRC`. The line numbers appear immediately.
4. Open any file, search with `/`, and watch matches highlight as you type.
5. Try the live forms: `:set nonumber` hides the numbers, `:set number?` reports the current value, and `:set number!` brings them back.

Whenever an option proves useful, move it into the file so it survives the next restart. Vim has hundreds more options than fit in this lesson — browse them with `:options`, read about any of them with `:help`, for example `:help 'number'`, or explore the online [options documentation](https://vimhelp.org/options.txt.html).

With a vimrc of your own, the course's three pieces are in place: you understand the modes, your fingers know the essential hotkeys, and Vim now starts configured the way you like it.
